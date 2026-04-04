import Icon from '../../utils/Icon';
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getPurchaseOrders } from '../../db';
import { COLORS, RADIUS, FONTS, SHADOW } from '../../theme';

const STATUS_META = {
  active:    { label: 'Active',    bg: '#DBEAFE', text: '#1E40AF' },
  partial:   { label: 'Partial',   bg: '#FEF3C7', text: '#92400E' },
  completed: { label: 'Completed', bg: '#D1FAE5', text: '#065F46' },
  cancelled: { label: 'Cancelled', bg: '#F3F4F6', text: '#6B7280' },
};

export default function POListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all'); // all | active | partial | completed

  const load = async () => {
    try {
      const all = await getPurchaseOrders();
      setOrders(all);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const filtered = orders.filter(po => {
    const matchSearch = !search ||
      po.po_number?.toLowerCase().includes(search.toLowerCase()) ||
      po.party_name?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || po.status === filter;
    return matchSearch && matchFilter;
  });

  const counts = {
    all:       orders.length,
    active:    orders.filter(p => p.status === 'active').length,
    partial:   orders.filter(p => p.status === 'partial').length,
    completed: orders.filter(p => p.status === 'completed').length,
  };

  if (loading) return (
    <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Purchase Orders</Text>
          <Text style={styles.headerSub}>{counts.active} active · {counts.partial} partial</Text>
        </View>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => navigation.navigate('CreatePO')}
        >
          <Icon name="plus" size={16} color="#fff" />
          <Text style={styles.newBtnText}>New PO</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Icon name="search" size={16} color={COLORS.textMute} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by PO number or customer..."
          placeholderTextColor={COLORS.textMute}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Icon name="x" size={16} color={COLORS.textMute} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {['all','active','partial','completed'].map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, filter === f && styles.chipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f] || 0})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list}>
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="file-text" size={40} color={COLORS.textMute} />
            <Text style={styles.emptyTitle}>
              {search ? 'No results found' : 'No purchase orders yet'}
            </Text>
            <Text style={styles.emptySub}>
              {search ? 'Try a different search' : 'Create a PO when a customer sends you an order list'}
            </Text>
            {!search && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('CreatePO')}
              >
                <Text style={styles.emptyBtnText}>Create First PO</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filtered.map(po => <POCard key={po.id} po={po} onPress={() => navigation.navigate('PODetail', { poId: po.id })} />)
        )}
      </ScrollView>
    </View>
  );
}

function POCard({ po, onPress }) {
  const sm = STATUS_META[po.status] || STATUS_META.active;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.poNum}>{po.po_number}</Text>
          <Text style={styles.partyName}>{po.party_name || 'Unknown Customer'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: sm.bg }]}>
          <Text style={[styles.statusText, { color: sm.text }]}>{sm.label}</Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <Icon name="calendar" size={12} color={COLORS.textMute} />
          <Text style={styles.metaText}>{po.date}</Text>
        </View>
        {po.valid_until ? (
          <View style={styles.metaItem}>
            <Icon name="clock" size={12} color={COLORS.textMute} />
            <Text style={styles.metaText}>Valid till {po.valid_until}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center:    { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 20, fontWeight: FONTS.black, color: COLORS.text },
  headerSub:   { fontSize: 12, color: COLORS.textMute, marginTop: 1 },
  newBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.md },
  newBtnText:  { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, paddingHorizontal: 12, height: 42,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  filterRow:   { paddingLeft: 12, paddingBottom: 8, flexGrow: 0 },
  chip:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, marginRight: 8 },
  chipActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:    { fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.medium },
  chipTextActive: { color: '#fff', fontWeight: FONTS.bold },
  list: { padding: 12, paddingTop: 4, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginBottom: 10,
    borderLeftWidth: 4, borderLeftColor: COLORS.primary,
  },
  cardTop:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  poNum:     { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 2 },
  partyName: { fontSize: 13, color: COLORS.textSub },
  statusBadge:{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText: { fontSize: 10, fontWeight: FONTS.bold },
  cardMeta:  { flexDirection: 'row', gap: 14 },
  metaItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:  { fontSize: 11, color: COLORS.textMute },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle:{ fontSize: 17, fontWeight: FONTS.bold, color: COLORS.text, marginTop: 16, marginBottom: 6, textAlign: 'center' },
  emptySub:  { fontSize: 13, color: COLORS.textMute, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn:  { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.lg },
  emptyBtnText:{ color: '#fff', fontWeight: FONTS.bold, fontSize: 14 },
});
