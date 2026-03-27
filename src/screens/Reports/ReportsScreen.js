import Icon from '../../utils/Icon';
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Platform as _RPlatform } from 'react-native';
const Sharing = _RPlatform.OS === 'web'
  ? { shareAsync: async () => {} }
  : require('expo-sharing');
const FileSystem = _RPlatform.OS === 'web'
  ? {
      documentDirectory: '',
      EncodingType: { UTF8: 'utf8' },
      writeAsStringAsync: async (path, data) => {
        // Web: trigger browser download instead
        const blob = new Blob([data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = path.split('/').pop() || 'report.csv';
        a.click(); URL.revokeObjectURL(url);
      },
    }
  : require('expo-file-system/legacy');
import { getReportData } from '../../db';
import { formatINR, formatINRCompact } from '../../utils/gst';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';

const PRESETS = [
  { label: 'This Month',  key: 'thisMonth' },
  { label: 'Last Month',  key: 'lastMonth' },
  { label: 'This Year',   key: 'thisYear'  },
  { label: 'Last Year',   key: 'lastYear'  },
];

function getRange(key) {
  const now  = new Date();
  const yy   = now.getFullYear();
  const mm   = now.getMonth(); // 0-indexed

  switch (key) {
    case 'thisMonth': {
      const from = `${yy}-${String(mm + 1).padStart(2, '0')}-01`;
      const to   = new Date(yy, mm + 1, 0).toISOString().split('T')[0];
      return { from, to };
    }
    case 'lastMonth': {
      const d    = new Date(yy, mm - 1, 1);
      const ly   = d.getFullYear();
      const lm   = d.getMonth(); // 0-indexed
      const from = `${ly}-${String(lm + 1).padStart(2, '0')}-01`;
      const to   = new Date(ly, lm + 1, 0).toISOString().split('T')[0];
      return { from, to };
    }
    case 'thisYear':
      return { from: `${yy}-01-01`, to: `${yy}-12-31` };
    case 'lastYear':
      return { from: `${yy - 1}-01-01`, to: `${yy - 1}-12-31` };
    default:
      return { from: `${yy}-01-01`, to: `${yy}-12-31` };
  }
}

export default function ReportsScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [preset, setPreset]   = useState('thisMonth');
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = async (p = preset) => {
    setLoading(true);
    try {
      const { from, to } = getRange(p);
      const d = await getReportData(from, to);
      setData(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const switchPreset = (p) => { setPreset(p); load(p); };

  // ── Derived numbers ───────────────────────────────────────────
  const totalSales       = data?.sales?.reduce((s, i) => s + (i.total  || 0), 0) || 0;
  const totalCollected   = data?.sales?.reduce((s, i) => s + (i.paid   || 0), 0) || 0;
  const totalOutstanding = totalSales - totalCollected;
  const totalExpenses    = data?.expenses?.reduce((s, e) => s + (e.amount || 0), 0) || 0;
  const grossProfit      = totalSales - totalExpenses;

  const totalCGST      = data?.gst?.cgst  || 0;
  const totalSGST      = data?.gst?.sgst  || 0;
  const totalIGST      = data?.gst?.igst  || 0;
  const totalTax       = data?.gst?.total || 0;

  const salesCount   = data?.sales?.length    || 0;
  const expenseCount = data?.expenses?.length || 0;

  // ── CSV Export ────────────────────────────────────────────────
  const exportCSV = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const { from, to } = getRange(preset);

      // Helper: escape a value for CSV
      const esc = (v) => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };
      const n = (v) => Number(v || 0).toFixed(2);

      // Sales section
      const salesRows = (data.sales || []).map(i =>
        [i.invoice_number, i.date, esc(i.party_name), esc(i.party_gstin),
         n(i.taxable), n(i.cgst), n(i.sgst), n(i.igst), n(i.total_tax),
         n(i.total), n(i.paid), n(i.total - i.paid), i.status].join(',')
      );

      // Expenses section
      const expRows = (data.expenses || []).map(e =>
        [e.date, esc(e.category), esc(e.party_name), esc(e.bill_no),
         esc(e.method), n(e.amount), esc(e.note)].join(',')
      );

      const csv = [
        // Report header as comments (starts with #, ignored by most parsers)
        `# LOCAS REPORT`,
        `# Period: ${from} to ${to}`,
        `# Generated: ${new Date().toLocaleDateString('en-IN')}`,
        ``,
        // Sales
        `# SALES`,
        `Invoice No,Date,Party,GSTIN,Taxable,CGST,SGST,IGST,Total Tax,Total,Paid,Outstanding,Status`,
        ...salesRows,
        salesRows.length === 0 ? '# No sales in this period' : '',
        ``,
        // Expenses
        `# EXPENSES`,
        `Date,Category,Party,Bill No,Method,Amount,Note`,
        ...expRows,
        expRows.length === 0 ? '# No expenses in this period' : '',
        ``,
        // GST Summary
        `# GST SUMMARY`,
        `CGST,SGST,IGST,Total Tax`,
        `${n(totalCGST)},${n(totalSGST)},${n(totalIGST)},${n(totalTax)}`,
        ``,
        // P&L Summary
        `# P&L SUMMARY`,
        `Total Sales,Total Expenses,Net Profit`,
        `${n(totalSales)},${n(totalExpenses)},${n(grossProfit)}`,
      ].join('\n');

      const filename = `Locas_${from}_${to}.csv`;
      const path = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: 'utf8' });
      if (_RPlatform.OS !== 'web') {
        await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export Report' });
      }
    } catch (e) {
      Alert.alert('Export Error', e.message);
    } finally {
      setExporting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports</Text>
        <TouchableOpacity
          style={[styles.exportBtn, exporting && { opacity: 0.5 }]}
          onPress={exportCSV}
          disabled={exporting}
        >
          {exporting
            ? <ActivityIndicator size="small" color={COLORS.white} />
            : <><Icon name="upload" size={14} color="#fff" /><Text style={styles.exportBtnText}> Export CSV</Text></>
          }
        </TouchableOpacity>
      </View>

      {/* Preset selector */}
      <View style={styles.presetRow}>
        {PRESETS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[styles.presetChip, preset === p.key && styles.presetChipActive]}
            onPress={() => switchPreset(p.key)}
          >
            <Text style={[styles.presetText, preset === p.key && styles.presetTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Crunching numbers…</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* P&L Summary */}
          <View style={styles.plCard}>
            <Text style={styles.plTitle}>P&amp;L Summary</Text>
            <View style={styles.plRow}>
              <PLItem label="Sales"      value={totalSales}    color={COLORS.primary} />
              <PLItem label="Expenses"   value={totalExpenses} color={COLORS.danger} />
              <PLItem label="Net Profit" value={grossProfit}   color={grossProfit >= 0 ? COLORS.success : COLORS.danger} />
            </View>
          </View>

          {/* Sales block */}
          <SectionTitle title="Sales" count={salesCount} />
          <View style={styles.card}>
            <StatRow label="Total Invoiced"  value={formatINR(totalSales)} />
            <StatRow label="Collected"       value={formatINR(totalCollected)} valueColor={COLORS.success} />
            <StatRow label="Outstanding"     value={formatINR(totalOutstanding)} valueColor={totalOutstanding > 0 ? COLORS.danger : COLORS.textMute} />
            <StatRow label="Invoices Raised" value={String(salesCount)} />
            {salesCount > 0 && (
              <StatRow label="Avg Invoice"   value={formatINR(totalSales / salesCount)} />
            )}
          </View>

          {/* Top customers */}
          {data?.sales?.length > 0 && (() => {
            const byParty = {};
            data.sales.forEach(i => {
              const k = i.party_name || 'Walk-in';
              byParty[k] = (byParty[k] || 0) + (i.total || 0);
            });
            const top = Object.entries(byParty)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5);
            return (
              <>
                <SectionTitle title="Top Customers" />
                <View style={styles.card}>
                  {top.map(([name, amt], i) => (
                    <View key={name} style={[styles.topRow, i < top.length - 1 && styles.topRowBorder]}>
                      <View style={styles.rankBadge}>
                        <Text style={styles.rankText}>#{i + 1}</Text>
                      </View>
                      <Text style={styles.topName} numberOfLines={1}>{name}</Text>
                      <Text style={styles.topAmt}>{formatINR(amt)}</Text>
                    </View>
                  ))}
                </View>
              </>
            );
          })()}

          {/* Expenses block */}
          <SectionTitle title="Expenses" count={expenseCount} />
          <View style={styles.card}>
            {expenseCount > 0 ? (
              <>
                <StatRow label="Total Expenses" value={formatINR(totalExpenses)} valueColor={COLORS.danger} />
                <StatRow label="Entries"         value={String(expenseCount)} />
                {/* By category breakdown */}
                {(() => {
                  const byCat = {};
                  data.expenses.forEach(e => {
                    byCat[e.category] = (byCat[e.category] || 0) + (e.amount || 0);
                  });
                  return Object.entries(byCat)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, amt]) => (
                      <StatRow key={cat} label={cat} value={formatINR(amt)} muted />
                    ));
                })()}
              </>
            ) : (
              <Text style={styles.nilText}>No expenses this period</Text>
            )}
          </View>

          {/* GST Summary */}
          <SectionTitle title="GST Summary" />
          <View style={styles.gstCard}>
            <GSTBox label="CGST Collected" value={formatINR(totalCGST)} color="#6366F1" />
            <GSTBox label="SGST Collected" value={formatINR(totalSGST)} color="#8B5CF6" />
            <GSTBox label="IGST Collected" value={formatINR(totalIGST)} color="#EC4899" />
          </View>
          <View style={styles.card}>
            <StatRow label="Total Tax Collected" value={formatINR(totalTax)} valueColor={COLORS.primary} />
            <StatRow label="Tax on Sales"        value={formatINR(totalTax)} />
          </View>

          {/* Export hint */}
          <TouchableOpacity style={styles.exportHint} onPress={exportCSV} disabled={exporting}>
            <Icon name="bar-chart-2" size={28} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.exportHintTitle}>Export for CA / Accountant</Text>
              <Text style={styles.exportHintSub}>Sales, expenses & GST in CSV</Text>
            </View>
            <Icon name="arrow-right" size={18} color={COLORS.primary} />
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Sub components ───────────────────────────────────────────────

