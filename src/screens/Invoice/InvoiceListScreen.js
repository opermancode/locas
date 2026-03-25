import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, StatusBar, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getInvoices } from '../../db';
import { formatINR, formatINRCompact, today } from '../../utils/gst';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';

const STATUS_FILTERS = ['All', 'Unpaid', 'Partial', 'Paid', 'Overdue'];

const STATUS_CONFIG = {
  paid:    { bg: COLORS.successLight, text: COLORS.success,  label: 'PAID'    },
  partial: { bg: COLORS.warningLight, text: COLORS.warning,  label: 'PARTIAL' },
  unpaid:  { bg: COLORS.dangerLight,  text: COLORS.danger,   label: 'UNPAID'  },
  overdue: { bg: '#FECACA',           text: '#7F1D1D',       label: 'OVERDUE' },
};

function resolveStatus(inv) {
  if (inv.status === 'paid') return 'paid';
  if (inv.due_date && inv.due_date < today() && inv.status !== 'paid') return 'overdue';
  return inv.status || 'unpaid';
}

export default function InvoiceListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [invoices, setInvoices]         = useState([]);
  const [filtered, setFiltered]         = useState([]);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [refreshing, setRefreshing]     = useState(false);
  const [stats, setStats]               = useState({ total: 0, unpaid: 0, count: 0 });

  const load = async () => {
    try {
      const data = await getInvoices({ type: 'sale' });
      setInvoices(data);
      calcStats(data);
      apply(data, search, statusFilter);
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
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

  const handleSearch = (q) => { setSearch(q); apply(invoices, q, statusFilter); };
  const handleFilter = (f) => { setStatusFilter(f); apply(invoices, search, f); };
  const onRefresh    = () => { setRefreshing(true); load(); };

  const renderInvoice = ({ item, index }) => {
    const status  = resolveStatus(item);
    const sc      = STATUS_CONFIG[status] || STATUS_CONFIG.unpaid;
    const balance = (item.total || 0) - (item.paid || 0);
    const isOverdue = status === 'overdue';

    return (
      <TouchableOpacity
        style={[styles.card, isOverdue && styles.cardOverdue]}
        onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: item.id })}
        activeOpacity={0.82}
      >
        {/* Left accent bar */}
        <View style={[styles.cardAccent, { backgroundColor: sc.text }]} />

        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={styles.cardTopLeft}>
              <Text style={styles.invoiceNum}>{item.invoice_number}</Text>
              <Text style={styles.partyName} numberOfLines={1}>
                {item.party_name || 'Walk-in Customer'}
              </Text>
            </View>
            <View style={styles.cardTopRight}>
              <Text style={styles.invoiceTotal}>{formatINR(item.total)}</Text>
              <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
              </View>
            </View>
          </View>

          <View style={styles.cardMeta}>
            <Text style={styles.metaDate}>📅 {item.date}</Text>
            {item.due_date && status !== 'paid' && (
              <Text style={[styles.metaDue, isOverdue && styles.metaDueOverdue]}>
                Due: {item.due_date}
              </Text>
            )}
            {balance > 0.01 && status !== 'paid' && (
              <Text style={[styles.metaBalance, { color: sc.text }]}>
                Balance: {formatINR(balance)}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.card} />

      {/* ── Header ──────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Invoices</Text>
          <Text style={styles.headerSub}>{stats.count} total</Text>
        </View>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => navigation.navigate('CreateInvoice')}
          activeOpacity={0.85}
        >
          <Text style={styles.newBtnText}>+ New Invoice</Text>
        </TouchableOpacity>
      </View>

      {/* ── Stats strip ─────────────────────────────────── */}
      <View style={styles.statsRow}>
        <StatCard label="Total Sales"  value={formatINRCompact(stats.total)}  color={COLORS.primary} icon="📈" />
        <StatCard label="Outstanding"  value={formatINRCompact(stats.unpaid)} color={COLORS.danger}  icon="⏳" />
        <StatCard label="Invoices"     value={String(stats.count)}            color={COLORS.info}    icon="🧾" />
      </View>

      {/* ── Search ──────────────────────────────────────── */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search invoice or party..."
            placeholderTextColor={COLORS.textMute}
            value={search}
            onChangeText={handleSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')} style={styles.clearBtn}>
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Status filter tabs ──────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, statusFilter === f && styles.filterChipActive]}
            onPress={() => handleFilter(f)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterText, statusFilter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── List ────────────────────────────────────────── */}
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
            <View style={styles.emptyIconWrap}>
              <Text style={styles.emptyIcon}>🧾</Text>
            </View>
            <Text style={styles.emptyTitle}>
              {search || statusFilter !== 'All' ? 'No results found' : 'No invoices yet'}
            </Text>
            <Text style={styles.emptySub}>
              {search || statusFilter !== 'All'
                ? 'Try a different search or filter'
                : 'Tap + New Invoice to create your first invoice'}
            </Text>
            {!search && statusFilter === 'All' && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('CreateInvoice')}
              >
                <Text style={styles.emptyBtnText}>+ Create Invoice</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 22, fontWeight: FONTS.black, color: COLORS.text },
  headerSub:   { fontSize: 12, color: COLORS.textMute, marginTop: 1 },
  newBtn: {
    backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: RADIUS.lg, ...SHADOW.brand,
  },
  newBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },

  // Stats
  statsRow: {
    flexDirection: 'row', backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  statCard:  { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3 },
  statIcon:  { fontSize: 18, marginBottom: 2 },
  statValue: { fontSize: 16, fontWeight: FONTS.black },
  statLabel: { fontSize: 10, color: COLORS.textMute, fontWeight: FONTS.medium, letterSpacing: 0.3 },

  // Search
  searchWrap: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 6, backgroundColor: COLORS.card },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bg, borderRadius: RADIUS.md,
    paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  searchIcon:  { fontSize: 15, marginRight: 8, color: COLORS.textMute },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 10 },
  clearBtn:    { padding: 4 },
  clearText:   { fontSize: 14, color: COLORS.textMute },

  // Filters
  filterRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: RADIUS.full, backgroundColor: COLORS.bg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  filterText:       { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  filterTextActive: { color: '#fff', fontWeight: FONTS.bold },

  // List
  list: { padding: 12, paddingBottom: 90 },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 10, ...SHADOW.sm, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardOverdue: { borderColor: '#FECACA' },
  cardAccent:  { width: 4 },
  cardBody:    { flex: 1, padding: 14 },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardTopLeft: { flex: 1, marginRight: 12 },
  cardTopRight:{ alignItems: 'flex-end' },
  invoiceNum:  { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 3 },
  partyName:   { fontSize: 13, color: COLORS.textSub },
  invoiceTotal:{ fontSize: 18, fontWeight: FONTS.black, color: COLORS.text, marginBottom: 5 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm },
  statusText:  { fontSize: 10, fontWeight: FONTS.black, letterSpacing: 0.5 },
  cardMeta:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  metaDate:    { fontSize: 12, color: COLORS.textMute },
  metaDue:     { fontSize: 12, color: COLORS.warning, fontWeight: FONTS.medium },
  metaDueOverdue: { color: COLORS.danger },
  metaBalance: { fontSize: 12, fontWeight: FONTS.bold },

  // Empty
  empty:       { alignItems: 'center', paddingTop: 70, paddingHorizontal: 32 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyIcon:   { fontSize: 36 },
  emptyTitle:  { fontSize: 18, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  emptySub:    { fontSize: 14, color: COLORS.textMute, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn:    { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.lg, ...SHADOW.brand },
  emptyBtnText:{ color: '#fff', fontWeight: FONTS.bold, fontSize: 14 },
});
