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
  Purchase: '🛒', Rent: '🏠', Salary: '👷', Electricity: '⚡',
  Transport: '🚚', 'Office Supplies': '📎', Maintenance: '🔧',
  Marketing: '📣', Insurance: '🛡️', Fuel: '⛽', Food: '🍱', Other: '💼',
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
          <Text style={styles.catIcon}>{CATEGORY_ICONS[item.category] || '💼'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.category}>{item.category}</Text>
          {item.party_name ? <Text style={styles.expSub}>{item.party_name}</Text> : null}
          {item.bill_no    ? <Text style={styles.expSub}>Bill: {item.bill_no}</Text> : null}
          <Text style={styles.expMeta}>{item.date}  ·  {item.method}</Text>
          {item.note       ? <Text style={styles.expNote} numberOfLines={1}>{item.note}</Text> : null}
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.expAmount}>{formatINR(item.amount)}</Text>
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
              <Text style={styles.editIcon}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.delBtn} onPress={() => handleDelete(item)}>
              <Text style={styles.delIcon}>🗑️</Text>
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
          <Text style={styles.backIcon}>←</Text>
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
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search category, party, note..."
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
              {c !== 'All' && <Text style={styles.catChipIcon}>{CATEGORY_ICONS[c] || '💼'}</Text>}
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
            <Text style={styles.emptyIcon}>💸</Text>
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
                  <Text style={styles.catGridIcon}>{CATEGORY_ICONS[c] || '💼'}</Text>
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
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn:     { padding: 4 },
  backIcon:    { fontSize: 22, color: COLORS.primary },
  headerTitle: { fontSize: 20, fontWeight: FONTS.heavy, color: COLORS.text },
  addBtn:      { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.md },
  addBtnText:  { color: COLORS.white, fontWeight: FONTS.bold, fontSize: 14 },

  statsStrip: {
    flexDirection: 'row', backgroundColor: COLORS.card,
    paddingVertical: 12, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  statChip:  { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 15, fontWeight: FONTS.heavy },
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

  catScroll:        { maxHeight: 48 },
  catScrollContent: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  catChip:          { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  catChipActive:    { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catChipIcon:      { fontSize: 13 },
  catChipText:      { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  catChipTextActive:{ color: COLORS.white, fontWeight: FONTS.bold },

  list: { padding: 12, paddingTop: 8, paddingBottom: 80 },

  expenseCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 10, ...SHADOW.sm, overflow: 'hidden',
  },
  cardMain: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  iconBox:  { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: '#FFF0E6', alignItems: 'center', justifyContent: 'center' },
  catIcon:  { fontSize: 22 },

  category:  { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 2 },
  expSub:    { fontSize: 12, color: COLORS.textSub, marginTop: 1 },
  expMeta:   { fontSize: 11, color: COLORS.textMute, marginTop: 3 },
  expNote:   { fontSize: 12, color: COLORS.textSub, marginTop: 2, fontStyle: 'italic' },

  cardRight:   { alignItems: 'flex-end', minWidth: 80 },
  expAmount:   { fontSize: 17, fontWeight: FONTS.heavy, color: COLORS.danger, marginBottom: 4 },
  cardActions: { flexDirection: 'row', gap: 4 },
  editBtn:     { padding: 6 },
  editIcon:    { fontSize: 16 },
  delBtn:      { padding: 6 },
  delIcon:     { fontSize: 16 },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon:   { fontSize: 56, marginBottom: 16 },
  emptyTitle:  { fontSize: 18, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  emptySub:    { fontSize: 14, color: COLORS.textMute, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn:    { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.lg },
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
  row:      { flexDirection: 'row', alignItems: 'flex-start' },

  catGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  catGridItem:     { width: '30%', alignItems: 'center', paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.border },
  catGridItemActive:{ borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  catGridIcon:     { fontSize: 22, marginBottom: 4 },
  catGridText:     { fontSize: 11, color: COLORS.textSub, textAlign: 'center', fontWeight: FONTS.medium },
  catGridTextActive:{ color: COLORS.primary, fontWeight: FONTS.bold },

  methodRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  methodChip:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  methodChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  methodText:       { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  methodTextActive: { color: COLORS.primary, fontWeight: FONTS.bold },
});