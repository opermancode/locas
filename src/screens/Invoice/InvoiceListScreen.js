import { Feather } from '@expo/vector-icons';
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

const STATUS_CFG = {
  paid:    { bg: '#D1FAE5', text: '#065F46', bar: '#16A34A', label: 'PAID'    },
  partial: { bg: '#FEF3C7', text: '#92400E', bar: '#D97706', label: 'PARTIAL' },
  unpaid:  { bg: '#FEE2E2', text: '#991B1B', bar: '#DC2626', label: 'UNPAID'  },
  overdue: { bg: '#FECACA', text: '#7F1D1D', bar: '#7F1D1D', label: 'OVERDUE' },
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
      const total  = data.reduce((s, i) => s + (i.total || 0), 0);
      const unpaid = data.reduce((s, i) => s + Math.max(0, (i.total || 0) - (i.paid || 0)), 0);
      setStats({ total, unpaid, count: data.length });
      apply(data, search, statusFilter);
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const apply = (data, q, status) => {
    let out = data;
    if (q.trim()) {
      const lq = q.toLowerCase();
      out = out.filter(i => i.invoice_number?.toLowerCase().includes(lq) || i.party_name?.toLowerCase().includes(lq));
    }
    if (status !== 'All') out = out.filter(i => resolveStatus(i) === status.toLowerCase());
    setFiltered(out);
  };

  const handleSearch = (q) => { setSearch(q); apply(invoices, q, statusFilter); };
  const handleFilter = (f) => { setStatusFilter(f); apply(invoices, search, f); };
  const onRefresh    = () => { setRefreshing(true); load(); };

  const renderItem = ({ item }) => {
    const st  = resolveStatus(item);
    const cfg = STATUS_CFG[st] || STATUS_CFG.unpaid;
    const bal = (item.total || 0) - (item.paid || 0);

    return (
      <TouchableOpacity
        style={[styles.card, { borderLeftColor: cfg.bar }]}
        onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: item.id })}
        activeOpacity={0.82}
      >
        <View style={styles.cardBody}>
          <View style={styles.cardLeft}>
            <Text style={styles.invoiceNo}>{item.invoice_number}</Text>
            <Text style={styles.party} numberOfLines={1}>{item.party_name || 'Walk-in Customer'}</Text>
            <View style={styles.cardMeta}>
              <Text style={styles.date}>{item.date}</Text>
              {item.due_date && st !== 'paid' && (
                <Text style={[styles.due, st === 'overdue' && styles.dueRed]}>Due {item.due_date}</Text>
              )}
            </View>
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.total}>{formatINR(item.total)}</Text>
            <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
            </View>
            {bal > 0.01 && st !== 'paid' && (
              <Text style={[styles.bal, { color: cfg.text }]}>{formatINR(bal)}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.card} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Invoices</Text>
          <Text style={styles.headerSub}>{stats.count} total records</Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={() => navigation.navigate('CreateInvoice')} activeOpacity={0.85}>
          <Text style={styles.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Metrics bar */}
      <View style={styles.metricsBar}>
        <MetricCell label="Total Sales"  value={formatINRCompact(stats.total)}  color={COLORS.primary} />
        <View style={styles.metricSep} />
        <MetricCell label="Outstanding"  value={formatINRCompact(stats.unpaid)} color={COLORS.danger} />
        <View style={styles.metricSep} />
        <MetricCell label="Count"        value={String(stats.count)}            color={COLORS.info} />
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Feather name="search" size={17} color={COLORS.textMute} style={{marginRight:8}} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by invoice # or party name..."
          placeholderTextColor={COLORS.textMute}
          value={search}
          onChangeText={handleSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')} style={styles.clearBtn}>
            <Feather name="x" size={14} color={COLORS.textMute} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity key={f} style={[styles.chip, statusFilter === f && styles.chipOn]} onPress={() => handleFilter(f)} activeOpacity={0.8}>
            <Text style={[styles.chipText, statusFilter === f && styles.chipTextOn]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}><Feather name="file-text" size={32} color={COLORS.primary} /></View>
            <Text style={styles.emptyTitle}>{search || statusFilter !== 'All' ? 'No results' : 'No invoices yet'}</Text>
            <Text style={styles.emptySub}>{search || statusFilter !== 'All' ? 'Try a different filter' : 'Tap + New to create your first invoice'}</Text>
            {!search && statusFilter === 'All' && (
              <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('CreateInvoice')}>
                <Text style={styles.emptyBtnText}>+ Create Invoice</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}

function MetricCell({ label, value, color }) {
  return (
    <View style={styles.metricCell}>
      <Text style={[styles.metricVal, { color }]}>{value}</Text>
      <Text style={styles.metricLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 20, fontWeight: FONTS.black, color: COLORS.text },
  headerSub:   { fontSize: 11, color: COLORS.textMute, marginTop: 1 },
  newBtn:      { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md, ...SHADOW.brand },
  newBtnText:  { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },

  metricsBar:  { flexDirection: 'row', backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  metricCell:  { flex: 1, alignItems: 'center', paddingVertical: 10 },
  metricVal:   { fontSize: 15, fontWeight: FONTS.black },
  metricLbl:   { fontSize: 10, color: COLORS.textMute, marginTop: 2, fontWeight: FONTS.medium },
  metricSep:   { width: 1, backgroundColor: COLORS.border, marginVertical: 8 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    margin: 12, marginBottom: 0,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  searchIco:   { fontSize: 18, color: COLORS.textMute, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 10 },
  clearBtn:    { padding: 4 },
  clearText:   { fontSize: 13, color: COLORS.textMute },

  filterRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip:      { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  chipOn:    { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  chipText:  { fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.medium },
  chipTextOn:{ color: '#fff', fontWeight: FONTS.bold },

  list: { padding: 12, paddingBottom: 90 },

  card: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 8, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
    borderLeftWidth: 4, ...SHADOW.xs,
  },
  cardBody:  { padding: 14, flexDirection: 'row', justifyContent: 'space-between' },
  cardLeft:  { flex: 1, marginRight: 12 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  invoiceNo: { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 3 },
  party:     { fontSize: 13, color: COLORS.textSub, marginBottom: 5 },
  cardMeta:  { flexDirection: 'row', gap: 6, alignItems: 'center' },
  date:      { fontSize: 11, color: COLORS.textMute },
  due:       { fontSize: 11, color: COLORS.warning, fontWeight: FONTS.medium },
  dueRed:    { color: COLORS.danger },
  total:     { fontSize: 16, fontWeight: FONTS.black, color: COLORS.text },
  badge:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.xs },
  badgeText: { fontSize: 9, fontWeight: FONTS.black, letterSpacing: 0.5 },
  bal:       { fontSize: 11, fontWeight: FONTS.bold },

  empty:        { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIconWrap:{ width: 72, height: 72, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyIcon:    { fontSize: 32 },
  emptyTitle:   { fontSize: 17, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 7, textAlign: 'center' },
  emptySub:     { fontSize: 13, color: COLORS.textMute, textAlign: 'center', lineHeight: 19, marginBottom: 22 },
  emptyBtn:     { backgroundColor: COLORS.primary, paddingHorizontal: 22, paddingVertical: 11, borderRadius: RADIUS.lg, ...SHADOW.brand },
  emptyBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
});