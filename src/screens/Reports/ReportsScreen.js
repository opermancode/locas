import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
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
      await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export Report' });
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
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports</Text>
        <TouchableOpacity
          style={[styles.exportBtn, exporting && { opacity: 0.5 }]}
          onPress={exportCSV}
          disabled={exporting}
        >
          {exporting
            ? <ActivityIndicator size="small" color={COLORS.white} />
            : <Text style={styles.exportBtnText}>📤 CSV</Text>
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
            <Text style={styles.exportHintIcon}>📊</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.exportHintTitle}>Export for CA / Accountant</Text>
              <Text style={styles.exportHintSub}>Sales, expenses & GST in CSV</Text>
            </View>
            <Text style={styles.exportHintArrow}>→</Text>
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
  container: { flex: 1, backgroundColor: COLORS.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  scroll:    { padding: 16 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn:       { padding: 4 },
  backIcon:      { fontSize: 22, color: COLORS.primary },
  headerTitle:   { fontSize: 20, fontWeight: FONTS.heavy, color: COLORS.text },
  exportBtn:     { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md, minWidth: 72, alignItems: 'center' },
  exportBtnText: { color: COLORS.white, fontWeight: FONTS.bold, fontSize: 13 },

  loadingText: { fontSize: 14, color: COLORS.textMute, marginTop: 12 },

  presetRow: {
    flexDirection: 'row', backgroundColor: COLORS.card,
    padding: 10, gap: 8, flexWrap: 'wrap',
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  presetChip:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  presetChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  presetText:       { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  presetTextActive: { color: COLORS.white, fontWeight: FONTS.bold },

  // P&L card
  plCard: {
    backgroundColor: COLORS.secondary, borderRadius: RADIUS.lg,
    padding: 16, marginBottom: 16, ...SHADOW.md,
  },
  plTitle: { fontSize: 13, fontWeight: FONTS.bold, color: 'rgba(255,255,255,0.6)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  plRow:   { flexDirection: 'row' },
  plItem:  { flex: 1, alignItems: 'center' },
  plValue: { fontSize: 15, fontWeight: FONTS.heavy, marginBottom: 4 },
  plLabel: { fontSize: 10, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },

  // Section
  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCount: { fontSize: 12, color: COLORS.textMute },

  // Card
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 14, marginBottom: 12, ...SHADOW.sm },

  statRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  statLabel: { fontSize: 14, color: COLORS.text, fontWeight: FONTS.medium, flex: 1 },
  statValue: { fontSize: 14, color: COLORS.text, fontWeight: FONTS.bold },

  nilText: { fontSize: 14, color: COLORS.textMute, textAlign: 'center', paddingVertical: 8 },

  // Top customers
  topRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  topRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rankBadge:    { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  rankText:     { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.primary },
  topName:      { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: FONTS.medium },
  topAmt:       { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text },

  // GST
  gstCard: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  gstBox:  { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 12, alignItems: 'center', borderTopWidth: 3, ...SHADOW.sm },
  gstValue:{ fontSize: 14, fontWeight: FONTS.heavy, marginBottom: 4 },
  gstLabel:{ fontSize: 10, color: COLORS.textMute, textAlign: 'center' },

  // Export hint
  exportHint: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: 16, marginBottom: 8, ...SHADOW.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  exportHintIcon:  { fontSize: 28 },
  exportHintTitle: { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 2 },
  exportHintSub:   { fontSize: 12, color: COLORS.textSub },
  exportHintArrow: { fontSize: 20, color: COLORS.primary },
});
