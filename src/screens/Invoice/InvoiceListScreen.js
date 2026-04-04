import Icon from '../../utils/Icon';
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, StatusBar, ScrollView,
  Platform, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getInvoices } from '../../db';
import { formatINR, formatINRCompact, today } from '../../utils/gst';
import { COLORS, RADIUS, FONTS } from '../../theme';

const STATUS_FILTERS = ['All', 'Unpaid', 'Partial', 'Paid', 'Overdue'];

const STATUS_CFG = {
  paid:    { bg: '#D1FAE5', text: '#065F46', label: 'Paid'    },
  partial: { bg: '#FEF3C7', text: '#92400E', label: 'Partial' },
  unpaid:  { bg: '#FEE2E2', text: '#991B1B', label: 'Unpaid'  },
  overdue: { bg: '#FECACA', text: '#7F1D1D', label: 'Overdue' },
};

function resolveStatus(inv) {
  if (inv.status === 'paid') return 'paid';
  if (inv.due_date && inv.due_date < today() && inv.status !== 'paid') return 'overdue';
  return inv.status || 'unpaid';
}

// Column definitions — widths are flex weights for proportional sizing
const COLS = [
  { key: 'no',      label: 'Invoice #',   flex: 1.4, align: 'left'  },
  { key: 'party',   label: 'Customer',    flex: 2,   align: 'left'  },
  { key: 'date',    label: 'Date',        flex: 1.2, align: 'left'  },
  { key: 'due',     label: 'Due Date',    flex: 1.2, align: 'left'  },
  { key: 'total',   label: 'Total',       flex: 1.3, align: 'right' },
  { key: 'paid',    label: 'Paid',        flex: 1.2, align: 'right' },
  { key: 'balance', label: 'Balance',     flex: 1.2, align: 'right' },
  { key: 'status',  label: 'Status',      flex: 1,   align: 'center'},
];

