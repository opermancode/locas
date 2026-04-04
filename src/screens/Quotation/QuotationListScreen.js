import Icon from '../../utils/Icon';
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, Platform, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getQuotations } from '../../db';
import { formatINR } from '../../utils/gst';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';

const STATUS_CONFIG = {
  draft:     { label: 'Draft',     color: COLORS.textMute, bg: COLORS.bg },
  sent:      { label: 'Sent',      color: COLORS.info,     bg: COLORS.infoLight },
  converted: { label: 'Converted', color: COLORS.success,  bg: COLORS.successLight },
};

export default function QuotationListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [quotations, setQuotations] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, draft, sent, converted

  const isDesktop = Platform.OS === 'web' && Dimensions.get('window').width >= 768;

  const load = async () => {
    try {
      const filters = {};
      if (filter !== 'all') filters.status = filter;
      if (search.trim()) filters.search = search.trim();
      const data = await getQuotations(filters);
      setQuotations(data);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [filter, search]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const isExpired = (validUntil) => {
    if (!validUntil) return false;
    return new Date(validUntil) < new Date();
  };

  const renderQuotation = ({ item }) => {
    const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
    const expired = item.status === 'draft' && isExpired(item.valid_until);
    
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('QuotationDetail', { id: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.quoteNumber}>{item.quote_number}</Text>
            <Text style={styles.partyName} numberOfLines={1}>
              {item.party_name || 'No party'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.total}>{formatINR(item.total)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: expired ? COLORS.warningLight : status.bg }]}>
              <Text style={[styles.statusText, { color: expired ? COLORS.warning : status.color }]}>
                {expired ? 'Expired' : status.label}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.cardBottom}>
          <View style={styles.dateRow}>
            <Icon name="calendar" size={12} color={COLORS.textMute} />
            <Text style={styles.dateText}>{item.date}</Text>
          </View>
          {item.valid_until && (
            <View style={styles.dateRow}>
              <Icon name="clock" size={12} color={expired ? COLORS.warning : COLORS.textMute} />
              <Text style={[styles.dateText, expired && { color: COLORS.warning }]}>
                Valid: {item.valid_until}
              </Text>
            </View>
          )}
        </View>
        
        {item.status === 'converted' && item.converted_invoice_id && (
          <View style={styles.convertedRow}>
            <Icon name="check-circle" size={12} color={COLORS.success} />
            <Text style={styles.convertedText}>Converted to Invoice</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Draft' },
    { key: 'sent', label: 'Sent' },
    { key: 'converted', label: 'Converted' },
  ];

  return (
    <View style={[styles.container, { paddingTop: isDesktop ? 0 : insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Quotations</Text>
          <Text style={styles.headerSub}>{quotations.length} quotation{quotations.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('CreateQuotation')}
        >
          <Icon name="plus" size={18} color="#fff" />
          <Text style={styles.addBtnText}>New Quote</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Icon name="search" size={16} color={COLORS.textMute} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search quotations..."
            placeholderTextColor={COLORS.textMute}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon name="x" size={16} color={COLORS.textMute} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={quotations}
        renderItem={renderQuotation}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        windowSize={5}
        maxToRenderPerBatch={10}
        initialNumToRender={12}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="file-text" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>No quotations yet</Text>
            <Text style={styles.emptySub}>
              Create your first quotation and convert it to an invoice when accepted
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('CreateQuotation')}
            >
              <Text style={styles.emptyBtnText}>Create Quotation</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 22, fontWeight: FONTS.black, color: COLORS.text },
  headerSub: { fontSize: 12, color: COLORS.textMute, marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  addBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
  
  searchRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  
  filterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: RADIUS.full, backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  filterText: { fontSize: 12, fontWeight: FONTS.medium, color: COLORS.textSub },
  filterTextActive: { color: COLORS.primary, fontWeight: FONTS.bold },
  
  list: { padding: 16, paddingTop: 4 },
  
  card: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  quoteNumber: { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 4 },
  partyName: { fontSize: 13, color: COLORS.textSub, maxWidth: 180 },
  total: { fontSize: 17, fontWeight: FONTS.black, color: COLORS.text, marginBottom: 6 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.sm },
  statusText: { fontSize: 11, fontWeight: FONTS.bold, textTransform: 'uppercase' },
  
  cardBottom: { flexDirection: 'row', gap: 16 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateText: { fontSize: 12, color: COLORS.textMute },
  
  convertedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  convertedText: { fontSize: 12, color: COLORS.success, fontWeight: FONTS.medium },
  
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: {
    width: 70, height: 70, borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 8 },
  emptySub: { fontSize: 13, color: COLORS.textMute, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: RADIUS.md },
  emptyBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 14 },
});
