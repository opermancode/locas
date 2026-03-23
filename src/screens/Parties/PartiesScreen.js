import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert, RefreshControl, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getParties, saveParty, deleteParty } from '../../db';
import { INDIAN_STATES, formatINR } from '../../utils/gst';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';

const TYPE_FILTERS = ['All', 'Customer', 'Supplier'];

const EMPTY_FORM = {
  name: '', phone: '', email: '', address: '',
  gstin: '', state: '', state_code: '', pan: '', type: 'customer',
};

export default function PartiesScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [parties, setParties]     = useState([]);
  const [filtered, setFiltered]   = useState([]);
  const [search, setSearch]       = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const [modal, setModal]         = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [stateModal, setStateModal] = useState(false);
  const [stateSearch, setStateSearch] = useState('');

  const load = async () => {
    try {
      const data = await getParties();
      setParties(data);
      apply(data, search, typeFilter);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const apply = (data, q, type) => {
    let out = data;
    if (q.trim()) {
      const lq = q.toLowerCase();
      out = out.filter(p =>
        p.name.toLowerCase().includes(lq) ||
        (p.phone || '').includes(lq) ||
        (p.gstin || '').toLowerCase().includes(lq)
      );
    }
    if (type !== 'All') {
      out = out.filter(p => p.type === type.toLowerCase());
    }
    setFiltered(out);
  };

  const handleSearch = (q) => { setSearch(q); apply(parties, q, typeFilter); };
  const handleFilter = (f) => { setTypeFilter(f); apply(parties, search, f); };
  const onRefresh    = () => { setRefreshing(true); load(); };

  const openAdd  = () => { setForm(EMPTY_FORM); setModal(true); };
  const openEdit = (p) => {
    setForm({
      id: p.id, name: p.name, phone: p.phone || '', email: p.email || '',
      address: p.address || '', gstin: p.gstin || '', state: p.state || '',
      state_code: p.state_code || '', pan: p.pan || '', type: p.type || 'customer',
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Error', 'Party name is required'); return; }
    setSaving(true);
    try {
      await saveParty(form);
      setModal(false);
      load();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (p) => {
    Alert.alert('Delete Party', `Delete ${p.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteParty(p.id);
        load();
      }},
    ]);
  };

  const selectState = (s) => {
    setForm(f => ({ ...f, state: s.name, state_code: s.code }));
    setStateModal(false);
    setStateSearch('');
  };

  const filteredStates = INDIAN_STATES.filter(s =>
    s.name.toLowerCase().includes(stateSearch.toLowerCase()) ||
    s.code.includes(stateSearch)
  );

  const customers = parties.filter(p => p.type === 'customer').length;
  const suppliers = parties.filter(p => p.type === 'supplier').length;

  // ─── Render party card ────────────────────────────────────────
  const renderParty = ({ item }) => (
    <TouchableOpacity
      style={styles.partyCard}
      onPress={() => navigation.navigate('PartyDetail', { partyId: item.id })}
      activeOpacity={0.85}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.avatar, { backgroundColor: item.type === 'supplier' ? '#E0F2FE' : COLORS.primaryLight }]}>
          <Text style={[styles.avatarText, { color: item.type === 'supplier' ? '#0369A1' : COLORS.primary }]}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.partyName} numberOfLines={1}>{item.name}</Text>
          {item.phone   ? <Text style={styles.partySub}>📞 {item.phone}</Text> : null}
          {item.gstin   ? <Text style={styles.partySub}>GST: {item.gstin}</Text> : null}
          {item.state   ? <Text style={styles.partySub}>📍 {item.state}</Text> : null}
        </View>
      </View>
      <View style={styles.cardRight}>
        <View style={[styles.typeBadge, item.type === 'supplier' && styles.typeBadgeSupplier]}>
          <Text style={[styles.typeText, item.type === 'supplier' && styles.typeTextSupplier]}>
            {item.type === 'supplier' ? 'Supplier' : 'Customer'}
          </Text>
        </View>
        {item.balance !== 0 && (
          <Text style={[styles.balance, item.balance < 0 && { color: COLORS.danger }]}>
            {item.balance > 0 ? '+' : ''}{formatINR(item.balance)}
          </Text>
        )}
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
            <Text style={styles.editIcon}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.delBtn} onPress={() => handleDelete(item)}>
            <Text style={styles.delIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  // ─────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Parties</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Stats strip */}
      <View style={styles.statsStrip}>
        <StatChip label="Total"     value={String(parties.length)} color={COLORS.secondary} />
        <View style={styles.div} />
        <StatChip label="Customers" value={String(customers)}      color={COLORS.primary} />
        <View style={styles.div} />
        <StatChip label="Suppliers" value={String(suppliers)}      color={COLORS.info} />
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, phone, GSTIN..."
          placeholderTextColor={COLORS.textMute}
          value={search}
          onChangeText={handleSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Type filter */}
      <View style={styles.filterRow}>
        {TYPE_FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, typeFilter === f && styles.filterChipActive]}
            onPress={() => handleFilter(f)}
          >
            <Text style={[styles.filterText, typeFilter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={i => String(i.id)}
        renderItem={renderParty}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>{search ? 'No parties found' : 'No parties yet'}</Text>
            <Text style={styles.emptySub}>{search ? 'Try a different search' : 'Add customers & suppliers'}</Text>
            {!search && (
              <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
                <Text style={styles.emptyBtnText}>Add Party</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* ── Add / Edit Modal ───────────────────────────────── */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{form.id ? 'Edit Party' : 'Add Party'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Text style={[styles.modalSave, saving && { opacity: 0.4 }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">

            {/* Type toggle */}
            <FieldLabel>Type</FieldLabel>
            <View style={styles.typeRow}>
              {['customer', 'supplier'].map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, form.type === t && styles.typeBtnActive]}
                  onPress={() => setForm(f => ({ ...f, type: t }))}
                >
                  <Text style={[styles.typeBtnText, form.type === t && styles.typeBtnTextActive]}>
                    {t === 'customer' ? '🧑 Customer' : '🏭 Supplier'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <FieldLabel>Name *</FieldLabel>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={v => setForm(f => ({ ...f, name: v }))}
              placeholder="Full name or business name"
              placeholderTextColor={COLORS.textMute}
            />

            <FieldLabel>Phone</FieldLabel>
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={v => setForm(f => ({ ...f, phone: v }))}
              placeholder="Mobile number"
              placeholderTextColor={COLORS.textMute}
              keyboardType="phone-pad"
            />

            <FieldLabel>Email</FieldLabel>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={v => setForm(f => ({ ...f, email: v }))}
              placeholder="email@example.com"
              placeholderTextColor={COLORS.textMute}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <FieldLabel>Address</FieldLabel>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={form.address}
              onChangeText={v => setForm(f => ({ ...f, address: v }))}
              placeholder="Full address"
              placeholderTextColor={COLORS.textMute}
              multiline
              numberOfLines={2}
            />

            <FieldLabel>State</FieldLabel>
            <TouchableOpacity
              style={[styles.input, styles.statePicker]}
              onPress={() => { setStateSearch(''); setStateModal(true); }}
            >
              <Text style={form.state ? styles.stateText : styles.statePlaceholder}>
                {form.state ? `${form.state} (${form.state_code})` : 'Select state...'}
              </Text>
              <Text style={styles.stateArrow}>▾</Text>
            </TouchableOpacity>

            <FieldLabel>GSTIN</FieldLabel>
            <TextInput
              style={styles.input}
              value={form.gstin}
              onChangeText={v => setForm(f => ({ ...f, gstin: v.toUpperCase() }))}
              placeholder="22AAAAA0000A1Z5"
              placeholderTextColor={COLORS.textMute}
              autoCapitalize="characters"
              maxLength={15}
            />

            <FieldLabel>PAN</FieldLabel>
            <TextInput
              style={styles.input}
              value={form.pan}
              onChangeText={v => setForm(f => ({ ...f, pan: v.toUpperCase() }))}
              placeholder="AAAAA0000A"
              placeholderTextColor={COLORS.textMute}
              autoCapitalize="characters"
              maxLength={10}
            />

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ── State Picker Modal ─────────────────────────────── */}
      <Modal visible={stateModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setStateModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select State</Text>
            <View style={{ width: 60 }} />
          </View>
          <View style={styles.stateSearchBox}>
            <TextInput
              style={styles.input}
              value={stateSearch}
              onChangeText={setStateSearch}
              placeholder="Search state..."
              placeholderTextColor={COLORS.textMute}
              autoFocus
            />
          </View>
          <FlatList
            data={filteredStates}
            keyExtractor={s => s.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.stateItem} onPress={() => selectState(item)}>
                <Text style={styles.stateName}>{item.name}</Text>
                <Text style={styles.stateCode}>{item.code}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function StatChip({ label, value, color }) {
  return (
    <View style={styles.statChip}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FieldLabel({ children }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 20, fontWeight: FONTS.heavy, color: COLORS.text },
  addBtn:      { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.md },
  addBtnText:  { color: COLORS.white, fontWeight: FONTS.bold, fontSize: 14 },

  statsStrip: {
    flexDirection: 'row', backgroundColor: COLORS.card,
    paddingVertical: 12, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  statChip:  { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: FONTS.heavy },
  statLabel: { fontSize: 11, color: COLORS.textMute, marginTop: 2 },
  div:       { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, margin: 12, marginBottom: 8,
    borderRadius: RADIUS.md, paddingHorizontal: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchIcon:  { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 10 },
  clearBtn:    { fontSize: 16, color: COLORS.textMute, padding: 4 },

  filterRow: { flexDirection: 'row', paddingHorizontal: 12, marginBottom: 8, gap: 8 },
  filterChip:       { paddingHorizontal: 18, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText:       { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  filterTextActive: { color: COLORS.white, fontWeight: FONTS.bold },

  list: { padding: 12, paddingTop: 4, paddingBottom: 80 },

  partyCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 10, padding: 14,
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', ...SHADOW.sm,
  },
  cardLeft:  { flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 12 },
  cardRight: { alignItems: 'flex-end', gap: 6, marginLeft: 8 },

  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: FONTS.heavy },

  partyName: { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 3 },
  partySub:  { fontSize: 12, color: COLORS.textSub, marginTop: 1 },

  typeBadge:         { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight },
  typeBadgeSupplier: { backgroundColor: '#E0F2FE' },
  typeText:          { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.primary },
  typeTextSupplier:  { color: '#0369A1' },

  balance: { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.success },

  cardActions: { flexDirection: 'row', gap: 4, marginTop: 2 },
  editBtn:     { padding: 6 },
  editIcon:    { fontSize: 16 },
  delBtn:      { padding: 6 },
  delIcon:     { fontSize: 16 },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon:  { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  emptySub:   { fontSize: 14, color: COLORS.textMute, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn:   { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.lg },
  emptyBtnText:{ color: COLORS.white, fontWeight: FONTS.bold, fontSize: 15 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle:  { fontSize: 17, fontWeight: FONTS.bold, color: COLORS.text },
  modalCancel: { fontSize: 15, color: COLORS.textSub },
  modalSave:   { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.primary },
  modalScroll: { padding: 16 },

  fieldLabel: {
    fontSize: 12, fontWeight: FONTS.semibold, color: COLORS.textSub,
    marginBottom: 6, marginTop: 14,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  input: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: COLORS.text,
  },
  textarea: { minHeight: 60, textAlignVertical: 'top' },

  typeRow:          { flexDirection: 'row', gap: 12, marginBottom: 4 },
  typeBtn:          { flex: 1, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.card },
  typeBtnActive:    { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  typeBtnText:      { fontSize: 14, color: COLORS.textSub, fontWeight: FONTS.medium },
  typeBtnTextActive:{ color: COLORS.primary, fontWeight: FONTS.bold },

  statePicker:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stateText:       { fontSize: 14, color: COLORS.text },
  statePlaceholder:{ fontSize: 14, color: COLORS.textMute },
  stateArrow:      { fontSize: 14, color: COLORS.textMute },

  stateSearchBox: { padding: 12, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stateItem:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.card },
  stateName:      { fontSize: 15, color: COLORS.text, fontWeight: FONTS.medium },
  stateCode:      { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.bold },
});