export default function InvoiceListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [invoices, setInvoices]         = useState([]);
  const [filtered, setFiltered]         = useState([]);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [refreshing, setRefreshing]     = useState(false);
  const [sortKey, setSortKey]           = useState('date');
  const [sortAsc, setSortAsc]           = useState(false);
  const [stats, setStats]               = useState({ total: 0, unpaid: 0, paid: 0, count: 0 });

  const load = async () => {
    try {
      const data = await getInvoices({ type: 'sale' });
      setInvoices(data);
      const total  = data.reduce((s, i) => s + (i.total || 0), 0);
      const unpaid = data.reduce((s, i) => s + Math.max(0, (i.total || 0) - (i.paid || 0)), 0);
      const paid   = data.reduce((s, i) => s + (i.paid || 0), 0);
      setStats({ total, unpaid, paid, count: data.length });
      applyFilters(data, search, statusFilter, sortKey, sortAsc);
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const applyFilters = (data, q, status, sk, asc) => {
    let out = [...data];
    if (q.trim()) {
      const lq = q.toLowerCase();
      out = out.filter(i =>
        i.invoice_number?.toLowerCase().includes(lq) ||
        i.party_name?.toLowerCase().includes(lq)
      );
    }
    if (status !== 'All') {
      out = out.filter(i => resolveStatus(i) === status.toLowerCase());
    }
    // Sort
    out.sort((a, b) => {
      let va, vb;
      switch (sk) {
        case 'no':      va = a.invoice_number; vb = b.invoice_number; break;
        case 'party':   va = a.party_name || ''; vb = b.party_name || ''; break;
        case 'date':    va = a.date; vb = b.date; break;
        case 'due':     va = a.due_date || ''; vb = b.due_date || ''; break;
        case 'total':   va = a.total || 0; vb = b.total || 0; break;
        case 'paid':    va = a.paid || 0; vb = b.paid || 0; break;
        case 'balance': va = (a.total||0)-(a.paid||0); vb = (b.total||0)-(b.paid||0); break;
        case 'status':  va = resolveStatus(a); vb = resolveStatus(b); break;
        default:        va = a.date; vb = b.date;
      }
      if (typeof va === 'number') return asc ? va - vb : vb - va;
      return asc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    setFiltered(out);
  };

  // Debounce search to avoid re-filtering on every single keystroke
  const searchTimer = React.useRef(null);
  const handleSearch = (q) => {
    setSearch(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) {
      applyFilters(invoices, q, statusFilter, sortKey, sortAsc);
      return;
    }
    searchTimer.current = setTimeout(() => {
      applyFilters(invoices, q, statusFilter, sortKey, sortAsc);
    }, 200);
  };
  const handleFilter = (f) => {
    setStatusFilter(f);
    applyFilters(invoices, search, f, sortKey, sortAsc);
  };
  const handleSort = (key) => {
    const asc = sortKey === key ? !sortAsc : false;
    setSortKey(key);
    setSortAsc(asc);
    applyFilters(invoices, search, statusFilter, key, asc);
  };
  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.card} />

      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Invoices</Text>
          <Text style={s.headerSub}>{stats.count} records</Text>
        </View>
        <TouchableOpacity
          style={s.newBtn}
          onPress={() => navigation.navigate('CreateInvoice')}
          activeOpacity={0.85}
        >
          <Icon name="plus" size={15} color="#fff" />
          <Text style={s.newBtnText}>New Invoice</Text>
        </TouchableOpacity>
      </View>

      {/* ── KPI strip ── */}
      <View style={s.kpiStrip}>
        <KPI label="Total Sales"  value={formatINRCompact(stats.total)}  color={COLORS.primary} />
        <View style={s.kpiDiv} />
        <KPI label="Collected"   value={formatINRCompact(stats.paid)}   color={COLORS.success} />
        <View style={s.kpiDiv} />
        <KPI label="Outstanding" value={formatINRCompact(stats.unpaid)} color={stats.unpaid > 0 ? COLORS.danger : COLORS.textMute} />
        <View style={s.kpiDiv} />
        <KPI label="Count"       value={String(stats.count)}             color={COLORS.text} />
      </View>

      {/* ── Search + filters ── */}
      <View style={s.toolbar}>
        <View style={s.searchBox}>
          <Icon name="search" size={15} color={COLORS.textMute} />
          <TextInput
            style={s.searchInput}
            placeholder="Search invoice # or customer..."
            placeholderTextColor={COLORS.textMute}
            value={search}
            onChangeText={handleSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Icon name="x" size={14} color={COLORS.textMute} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={s.chipRow}>
          {STATUS_FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[s.chip, statusFilter === f && s.chipActive]}
              onPress={() => handleFilter(f)}
            >
              <Text style={[s.chipTxt, statusFilter === f && s.chipTxtActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Table ── */}
      <View style={s.tableWrap}>
        {/* Sticky column header */}
        <View style={s.thead}>
          {COLS.map(col => (
            <TouchableOpacity
              key={col.key}
              style={[s.th, { flex: col.flex }]}
              onPress={() => handleSort(col.key)}
              activeOpacity={0.7}
            >
              <Text style={[s.thTxt, { textAlign: col.align }]} numberOfLines={1}>
                {col.label}
                {sortKey === col.key ? (sortAsc ? ' ↑' : ' ↓') : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Table body */}
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <View style={s.emptyIconWrap}>
                <Icon name="file-text" size={28} color={COLORS.primary} />
              </View>
              <Text style={s.emptyTitle}>
                {search || statusFilter !== 'All' ? 'No results found' : 'No invoices yet'}
              </Text>
              <Text style={s.emptySub}>
                {search || statusFilter !== 'All'
                  ? 'Try a different search or filter'
                  : 'Tap "New Invoice" to create your first invoice'}
              </Text>
              {!search && statusFilter === 'All' && (
                <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('CreateInvoice')}>
                  <Text style={s.emptyBtnTxt}>Create Invoice</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filtered.map((item, idx) => {
              const st  = resolveStatus(item);
              const cfg = STATUS_CFG[st] || STATUS_CFG.unpaid;
              const bal = Math.max(0, (item.total || 0) - (item.paid || 0));
              const isEven = idx % 2 === 0;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[s.trow, isEven && s.trowEven]}
                  onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: item.id })}
                  activeOpacity={0.75}
                >
                  {/* Invoice # */}
                  <View style={[s.td, { flex: COLS[0].flex }]}>
                    <Text style={s.tdInvNum} numberOfLines={1}>{item.invoice_number}</Text>
                  </View>

                  {/* Customer */}
                  <View style={[s.td, { flex: COLS[1].flex }]}>
                    <Text style={s.tdMain} numberOfLines={1}>
                      {item.party_name || 'Walk-in'}
                    </Text>
                  </View>

                  {/* Date */}
                  <View style={[s.td, { flex: COLS[2].flex }]}>
                    <Text style={s.tdMuted} numberOfLines={1}>{item.date}</Text>
                  </View>

                  {/* Due Date */}
                  <View style={[s.td, { flex: COLS[3].flex }]}>
                    <Text
                      style={[s.tdMuted, st === 'overdue' && { color: COLORS.danger, fontWeight: FONTS.semibold }]}
                      numberOfLines={1}
                    >
                      {item.due_date || '—'}
                    </Text>
                  </View>

                  {/* Total */}
                  <View style={[s.td, { flex: COLS[4].flex, alignItems: 'flex-end' }]}>
                    <Text style={s.tdAmt} numberOfLines={1}>{formatINR(item.total)}</Text>
                  </View>

                  {/* Paid */}
                  <View style={[s.td, { flex: COLS[5].flex, alignItems: 'flex-end' }]}>
                    <Text style={[s.tdAmt, { color: COLORS.success }]} numberOfLines={1}>
                      {formatINR(item.paid || 0)}
                    </Text>
                  </View>

                  {/* Balance */}
                  <View style={[s.td, { flex: COLS[6].flex, alignItems: 'flex-end' }]}>
                    <Text
                      style={[s.tdAmt, bal > 0.01 ? { color: COLORS.danger } : { color: COLORS.textMute }]}
                      numberOfLines={1}
                    >
                      {bal > 0.01 ? formatINR(bal) : '—'}
                    </Text>
                  </View>

                  {/* Status */}
                  <View style={[s.td, { flex: COLS[7].flex, alignItems: 'center' }]}>
                    <View style={[s.pill, { backgroundColor: cfg.bg }]}>
                      <Text style={[s.pillTxt, { color: cfg.text }]}>{cfg.label}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </View>
  );
}

function KPI({ label, value, color }) {
  return (
    <View style={s.kpiChip}>
      <Text style={[s.kpiVal, { color }]}>{value}</Text>
      <Text style={s.kpiLbl}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.bg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 20, fontWeight: FONTS.black, color: COLORS.text },
  headerSub:   { fontSize: 12, color: COLORS.textMute, marginTop: 1 },
  newBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: RADIUS.md },
  newBtnText:  { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },

  // KPI strip
  kpiStrip: { flexDirection: 'row', backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  kpiChip:  { flex: 1, alignItems: 'center', paddingVertical: 12 },
  kpiDiv:   { width: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  kpiVal:   { fontSize: 16, fontWeight: FONTS.black, marginBottom: 2 },
  kpiLbl:   { fontSize: 9, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Toolbar
  toolbar: {
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    paddingTop: 10,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 14, marginBottom: 8,
    paddingHorizontal: 12, height: 38,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.text, paddingVertical: 0 },
  chipScroll:  { flexGrow: 0 },
  chipRow:     { paddingHorizontal: 14, paddingBottom: 10, gap: 7 },
  chip:        { paddingHorizontal: 14, paddingVertical: 5, borderRadius: RADIUS.full, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  chipActive:  { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  chipTxt:     { fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.medium },
  chipTxtActive: { color: '#fff', fontWeight: FONTS.bold },

  // Table
  tableWrap: { flex: 1 },

  thead: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 2, borderBottomColor: COLORS.border,
    paddingVertical: 0,
  },
  th: {
    paddingHorizontal: 10, paddingVertical: 10,
    borderRightWidth: 1, borderRightColor: COLORS.border,
  },
  thTxt: {
    fontSize: 11, fontWeight: FONTS.bold,
    color: COLORS.textSub,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  trow: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  trowEven: { backgroundColor: '#FAFBFF' },

  td: {
    paddingHorizontal: 10, paddingVertical: 11,
    justifyContent: 'center',
    borderRightWidth: 1, borderRightColor: COLORS.border,
  },

  // Cell text styles
  tdInvNum:  { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.primary },
  tdMain:    { fontSize: 13, fontWeight: FONTS.medium, color: COLORS.text },
  tdMuted:   { fontSize: 12, color: COLORS.textSub },
  tdAmt:     { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.text },

  // Status pill
  pill:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  pillTxt: { fontSize: 10, fontWeight: FONTS.black, letterSpacing: 0.3 },

  // Empty state
  empty:        { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIconWrap:{ width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle:   { fontSize: 17, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 6, textAlign: 'center' },
  emptySub:     { fontSize: 13, color: COLORS.textMute, textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  emptyBtn:     { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 11, borderRadius: RADIUS.lg },
  emptyBtnTxt:  { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
});
