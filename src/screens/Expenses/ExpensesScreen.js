import Icon from '../../utils/Icon';
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert, RefreshControl, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getExpenses, saveExpense, deleteExpense } from '../../db';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, formatINR, formatINRCompact, today } from '../../utils/gst';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';

const EMPTY_FORM = {
  category: 'Other', amount: '', date: today(),
  party_name: '', bill_no: '', method: 'Cash', note: '',
};

const CATEGORY_ICONS = {
  Purchase: 'shopping-cart', Rent: 'home', Salary: 'users', Electricity: 'zap',
  Transport: 'truck', 'Office Supplies': 'paperclip', Maintenance: 'tool',
  Marketing: 'radio', Insurance: 'shield', Fuel: 'droplet', Food: 'coffee', Other: 'briefcase',
};

export default function ExpensesScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  const [expenses, setExpenses]   = useState([]);
  const [filtered, setFiltered]   = useState([]);
  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await getExpenses();
      setExpenses(data);
      apply(data, search, catFilter);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => {
    load();
    if (route?.params?.openAdd) {
      setForm(EMPTY_FORM);
      setModal(true);
      navigation.setParams({ openAdd: false });
    }
  }, []));

  const apply = (data, q, cat) => {
    let out = data;
    if (q.trim()) {
      const lq = q.toLowerCase();
      out = out.filter(e =>
        (e.category   || '').toLowerCase().includes(lq) ||
        (e.party_name || '').toLowerCase().includes(lq) ||
        (e.bill_no    || '').toLowerCase().includes(lq) ||
        (e.note       || '').toLowerCase().includes(lq)
      );
    }
    if (cat !== 'All') out = out.filter(e => e.category === cat);
    setFiltered(out);
  };

  const handleSearch = (q) => { setSearch(q); apply(expenses, q, catFilter); };
  const handleCat    = (c) => { setCatFilter(c); apply(expenses, search, c); };
  const onRefresh    = ()  => { setRefreshing(true); load(); };

  const openAdd  = () => { setForm({ ...EMPTY_FORM, date: today() }); setModal(true); };
  const openEdit = (e) => {
    setForm({
      id:         e.id,
      category:   e.category   || 'Other',
      amount:     String(e.amount),
      date:       e.date,
      party_name: e.party_name || '',
      bill_no:    e.bill_no    || '',
      method:     e.method     || 'Cash',
      note:       e.note       || '',
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) { Alert.alert('Error', 'Enter a valid amount'); return; }
    if (!form.date.trim())                             { Alert.alert('Error', 'Date is required');    return; }
    setSaving(true);
    try {
      await saveExpense({ ...form, amount: parseFloat(form.amount) });
      setModal(false);
      load();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (e) => {
    Alert.alert('Delete Expense', `Delete ₹${e.amount} — ${e.category}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteExpense(e.id);
        load();
      }},
    ]);
  };

  // ── Stats ─────────────────────────────────────────────────────
  const totalAmt  = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const thisMonth = (() => {
    const now = new Date();
    const mm  = String(now.getMonth() + 1).padStart(2, '0');
    const yy  = String(now.getFullYear());
    return expenses
      .filter(e => e.date?.startsWith(`${yy}-${mm}`))
      .reduce((s, e) => s + (e.amount || 0), 0);
  })();

  // ── By category breakdown ─────────────────────────────────────
  const byCat = EXPENSE_CATEGORIES.reduce((acc, c) => {
    const sum = expenses.filter(e => e.category === c).reduce((s, e) => s + (e.amount || 0), 0);
    if (sum > 0) acc.push({ category: c, sum });
    return acc;
  }, []).sort((a, b) => b.sum - a.sum);

  const allCats = ['All', ...byCat.map(b => b.category)];

  // ── Render expense row ────────────────────────────────────────
  const renderExpense = ({ item }) => (
    <View style={styles.expenseCard}>
      <View style={styles.cardMain}>
        <View style={styles.iconBox}>
          <Icon name={CATEGORY_ICONS[item.category] || 'briefcase'} size={18} color={COLORS.textSub} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.category}>{item.category}</Text>
          {item.party_name ? <Text style={styles.expSub}>{item.party_name}</Text> : null}
          {item.bill_no    ? <Text style={styles.expSub}>Bill: {item.bill_no}</Text> : null}
          <Text style={styles.expMeta}>{item.date}  —  {item.method}</Text>
          {item.note       ? <Text style={styles.expNote} numberOfLines={1}>{item.note}</Text> : null}
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.expAmount}>{formatINR(item.amount)}</Text>
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
              <Icon name="edit-2" size={14} color={COLORS.textSub} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.delBtn} onPress={() => handleDelete(item)}>
              <Icon name="trash-2" size={14} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  // ─────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expenses</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Stats strip */}
      <View style={styles.statsStrip}>
        <StatChip label="All Time"    value={formatINRCompact(totalAmt)}  color={COLORS.danger} />
        <View style={styles.div} />
        <StatChip label="This Month"  value={formatINRCompact(thisMonth)} color={COLORS.warning} />
        <View style={styles.div} />
        <StatChip label="Entries"     value={String(expenses.length)}     color={COLORS.secondary} />
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Icon name="search" size={17} color={COLORS.textMute} style={{marginRight:8}} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search category, party, note..."
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

      {/* Category chips */}
      {byCat.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.catScroll}
          contentContainerStyle={styles.catScrollContent}
        >
          {allCats.map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.catChip, catFilter === c && styles.catChipActive]}
              onPress={() => handleCat(c)}
            >
              
              <Text style={[styles.catChipText, catFilter === c && styles.catChipTextActive]}>
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={i => String(i.id)}
        renderItem={renderExpense}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="credit-card" size={32} color={COLORS.primary} />
            <Text style={styles.emptyTitle}>{search ? 'No expenses found' : 'No expenses yet'}</Text>
            <Text style={styles.emptySub}>{search ? 'Try a different search' : 'Track your business expenses'}</Text>
            {!search && (
              <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
                <Text style={styles.emptyBtnText}>Add Expense</Text>
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
            <Text style={styles.modalTitle}>{form.id ? 'Edit Expense' : 'Add Expense'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Text style={[styles.modalSave, saving && { opacity: 0.4 }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">

            {/* Category grid */}
            <FieldLabel>Category</FieldLabel>
            <View style={styles.catGrid}>
              {EXPENSE_CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.catGridItem, form.category === c && styles.catGridItemActive]}
                  onPress={() => setForm(f => ({ ...f, category: c }))}
                >
                  <Icon name={CATEGORY_ICONS[c] || 'briefcase'} size={22} color={COLORS.primary} />
                  <Text style={[styles.catGridText, form.category === c && styles.catGridTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Amount (₹) *</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={form.amount}
                  onChangeText={v => setForm(f => ({ ...f, amount: v }))}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.textMute}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <FieldLabel>Date *</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={form.date}
                  onChangeText={v => setForm(f => ({ ...f, date: v }))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.textMute}
                />
              </View>
            </View>

            <FieldLabel>Payment Method</FieldLabel>
            <View style={styles.methodRow}>
              {PAYMENT_METHODS.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.methodChip, form.method === m && styles.methodChipActive]}
                  onPress={() => setForm(f => ({ ...f, method: m }))}
                >
                  <Text style={[styles.methodText, form.method === m && styles.methodTextActive]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <FieldLabel>Party / Vendor</FieldLabel>
            <TextInput
              style={styles.input}
              value={form.party_name}
              onChangeText={v => setForm(f => ({ ...f, party_name: v }))}
              placeholder="Vendor or supplier name"
              placeholderTextColor={COLORS.textMute}
            />

            <FieldLabel>Bill / Reference No.</FieldLabel>
            <TextInput
              style={styles.input}
              value={form.bill_no}
              onChangeText={v => setForm(f => ({ ...f, bill_no: v }))}
              placeholder="Bill or invoice number"
              placeholderTextColor={COLORS.textMute}
            />

            <FieldLabel>Note</FieldLabel>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={form.note}
              onChangeText={v => setForm(f => ({ ...f, note: v }))}
              placeholder="Any additional note..."
              placeholderTextColor={COLORS.textMute}
              multiline
              numberOfLines={2}
            />

            <View style={{ height: 40 }} />
          </ScrollView>
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