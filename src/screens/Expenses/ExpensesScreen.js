import Icon from '../../utils/Icon';
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert, RefreshControl, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getExpenses, saveExpense, deleteExpense, getParties } from '../../db';
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

  // ── Supplier picker state ─────────────────────────────────────
  const [suppliers, setSuppliers]           = useState([]);
  const [supplierModal, setSupplierModal]   = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');

  // ── Date Picker state ─────────────────────────────────────────
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [calYear, setCalYear]   = useState('');
  const [calMonth, setCalMonth] = useState('');
  const [calDay, setCalDay]     = useState('');
  const [calViewYear, setCalViewYear]   = useState(new Date().getFullYear());
  const [calViewMonth, setCalViewMonth] = useState(new Date().getMonth());

  const load = async () => {
    try {
      const [data, sups] = await Promise.all([getExpenses(), getParties('supplier')]);
      setExpenses(data);
      setSuppliers(sups);
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
  );

  // ── Date Picker helpers ───────────────────────────────────────
  const EXP_MONTH_NAMES = ['January','February','March','April','May','June',
                           'July','August','September','October','November','December'];

  const openExpDatePicker = () => {
    const parts = (form.date || '').split('-');
    const y = parseInt(parts[0]) || new Date().getFullYear();
    const m = parseInt(parts[1]) || new Date().getMonth() + 1;
    const d = parseInt(parts[2]) || new Date().getDate();
    setCalYear(String(y));
    setCalMonth(String(m).padStart(2, '0'));
    setCalDay(String(d).padStart(2, '0'));
    setCalViewYear(y);
    setCalViewMonth(m - 1);
    setDatePickerVisible(true);
  };

  const confirmExpDatePicker = () => {
    const y = parseInt(calYear), m = parseInt(calMonth), d = parseInt(calDay);
    if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) {
      Alert.alert('Invalid Date', 'Please enter a valid date.');
      return;
    }
    const formatted = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    setForm(f => ({ ...f, date: formatted }));
    setDatePickerVisible(false);
  };

  const selectExpCalDay = (day) => {
    setCalDay(String(day).padStart(2,'0'));
    setCalYear(String(calViewYear));
    setCalMonth(String(calViewMonth + 1).padStart(2,'0'));
  };

  const getExpCalendarGrid = () => {
    const total = new Date(calViewYear, calViewMonth + 1, 0).getDate();
    const first = new Date(calViewYear, calViewMonth, 1).getDay();
    const cells = [...Array(first).fill(null), ...Array.from({length: total}, (_, i) => i + 1)];
    const rows = [];
    for (let r = 0; r < Math.ceil(cells.length / 7); r++) rows.push(cells.slice(r*7, r*7+7));
    return rows;
  };

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
        <View style={styles.catScrollWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
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
        </View>
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
        windowSize={5}
        maxToRenderPerBatch={10}
        initialNumToRender={12}
        removeClippedSubviews={true}
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
                <TouchableOpacity
                  style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                  onPress={openExpDatePicker}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: form.date ? COLORS.text : COLORS.textMute, fontSize: 14 }}>
                    {form.date || 'YYYY-MM-DD'}
                  </Text>
                  <Icon name="calendar" size={15} color={COLORS.primary} />
                </TouchableOpacity>
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
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={form.party_name}
                onChangeText={v => setForm(f => ({ ...f, party_name: v }))}
                placeholder="Type vendor name or pick from list"
                placeholderTextColor={COLORS.textMute}
              />
              {form.category === 'Purchase' && (
                <TouchableOpacity
                  style={{ backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => { setSupplierSearch(''); setSupplierModal(true); }}
                >
                  <Icon name="users" size={16} color={COLORS.primary} />
                </TouchableOpacity>
              )}
            </View>
            {form.party_name ? (
              <TouchableOpacity onPress={() => setForm(f => ({ ...f, party_name: '' }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 }}>
                <Icon name="x" size={11} color={COLORS.textMute} />
                <Text style={{ fontSize: 11, color: COLORS.textMute }}>Clear</Text>
              </TouchableOpacity>
            ) : null}

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

      {/* ══ Expense Date Picker Modal ════════════════════════════ */}
      <Modal visible={datePickerVisible} animationType="fade" transparent presentationStyle="overFullScreen">
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'center', alignItems:'center', padding:20 }}>
          <View style={{ backgroundColor: COLORS.card, borderRadius:18, width:'100%', maxWidth:360, padding:20, elevation:10 }}>

            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <Text style={{ fontSize:16, fontWeight:'700', color:COLORS.text }}>Expense Date</Text>
              <TouchableOpacity onPress={() => setDatePickerVisible(false)}>
                <Icon name="x" size={18} color={COLORS.textMute} />
              </TouchableOpacity>
            </View>

            {/* Manual DD / MM / YYYY inputs */}
            <View style={{ flexDirection:'row', gap:8, marginBottom:16 }}>
              <View style={{ flex:1 }}>
                <Text style={{ fontSize:11, color:COLORS.textMute, marginBottom:4, fontWeight:'600' }}>DAY</Text>
                <TextInput
                  style={{ borderWidth:1, borderColor:COLORS.border, borderRadius:10, paddingHorizontal:10, paddingVertical:8, fontSize:16, color:COLORS.text, textAlign:'center', backgroundColor:COLORS.bg }}
                  value={calDay} onChangeText={v => setCalDay(v.replace(/[^0-9]/g,''))}
                  keyboardType="number-pad" maxLength={2} placeholder="DD" placeholderTextColor={COLORS.textMute}
                />
              </View>
              <View style={{ flex:2 }}>
                <Text style={{ fontSize:11, color:COLORS.textMute, marginBottom:4, fontWeight:'600' }}>MONTH</Text>
                <TextInput
                  style={{ borderWidth:1, borderColor:COLORS.border, borderRadius:10, paddingHorizontal:10, paddingVertical:8, fontSize:16, color:COLORS.text, textAlign:'center', backgroundColor:COLORS.bg }}
                  value={calMonth}
                  onChangeText={v => { const val = v.replace(/[^0-9]/g,''); setCalMonth(val); const m=parseInt(val); if(m>=1&&m<=12) setCalViewMonth(m-1); }}
                  keyboardType="number-pad" maxLength={2} placeholder="MM" placeholderTextColor={COLORS.textMute}
                />
              </View>
              <View style={{ flex:2 }}>
                <Text style={{ fontSize:11, color:COLORS.textMute, marginBottom:4, fontWeight:'600' }}>YEAR</Text>
                <TextInput
                  style={{ borderWidth:1, borderColor:COLORS.border, borderRadius:10, paddingHorizontal:10, paddingVertical:8, fontSize:16, color:COLORS.text, textAlign:'center', backgroundColor:COLORS.bg }}
                  value={calYear}
                  onChangeText={v => { const val = v.replace(/[^0-9]/g,''); setCalYear(val); const y=parseInt(val); if(y>=1900&&y<=2100) setCalViewYear(y); }}
                  keyboardType="number-pad" maxLength={4} placeholder="YYYY" placeholderTextColor={COLORS.textMute}
                />
              </View>
            </View>

            {/* Month nav */}
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <TouchableOpacity onPress={() => { const p=calViewMonth===0?11:calViewMonth-1; if(calViewMonth===0) setCalViewYear(y=>y-1); setCalViewMonth(p); }} style={{ padding:6 }}>
                <Icon name="chevron-left" size={18} color={COLORS.primary} />
              </TouchableOpacity>
              <Text style={{ fontSize:14, fontWeight:'700', color:COLORS.text }}>{EXP_MONTH_NAMES[calViewMonth]} {calViewYear}</Text>
              <TouchableOpacity onPress={() => { const n=calViewMonth===11?0:calViewMonth+1; if(calViewMonth===11) setCalViewYear(y=>y+1); setCalViewMonth(n); }} style={{ padding:6 }}>
                <Icon name="chevron-right" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            {/* Day headers */}
            <View style={{ flexDirection:'row', marginBottom:4 }}>
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                <Text key={d} style={{ flex:1, textAlign:'center', fontSize:11, color:COLORS.textMute, fontWeight:'600' }}>{d}</Text>
              ))}
            </View>

            {/* Calendar grid */}
            {getExpCalendarGrid().map((row, ri) => (
              <View key={ri} style={{ flexDirection:'row', marginBottom:2 }}>
                {row.map((day, ci) => {
                  const isSel = day && parseInt(calDay)===day && parseInt(calMonth)===calViewMonth+1 && parseInt(calYear)===calViewYear;
                  return (
                    <TouchableOpacity key={ci} disabled={!day} onPress={() => day && selectExpCalDay(day)}
                      style={{ flex:1, alignItems:'center', paddingVertical:6, borderRadius:20, backgroundColor: isSel ? COLORS.primary : 'transparent' }}>
                      <Text style={{ fontSize:13, color: !day ? 'transparent' : isSel ? '#fff' : COLORS.text, fontWeight: isSel ? '700' : '400' }}>
                        {day || ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            <View style={{ flexDirection:'row', gap:10, marginTop:16 }}>
              <TouchableOpacity onPress={() => setDatePickerVisible(false)}
                style={{ flex:1, paddingVertical:12, borderRadius:10, borderWidth:1, borderColor:COLORS.border, alignItems:'center' }}>
                <Text style={{ color:COLORS.textSub, fontWeight:'600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmExpDatePicker}
                style={{ flex:1, paddingVertical:12, borderRadius:10, backgroundColor:COLORS.primary, alignItems:'center' }}>
                <Text style={{ color:'#fff', fontWeight:'700' }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ Supplier Picker Modal ══════════════════════════════════ */}
      <Modal visible={supplierModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl, maxHeight: '75%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
              <Text style={{ fontSize: 17, fontWeight: FONTS.black, color: COLORS.text }}>Select Supplier</Text>
              <TouchableOpacity onPress={() => setSupplierModal(false)} style={{ padding: 4 }}>
                <Icon name="x" size={18} color={COLORS.textMute} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, paddingHorizontal: 12, height: 42, backgroundColor: COLORS.bg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border }}>
              <Icon name="search" size={15} color={COLORS.textMute} />
              <TextInput
                style={{ flex: 1, fontSize: 14, color: COLORS.text }}
                value={supplierSearch}
                onChangeText={setSupplierSearch}
                placeholder="Search suppliers..."
                placeholderTextColor={COLORS.textMute}
                autoFocus
              />
            </View>
            <FlatList
              data={suppliers.filter(s =>
                s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
                (s.phone || '').includes(supplierSearch)
              )}
              keyExtractor={s => String(s.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: s }) => (
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.border }}
                  onPress={() => {
                    setForm(f => ({ ...f, party_name: s.name }));
                    setSupplierModal(false);
                  }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.infoLight, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 15, fontWeight: FONTS.black, color: COLORS.info }}>{s.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: FONTS.semibold, color: COLORS.text }}>{s.name}</Text>
                    {s.phone ? <Text style={{ fontSize: 12, color: COLORS.textMute }}>{s.phone}</Text> : null}
                    {s.gstin ? <Text style={{ fontSize: 11, color: COLORS.textMute }}>GSTIN: {s.gstin}</Text> : null}
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', color: COLORS.textMute, padding: 24 }}>
                  {suppliers.length === 0 ? 'No suppliers in your parties list.\nAdd suppliers from the Parties screen.' : 'No suppliers found'}
                </Text>
              }
            />
          </View>
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
  // Layout
  container:  { flex: 1, backgroundColor: COLORS.bg },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:     { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  // Page header — white bar with title + action
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerLeft:  { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: FONTS.black, color: COLORS.text, letterSpacing: -0.3 },
  headerSub:   { fontSize: 12, color: COLORS.textMute, marginTop: 2 },
  headerBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: RADIUS.md, flexDirection: 'row',
    alignItems: 'center', gap: 6,
  },
  headerBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
  addBtn:      { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: RADIUS.md },
  addBtnText:  { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
  newBtn:      { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: RADIUS.md },
  newBtnText:  { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
  backBtn:     { marginRight: 12, padding: 4 },
  saveBtn:     { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: RADIUS.md },
  saveBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },

  // Metric strip — 3 KPIs in a white bar below header
  metricsBar:  { flexDirection: 'row', backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  statsStrip:  { flexDirection: 'row', backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  metricCell:  { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statChip:    { flex: 1, alignItems: 'center', paddingVertical: 8 },
  metricVal:   { fontSize: 16, fontWeight: FONTS.black },
  statValue:   { fontSize: 16, fontWeight: FONTS.black },
  metricLbl:   { fontSize: 10, color: COLORS.textMute, marginTop: 2, fontWeight: FONTS.medium, textTransform: 'uppercase', letterSpacing: 0.4 },
  statLabel:   { fontSize: 10, color: COLORS.textMute, marginTop: 2, fontWeight: FONTS.medium, textTransform: 'uppercase', letterSpacing: 0.4 },
  metricSep:   { width: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  div:         { width: 1, backgroundColor: COLORS.border, marginVertical: 10 },

  // Search bar
  searchWrap:  { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 0 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginTop: 8, marginBottom: 0,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border,
    height: 40,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    margin: 16, marginBottom: 0,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.border,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 0 },
  clearBtn:    { padding: 4 },

  // Filter chips
  filterRow:       { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:            { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  chipOn:          { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  chipText:        { fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.medium },
  chipTextOn:      { color: '#fff', fontWeight: FONTS.bold },
  filterChip:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive:{ backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  filterText:      { fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.medium },
  filterTextActive:{ color: '#fff', fontWeight: FONTS.bold },
  catChip:         { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  catChipActive:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catChipText:     { fontSize: 11, color: COLORS.textSub, fontWeight: FONTS.medium },
  catChipTextActive:{ color: '#fff', fontWeight: FONTS.bold },

  // List
  list: { padding: 12, paddingBottom: 80 },

  // Cards
  card: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  partyCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  itemCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  expCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  invoiceCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
    borderLeftWidth: 4,
  },
  cardMain:   { padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardBody:   { padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardRow:    { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardLeft:   { flex: 1, marginRight: 12 },
  cardRight:  { alignItems: 'flex-end', gap: 4 },
  cardInfo:   { flex: 1 },

  // Card content
  cardName:  { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 3 },
  itemName:  { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 3, flex: 1 },
  partyName: { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 3 },
  cardSub:   { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  itemSub:   { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  partySub:  { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  cardMeta:  { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  nameRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  subRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 4 },

  // Invoice specific
  invoiceNo:   { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 3 },
  invoiceDate: { fontSize: 12, color: COLORS.textMute },
  total:       { fontSize: 17, fontWeight: FONTS.black, color: COLORS.text },
  salePrice:   { fontSize: 16, fontWeight: FONTS.black, color: COLORS.text },
  purchasePrice:{ fontSize: 11, color: COLORS.textMute },
  party:       { fontSize: 13, color: COLORS.textSub, marginBottom: 4 },
  date:        { fontSize: 11, color: COLORS.textMute },
  due:         { fontSize: 11, color: COLORS.warning, fontWeight: FONTS.medium },
  dueRed:      { color: COLORS.danger },
  badge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm },
  badgeText:   { fontSize: 10, fontWeight: FONTS.bold, letterSpacing: 0.3 },
  bal:         { fontSize: 12, fontWeight: FONTS.bold },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm },
  statusText:  { fontSize: 10, fontWeight: FONTS.bold, letterSpacing: 0.3 },

  // Parties specific
  avatar:     { width: 44, height: 44, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 18, fontWeight: FONTS.black, color: '#fff' },
  typeBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm, backgroundColor: COLORS.primaryLight },
  typeBadgeSupplier: { backgroundColor: COLORS.infoLight },
  typeText:   { fontSize: 10, fontWeight: FONTS.bold, color: COLORS.primary },
  typeTextSupplier: { color: COLORS.info },
  balance:    { fontSize: 13, fontWeight: FONTS.heavy, color: COLORS.success },

  // Inventory specific
  lowBadge:   { backgroundColor: COLORS.dangerLight, paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.sm },
  lowText:    { fontSize: 10, fontWeight: FONTS.bold, color: COLORS.danger },
  stockRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12, gap: 10 },
  stockLabel: { fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.medium, flex: 1 },
  minStock:   { fontSize: 11, color: COLORS.textMute },
  stockValue: { fontSize: 12, fontWeight: FONTS.bold, color: COLORS.textSub },

  // Expenses specific
  expAmount:  { fontSize: 16, fontWeight: FONTS.black, color: COLORS.danger },
  expMeta:    { fontSize: 11, color: COLORS.textMute, marginTop: 3 },
  catIcon:    { width: 38, height: 38, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  catLabel:   { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 3 },

  // Action buttons on cards
  cardActions:{ flexDirection: 'row', gap: 6, marginTop: 6 },
  editBtn:    { padding: 7, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgDeep },
  delBtn:     { padding: 7, borderRadius: RADIUS.sm, backgroundColor: COLORS.dangerLight },

  // Modal — bottom sheet
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl,
    maxHeight: '92%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderDark, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  modalTitle:  { fontSize: 16, fontWeight: FONTS.black, color: COLORS.text },
  modalBody:   { padding: 20 },
  modalSave: {
    backgroundColor: COLORS.primary, paddingVertical: 15,
    borderRadius: RADIUS.lg, alignItems: 'center',
    marginHorizontal: 20, marginBottom: 20, marginTop: 8,
  },
  modalSaveText: { color: '#fff', fontWeight: FONTS.black, fontSize: 15 },

  // Form fields
  fieldLabel: {
    fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textSub,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 7, marginTop: 18,
  },
  fieldInput: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: COLORS.text,
  },
  input: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: COLORS.text,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  row:      { flexDirection: 'row', gap: 12 },
  pickerRow:{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  pickerChip:       { paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg },
  pickerChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pickerChipText:   { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  pickerChipTextActive: { color: '#fff', fontWeight: FONTS.bold },
  stateArrow:  { fontSize: 14, color: COLORS.textMute },
  statePickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12,
  },
  statePickerText: { fontSize: 14, color: COLORS.text },

  // Reports
  presetRow:        { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', gap: 8, flexWrap: 'wrap', backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  presetChip:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  presetChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  presetText:       { fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.medium },
  presetTextActive: { color: '#fff', fontWeight: FONTS.bold },
  reportSection: { marginBottom: 20 },
  sectionHeading: { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10, marginTop: 4 },
  reportCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginBottom: 2 },
  reportRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  reportRowLast: { borderBottomWidth: 0 },
  reportLabel:{ fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  reportValue:{ fontSize: 14, fontWeight: FONTS.heavy, color: COLORS.text },
  plCard:     { backgroundColor: COLORS.secondary, borderRadius: RADIUS.xl, padding: 20, marginBottom: 16 },
  plTitle:    { fontSize: 11, fontWeight: FONTS.bold, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 14 },
  plRow:      { flexDirection: 'row' },
  plItem:     { flex: 1, alignItems: 'center' },
  plValue:    { fontSize: 16, fontWeight: FONTS.black, marginBottom: 4 },
  plLabel:    { fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  gstRow:     { flexDirection: 'row', gap: 10, marginBottom: 2 },
  gstBox:     { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 14, alignItems: 'center', borderTopWidth: 3, borderWidth: 1, borderColor: COLORS.border },
  gstVal:     { fontSize: 15, fontWeight: FONTS.black, marginBottom: 4 },
  gstLbl:     { fontSize: 10, color: COLORS.textMute, textAlign: 'center' },
  exportBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.secondary, paddingVertical: 14, borderRadius: RADIUS.lg, marginTop: 8 },
  exportBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },

  // Settings
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  sectionTitle: { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.7 },
  settingsCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, marginHorizontal: 16, marginBottom: 4, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  settingsRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  settingsRowLast: { borderBottomWidth: 0 },
  settingsRowLabel: { flex: 1, fontSize: 14, fontWeight: FONTS.medium, color: COLORS.text },
  settingsRowValue: { fontSize: 13, color: COLORS.textMute },
  settingsInput:    { flex: 1, fontSize: 14, color: COLORS.text, textAlign: 'right' },
  card:     { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, marginHorizontal: 16, marginBottom: 4, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', padding: 16 },
  infoRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoLabel:{ fontSize: 13, color: COLORS.textSub },
  infoValue:{ fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.text },
  dangerBtn:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.dangerLight, paddingVertical: 13, borderRadius: RADIUS.lg, marginHorizontal: 16, marginTop: 4 },
  dangerBtnText: { color: COLORS.danger, fontWeight: FONTS.bold, fontSize: 14 },
  infoBox:    { backgroundColor: COLORS.infoLight, borderRadius: RADIUS.md, padding: 12, marginTop: 8 },
  infoBoxText:{ fontSize: 12, color: COLORS.info, lineHeight: 18 },
  hintWarn:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.warningBg, borderRadius: RADIUS.sm, padding: 10, marginTop: 6 },
  hintWarnText:{ fontSize: 12, color: COLORS.warning, flex: 1 },
  hintOk:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.successBg, borderRadius: RADIUS.sm, padding: 10, marginTop: 6 },
  hintOkText: { fontSize: 12, color: COLORS.success, flex: 1 },
  upiOk:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  upiWarn:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  upiWarnText:{ fontSize: 12, color: COLORS.textMute },
  driveRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: COLORS.successBg, borderRadius: RADIUS.md, marginTop: 8 },
  driveEmail: { flex: 1, fontSize: 13, color: COLORS.success, fontWeight: FONTS.semibold },
  backupTime: { fontSize: 13, color: COLORS.textSub },
  backupBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: RADIUS.md, marginTop: 8 },
  backupBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
  restoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.card, paddingVertical: 12, borderRadius: RADIUS.md, marginTop: 6, borderWidth: 1, borderColor: COLORS.border },
  restoreBtnText: { fontWeight: FONTS.bold, fontSize: 13, color: COLORS.text },
  connectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.secondary, paddingVertical: 12, borderRadius: RADIUS.md, marginTop: 8 },
  connectBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.dangerLight, paddingVertical: 13, borderRadius: RADIUS.lg, marginHorizontal: 16, marginVertical: 8 },
  signOutText:{ color: COLORS.danger, fontWeight: FONTS.bold, fontSize: 14 },
  pickerArrow:{ fontSize: 14, color: COLORS.textMute },

  // State picker modal
  stateOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  stateSheet:   { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl, maxHeight: '75%' },
  stateHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stateTitle:   { fontSize: 17, fontWeight: FONTS.black, color: COLORS.text },
  stateSearchBox:{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stateSearchInput:{ backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: COLORS.text },
  stateItem:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stateName:    { fontSize: 14, color: COLORS.text, fontWeight: FONTS.medium },
  stateCode:    { fontSize: 12, color: COLORS.textMute, backgroundColor: COLORS.bgDeep, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm },
  stateClose:   { fontSize: 20, color: COLORS.textMute },

  // Party detail
  heroDetail:   { backgroundColor: COLORS.secondary, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  detailAvatar: { width: 56, height: 56, borderRadius: RADIUS.full, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  detailAvatarText: { fontSize: 24, fontWeight: FONTS.black, color: '#fff' },
  detailName:   { fontSize: 20, fontWeight: FONTS.black, color: '#fff', marginBottom: 4 },
  detailSub:    { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  kpiStrip:     { flexDirection: 'row', backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  kpiChip:      { flex: 1, alignItems: 'center', paddingVertical: 12 },
  kpiValue:     { fontSize: 15, fontWeight: FONTS.black, marginBottom: 2 },
  kpiLabel:     { fontSize: 10, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.4 },
  kpiDivider:   { width: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  invRow:       { backgroundColor: COLORS.card, marginHorizontal: 16, marginBottom: 10, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  invRowTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 14 },
  invNum:       { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 3 },
  invDate:      { fontSize: 11, color: COLORS.textMute },
  invTotal:     { fontSize: 16, fontWeight: FONTS.black, color: COLORS.text, marginBottom: 5 },
  balRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.dangerBg, borderTopWidth: 1, borderTopColor: COLORS.dangerLight },
  balLabel:     { fontSize: 11, color: COLORS.danger, fontWeight: FONTS.semibold },
  balValue:     { fontSize: 12, fontWeight: FONTS.heavy, color: COLORS.danger },

  // Empty state
  empty:        { alignItems: 'center', paddingTop: 70, paddingHorizontal: 32 },
  emptyIconWrap:{ width: 80, height: 80, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyIcon:    { fontSize: 36 },
  emptyTitle:   { fontSize: 18, fontWeight: FONTS.black, color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  emptySub:     { fontSize: 13, color: COLORS.textMute, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn:     { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.lg },
  emptyBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 14 },

  // Login
  loginContainer: { flex: 1, backgroundColor: '#F8FAFF', alignItems: 'center', justifyContent: 'center', padding: 24 },
  loginLogoWrap:  { alignItems: 'center', marginBottom: 40 },
  loginLogoBox:   { width: 160, height: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  loginLogoImg:   { width: 140, height: 50 },
  loginBrand:     { fontSize: 13, color: COLORS.textMute, letterSpacing: 1 },
  loginTagline:   { fontSize: 12, color: COLORS.textMute, marginTop: 2 },
  loginCard:      { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: 28, borderWidth: 1, borderColor: COLORS.border },
  loginTitle:     { fontSize: 22, fontWeight: FONTS.black, color: COLORS.text, marginBottom: 6 },
  loginSubtitle:  { fontSize: 13, color: COLORS.textMute, marginBottom: 24 },
  loginLabel:     { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7, marginTop: 16 },
  loginInput:     { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: COLORS.text },
  loginBtn:       { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  loginBtnText:   { color: '#fff', fontWeight: FONTS.black, fontSize: 15 },
  loginError:     { backgroundColor: COLORS.dangerLight, borderRadius: RADIUS.md, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  loginErrorText: { fontSize: 13, color: COLORS.danger, flex: 1 },
  loginFooter:    { fontSize: 12, color: COLORS.textMute, marginTop: 20, textAlign: 'center' },

  // Payment modal (InvoiceDetail)
  payInvInfo:    { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 14, marginBottom: 8 },
  payInvNum:     { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.primary, marginBottom: 3 },
  payInvParty:   { fontSize: 13, color: COLORS.text },
  payInvBalance: { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.danger, marginTop: 4 },
  methodRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  methodChip:    { paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.md, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  methodChipActive:{ backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  methodText:    { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  methodTextActive:{ color: COLORS.primary, fontWeight: FONTS.bold },
  confirmBtn:    { backgroundColor: COLORS.success, borderRadius: RADIUS.lg, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  confirmBtnText:{ color: '#fff', fontWeight: FONTS.black, fontSize: 15 },

  // Section title in screens
  sectionLabel:   { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.7, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  loadingText:    { fontSize: 14, color: COLORS.textMute, marginTop: 12 },
  notFound:       { fontSize: 15, color: COLORS.textMute },

  expenseCard:      { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  iconBox:          { width: 38, height: 38, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: COLORS.bg },
  expSub:           { fontSize: 11, color: COLORS.textMute, marginTop: 2 },
  expNote:          { fontSize: 12, color: COLORS.textSub, marginTop: 3, fontStyle: 'italic' },
  category:         { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.4 },
  catScrollWrap:    { height: 38, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.card },
  catScrollContent: { paddingHorizontal: 12, paddingVertical: 5, gap: 6, alignItems: 'center', flexDirection: 'row' },
  catGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catGridItem:      { width: '30%', flex: 1, backgroundColor: COLORS.bg, borderRadius: RADIUS.md, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  catGridItemActive:{ backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  catGridText:      { fontSize: 12, fontWeight: FONTS.medium, color: COLORS.textSub, marginTop: 6, textAlign: 'center' },
  catGridTextActive:{ color: COLORS.primary, fontWeight: FONTS.bold },
  modalContainer:   { flex: 1, backgroundColor: COLORS.bg },
  modalScroll:      { padding: 16, paddingBottom: 40 },
  modalCancel:      { fontSize: 14, color: COLORS.textSub, fontWeight: FONTS.semibold, paddingVertical: 4 },
  modalSave:        { fontSize: 14, color: COLORS.primary, fontWeight: FONTS.bold, paddingVertical: 4 },

});