function SectionTitle({ title, count }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count !== undefined && (
        <Text style={styles.sectionCount}>{count} entries</Text>
      )}
    </View>
  );
}

function StatRow({ label, value, valueColor, muted }) {
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, muted && { color: COLORS.textMute, paddingLeft: 12 }]}>
        {muted ? `↳ ${label}` : label}
      </Text>
      <Text style={[styles.statValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function PLItem({ label, value, color }) {
  return (
    <View style={styles.plItem}>
      <Text style={[styles.plValue, { color }]}>{formatINRCompact(Math.abs(value))}</Text>
      <Text style={styles.plLabel}>{label}</Text>
    </View>
  );
}

function GSTBox({ label, value, color }) {
  return (
    <View style={[styles.gstBox, { borderTopColor: color }]}>
      <Text style={[styles.gstValue, { color }]}>{value}</Text>
      <Text style={styles.gstLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────


const styles = StyleSheet.create({
  // ── Layout ───────────────────────────────────────────────────────
  container: { flex: 1, backgroundColor: COLORS.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:    { padding: 16, paddingBottom: 40 },

  // ── Header ───────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerLeft:  { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: FONTS.black, color: COLORS.text },
  headerSub:   { fontSize: 11, color: COLORS.textMute, marginTop: 1 },
  backBtn:     { padding: 6, marginRight: 8 },
  backIcon:    { fontSize: 20, color: COLORS.primary },
  addBtn:      { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md, ...SHADOW.brand },
  addBtnText:  { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
  newBtn:      { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md, ...SHADOW.brand },
  newBtnText:  { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },

  // ── Metrics bar ──────────────────────────────────────────────────
  metricsBar:  { flexDirection: 'row', backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  statChip:    { flex: 1, alignItems: 'center', paddingVertical: 10 },
  statValue:   { fontSize: 15, fontWeight: FONTS.black },
  statLabel:   { fontSize: 10, color: COLORS.textMute, marginTop: 2 },
  statsDivider:{ width: 1, backgroundColor: COLORS.border, marginVertical: 8 },

  // ── Search bar ───────────────────────────────────────────────────
  searchWrap: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 0 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  searchIcon:  { fontSize: 17, color: COLORS.textMute, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 10 },
  clearSearch: { fontSize: 13, color: COLORS.textMute, padding: 4 },

  // ── Filter chips ─────────────────────────────────────────────────
  filterRow:       { paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filterChip:      { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive:{ backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  filterText:      { fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.medium },
  filterTextActive:{ color: '#fff', fontWeight: FONTS.bold },
  catChip:         { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  catChipActive:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catChipText:     { fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.medium },
  catChipTextActive:{ color: '#fff', fontWeight: FONTS.bold },

  // ── List ─────────────────────────────────────────────────────────
  list: { padding: 12, paddingBottom: 90 },

  // ── Cards (parties, items, expenses) ─────────────────────────────
  partyCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
    ...SHADOW.xs, overflow: 'hidden',
  },
  itemCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
    ...SHADOW.xs, overflow: 'hidden',
  },
  expCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
    ...SHADOW.xs, overflow: 'hidden',
  },
  cardRow:   { flexDirection: 'row', alignItems: 'center', padding: 13 },
  cardLeft:  { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  cardRight: { alignItems: 'flex-end', gap: 5 },
  cardInfo:  { flex: 1 },
  cardName:  { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 3 },
  cardSub:   { fontSize: 12, color: COLORS.textSub },

  // Avatar
  avatar:     { width: 42, height: 42, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: FONTS.heavy, color: '#fff' },

  // Badges / tags
  typeBadge:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm, backgroundColor: COLORS.primaryLight },
  typeBadgeSupplier:{ backgroundColor: COLORS.infoLight },
  typeText:         { fontSize: 10, fontWeight: FONTS.bold, color: COLORS.primary },
  typeTextSupplier: { color: COLORS.info },
  balance:          { fontSize: 12, fontWeight: FONTS.heavy, color: COLORS.success },

  // Low stock warning
  lowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, paddingVertical: 7, backgroundColor: COLORS.warningBg, borderTopWidth: 1, borderTopColor: '#FDE68A' },
  lowText:{ fontSize: 11, color: COLORS.warning, fontWeight: FONTS.semibold },

  stockRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingBottom: 10 },
  stockLabel: { fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.medium },
  minStock:   { fontSize: 11, color: COLORS.textMute },

  // Category icon badge
  catIconBox: { width: 38, height: 38, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  catIcon:    { fontSize: 18 },

  // Action buttons on cards
  cardActions: { flexDirection: 'row', gap: 4 },
  editBtn:     { padding: 6, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgDeep },
  editIcon:    { fontSize: 14 },
  delBtn:      { padding: 6, borderRadius: RADIUS.sm, backgroundColor: COLORS.dangerLight },
  delIcon:     { fontSize: 14 },

  // ── Bottom sheet modal ───────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl,
    maxHeight: '92%', ...SHADOW.lg,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.borderDark, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle:  { fontSize: 17, fontWeight: FONTS.black, color: COLORS.text },
  modalClose:  { fontSize: 18, color: COLORS.textMute, padding: 4 },
  modalBody:   { padding: 20 },
  modalFooter: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
  modalSave:   { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.lg, alignItems: 'center', ...SHADOW.brand },
  modalSaveText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 15 },

  // ── Form fields ──────────────────────────────────────────────────
  fieldLabel: { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, marginTop: 14 },
  fieldInput: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: 13, paddingVertical: 11,
    fontSize: 14, color: COLORS.text,
  },
  pickerRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerChip:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg },
  pickerChipActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pickerChipText:    { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  pickerChipTextActive: { color: '#fff', fontWeight: FONTS.bold },

  // ── Reports specific ─────────────────────────────────────────────
  presetRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  presetChip:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  presetChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  presetText:       { fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.medium },
  presetTextActive: { color: '#fff', fontWeight: FONTS.bold },
  reportCard:       { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 14, marginBottom: 12, ...SHADOW.sm, borderWidth: 1, borderColor: COLORS.border },
  reportTitle:      { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  reportRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  reportLabel:      { fontSize: 13, color: COLORS.textSub },
  reportValue:      { fontSize: 13, fontWeight: FONTS.heavy, color: COLORS.text },
  plCard:           { backgroundColor: COLORS.secondary, borderRadius: RADIUS.lg, padding: 16, marginBottom: 14, ...SHADOW.md },
  plTitle:          { fontSize: 12, fontWeight: FONTS.bold, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  plRow:            { flexDirection: 'row' },
  plItem:           { flex: 1, alignItems: 'center' },
  plValue:          { fontSize: 14, fontWeight: FONTS.heavy, marginBottom: 3 },
  plLabel:          { fontSize: 10, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },
  exportBtn:        { backgroundColor: COLORS.secondary, paddingVertical: 12, borderRadius: RADIUS.lg, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  exportBtnText:    { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },

  // ── Settings specific ────────────────────────────────────────────
  settingsSection: { marginBottom: 8 },
  settingsLabel:   { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  settingsCard:    { backgroundColor: COLORS.card, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border },
  settingsRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  settingsRowLast: { borderBottomWidth: 0 },
  settingsRowLabel:{ flex: 1, fontSize: 14, fontWeight: FONTS.medium, color: COLORS.text },
  settingsRowValue:{ fontSize: 13, color: COLORS.textMute },
  settingsInput:   { flex: 1, fontSize: 14, color: COLORS.text, textAlign: 'right' },
  saveBar:         { backgroundColor: COLORS.card, padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  saveBtn:         { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.lg, alignItems: 'center', ...SHADOW.brand },
  saveBtnText:     { color: '#fff', fontWeight: FONTS.bold, fontSize: 15 },
  dangerBtn:       { borderWidth: 1, borderColor: COLORS.dangerLight, paddingVertical: 13, borderRadius: RADIUS.lg, alignItems: 'center', marginTop: 8 },
  dangerBtnText:   { color: COLORS.danger, fontWeight: FONTS.bold, fontSize: 14 },

  // ── Party Detail ─────────────────────────────────────────────────
  heroDetail: {
    backgroundColor: COLORS.secondary, paddingTop: 12, paddingBottom: 20,
    paddingHorizontal: 20, alignItems: 'center',
  },
  detailAvatar:     { width: 60, height: 60, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  detailAvatarText: { fontSize: 26, fontWeight: FONTS.black, color: '#fff' },
  detailName:       { fontSize: 19, fontWeight: FONTS.black, color: '#fff', marginBottom: 4 },
  detailSub:        { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  kpiStrip:         { flexDirection: 'row', backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  kpiChip:          { flex: 1, alignItems: 'center', paddingVertical: 10 },
  kpiValue:         { fontSize: 14, fontWeight: FONTS.heavy, marginBottom: 2 },
  kpiLabel:         { fontSize: 10, color: COLORS.textMute },
  kpiDivider:       { width: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  sectionTitle:     { fontSize: 12, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  invRow: {
    backgroundColor: COLORS.card, marginHorizontal: 12, marginBottom: 8,
    borderRadius: RADIUS.lg, padding: 13, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.xs,
  },
  invRowTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  invNum:      { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 3 },
  invDate:     { fontSize: 11, color: COLORS.textMute },
  invTotal:    { fontSize: 15, fontWeight: FONTS.heavy, color: COLORS.text, marginBottom: 4 },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.xs },
  statusText:  { fontSize: 9, fontWeight: FONTS.black, letterSpacing: 0.5 },
  balRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, marginTop: 6, borderTopWidth: 1, borderTopColor: COLORS.border },
  balLabel:    { fontSize: 11, color: COLORS.danger },
  balValue:    { fontSize: 11, fontWeight: FONTS.heavy, color: COLORS.danger },

  // ── Auth / Login ─────────────────────────────────────────────────
  loginContainer: { flex: 1, backgroundColor: '#FFF8F4', alignItems: 'center', justifyContent: 'center', padding: 24 },
  loginLogoWrap:  { alignItems: 'center', marginBottom: 36 },
  loginLogoBox:   { width: 80, height: 80, borderRadius: RADIUS.xl, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 14, ...SHADOW.brand },
  loginLogoImg:   { width: 56, height: 56 },
  loginBrand:     { fontSize: 26, fontWeight: FONTS.black, color: COLORS.text, letterSpacing: 8 },
  loginTagline:   { fontSize: 12, color: COLORS.textMute, letterSpacing: 1, marginTop: 4 },
  loginCard:      { width: '100%', backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: 24, ...SHADOW.md },
  loginTitle:     { fontSize: 20, fontWeight: FONTS.black, color: COLORS.text, marginBottom: 4 },
  loginSubtitle:  { fontSize: 13, color: COLORS.textMute, marginBottom: 20 },
  loginLabel:     { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, marginTop: 14 },
  loginInput:     { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.text },
  loginBtn:       { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginTop: 22, ...SHADOW.brand },
  loginBtnText:   { color: '#fff', fontWeight: FONTS.black, fontSize: 15, letterSpacing: 0.3 },
  loginError:     { backgroundColor: COLORS.dangerLight, borderRadius: RADIUS.sm, padding: 12, marginBottom: 14 },
  loginErrorText: { fontSize: 13, color: '#991B1B' },
  loginFooter:    { fontSize: 12, color: COLORS.textMute, marginTop: 22, textAlign: 'center' },

  // ── Empty state ──────────────────────────────────────────────────
  empty:        { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIconWrap:{ width: 72, height: 72, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyIcon:    { fontSize: 32 },
  emptyTitle:   { fontSize: 17, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 7, textAlign: 'center' },
  emptySub:     { fontSize: 13, color: COLORS.textMute, textAlign: 'center', lineHeight: 19, marginBottom: 22 },
  emptyBtn:     { backgroundColor: COLORS.primary, paddingHorizontal: 22, paddingVertical: 11, borderRadius: RADIUS.lg, ...SHADOW.brand },
  emptyBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
});