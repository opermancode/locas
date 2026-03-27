import Icon from '../../utils/Icon';
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
          {item.phone ? <View style={styles.subRow}><Icon name="phone" size={11} color={COLORS.textMute} /><Text style={styles.partySub}> {item.phone}</Text></View> : null}
          {item.gstin   ? <Text style={styles.partySub}>GST: {item.gstin}</Text> : null}
          {item.state ? <View style={styles.subRow}><Icon name="map-pin" size={11} color={COLORS.textMute} /><Text style={styles.partySub}> {item.state}</Text></View> : null}
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
            <Icon name="edit-2" size={14} color={COLORS.textSub} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.delBtn} onPress={() => handleDelete(item)}>
            <Icon name="trash-2" size={14} color={COLORS.danger} />
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
        <Icon name="search" size={17} color={COLORS.textMute} style={{marginRight:8}} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, phone, GSTIN..."
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
            <Icon name="users" size={32} color={COLORS.primary} />
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
                    {t === 'customer' ? 'Customer' : 'Supplier'}
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
              <Icon name="chevron-down" size={16} color={COLORS.textMute} />
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