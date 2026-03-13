import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getInvoices } from '../../db/db';
import { formatINR, formatINRCompact, today } from '../../utils/gst';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';

const STATUS_FILTERS = ['All', 'Unpaid', 'Partial', 'Paid', 'Overdue'];

const STATUS_STYLE = {
  paid:    { bg: '#D1FAE5', text: '#065F46' },
  partial: { bg: '#FEF3C7', text: '#92400E' },
  unpaid:  { bg: '#FEE2E2', text: '#991B1B' },
  overdue: { bg: '#FECACA', text: '#7F1D1D' },
};

function resolveStatus(inv) {
  if (inv.status === 'paid') return 'paid';
  if (inv.due_date && inv.due_date < today() && inv.status !== 'paid') return 'overdue';
  return inv.status || 'unpaid';
}

export default function InvoiceListScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [invoices, setInvoices]       = useState([]);
  const [filtered, setFiltered]       = useState([]);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [refreshing, setRefreshing]   = useState(false);
  const [stats, setStats]             = useState({ total: 0, unpaid: 0, count: 0 });

  const load = async () => {
    try {
      const data = await getInvoices({ type: 'sale' });
      setInvoices(data);
      calcStats(data);
      apply(data, search, statusFilter);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const calcStats = (data) => {
    const total  = data.reduce((s, i) => s + (i.total || 0), 0);
    const unpaid = data.reduce((s, i) => s + Math.max(0, (i.total || 0) - (i.paid || 0)), 0);
    setStats({ total, unpaid, count: data.length });
  };

  const apply = (data, q, status) => {
    let out = data;
    if (q.trim()) {
      const lq = q.toLowerCase();
      out = out.filter(i =>
        i.invoice_number?.toLowerCase().includes(lq) ||
        i.party_name?.toLowerCase().includes(lq)
      );
    }
    if (status !== 'All') {
      const key = status.toLowerCase();
      out = out.filter(i => resolveStatus(i) === key);
    }
    setFiltered(out);
  };

  const handleSearch = (q) => {
    setSearch(q);
    apply(invoices, q, statusFilter);
  };

  const handleFilter = (f) => {
    setStatusFilter(f);
    apply(invoices, search, f);
  };

  const onRefresh = () => { setRefreshing(true); load(); };

  // ── Render item ───────────────────────────────────────────────
  const renderInvoice = ({ item }) => {
    const status = resolveStatus(item);
    const ss = STATUS_STYLE[status] || STATUS_STYLE.unpaid;
    const balance = (item.total || 0) - (item.paid || 0);

    return (
      <TouchableOpacity
        style={styles.invoiceCard}
        onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: item.id })}
        activeOpacity={0.85}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.invoiceNum}>{item.invoice_number}</Text>
            <Text style={styles.partyName} numberOfLines={1}>
              {item.party_name || 'Walk-in Customer'}
            </Text>
            <Text style={styles.invoiceDate}>{item.date}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.invoiceTotal}>{formatINR(item.total)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: ss.bg }]}>
              <Text style={[styles.statusText, { color: ss.text }]}>
                {status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {balance > 0.01 && status !== 'paid' && (
          <View style={styles.cardBottom}>
            <Text style={styles.balanceLabel}>Balance Due</Text>
            <Text style={styles.balanceValue}>{formatINR(balance)}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ─────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Invoices</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => navigation.navigate('CreateInvoice')}
        >
          <Text style={styles.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Stats strip */}
      <View style={styles.statsStrip}>
        <StatChip label="Total Sales"  value={formatINRCompact(stats.total)}  color={COLORS.primary} />
        <View style={styles.statsDivider} />
        <StatChip label="Outstanding"  value={formatINRCompact(stats.unpaid)} color={COLORS.danger} />
        <View style={styles.statsDivider} />
        <StatChip label="Invoices"     value={String(stats.count)}            color={COLORS.secondary} />
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search invoice # or party..."
          placeholderTextColor={COLORS.textMute}
          value={search}
          onChangeText={handleSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Text style={styles.clearSearch}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Status filter chips */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, statusFilter === f && styles.filterChipActive]}
            onPress={() => handleFilter(f)}
          >
            <Text style={[styles.filterText, statusFilter === f && styles.filterTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={i => String(i.id)}
        renderItem={renderInvoice}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🧾</Text>
            <Text style={styles.emptyTitle}>
              {search || statusFilter !== 'All' ? 'No invoices found' : 'No invoices yet'}
            </Text>
            <Text style={styles.emptySub}>
              {search || statusFilter !== 'All'
                ? 'Try a different search or filter'
                : 'Tap + New to create your first invoice'}
            </Text>
            {!search && statusFilter === 'All' && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('CreateInvoice')}
              >
                <Text style={styles.emptyBtnText}>Create Invoice</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}

// ─── Sub components ───────────────────────────────────────────────

function StatChip({ label, value, color }) {
  return (
    <View style={styles.statChip}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 20, fontWeight: FONTS.heavy, color: COLORS.text },
  newBtn:      { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.md },
  newBtnText:  { color: COLORS.white, fontWeight: FONTS.bold, fontSize: 14 },

  // Stats strip
  statsStrip: {
    flexDirection: 'row', backgroundColor: COLORS.card,
    paddingVertical: 12, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  statChip:    { flex: 1, alignItems: 'center' },
  statValue:   { fontSize: 16, fontWeight: FONTS.heavy },
  statLabel:   { fontSize: 11, color: COLORS.textMute, marginTop: 2 },
  statsDivider:{ width: 1, backgroundColor: COLORS.border, marginVertical: 4 },

  // Search
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, margin: 12, marginBottom: 8,
    borderRadius: RADIUS.md, paddingHorizontal: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchIcon:  { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 10 },
  clearSearch: { fontSize: 16, color: COLORS.textMute, padding: 4 },

  // Filters
  filterRow: {
    flexDirection: 'row', paddingHorizontal: 12,
    marginBottom: 8, gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: RADIUS.full, backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText:       { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  filterTextActive: { color: COLORS.white, fontWeight: FONTS.bold },

  // List
  list: { padding: 12, paddingTop: 4, paddingBottom: 80 },

  // Invoice card
  invoiceCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 10, ...SHADOW.sm, overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', padding: 14,
  },
  invoiceNum:   { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 3 },
  partyName:    { fontSize: 13, color: COLORS.textSub, marginBottom: 3 },
  invoiceDate:  { fontSize: 12, color: COLORS.textMute },
  invoiceTotal: { fontSize: 17, fontWeight: FONTS.heavy, color: COLORS.text, marginBottom: 6 },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText:   { fontSize: 11, fontWeight: FONTS.heavy, letterSpacing: 0.5 },

  cardBottom: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#FFF5F5', borderTopWidth: 1, borderTopColor: '#FEE2E2',
  },
  balanceLabel: { fontSize: 12, color: COLORS.danger, fontWeight: FONTS.semibold },
  balanceValue: { fontSize: 13, color: COLORS.danger, fontWeight: FONTS.heavy },

  // Empty
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon:  { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  emptySub:   { fontSize: 14, color: COLORS.textMute, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn:   { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.lg },
  emptyBtnText:{ color: COLORS.white, fontWeight: FONTS.bold, fontSize: 15 },
});