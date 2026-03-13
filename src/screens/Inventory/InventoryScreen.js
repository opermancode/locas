import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert, RefreshControl, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getItems, saveItem, deleteItem } from '../../db/db';
import { GST_RATES, formatINR } from '../../utils/gst';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';

const UNITS = ['pcs', 'kg', 'g', 'litre', 'ml', 'metre', 'box', 'bag', 'dozen', 'set'];

const EMPTY_FORM = {
  name: '', code: '', unit: 'pcs', hsn: '',
  sale_price: '', purchase_price: '',
  gst_rate: 18, stock: '', min_stock: '',
};

export default function InventoryScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  const [items, setItems]         = useState([]);
  const [filtered, setFiltered]   = useState([]);
  const [search, setSearch]       = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await getItems();
      setItems(data);
      apply(data, search, lowStockOnly);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => {
    load();
    // Auto-open add modal if navigated with openAdd flag
    if (route?.params?.openAdd) {
      setForm(EMPTY_FORM);
      setModal(true);
      navigation.setParams({ openAdd: false });
    }
  }, []));

  const apply = (data, q, lowOnly) => {
    let out = data;
    if (q.trim()) {
      const lq = q.toLowerCase();
      out = out.filter(i =>
        i.name.toLowerCase().includes(lq) ||
        (i.code || '').toLowerCase().includes(lq) ||
        (i.hsn  || '').includes(lq)
      );
    }
    if (lowOnly) {
      out = out.filter(i => i.min_stock > 0 && i.stock <= i.min_stock);
    }
    setFiltered(out);
  };

  const handleSearch = (q) => { setSearch(q); apply(items, q, lowStockOnly); };
  const toggleLow    = ()  => { const n = !lowStockOnly; setLowStockOnly(n); apply(items, search, n); };
  const onRefresh    = ()  => { setRefreshing(true); load(); };

  const openAdd  = () => { setForm(EMPTY_FORM); setModal(true); };
  const openEdit = (item) => {
    setForm({
      id:             item.id,
      name:           item.name,
      code:           item.code || '',
      unit:           item.unit || 'pcs',
      hsn:            item.hsn  || '',
      sale_price:     String(item.sale_price     || ''),
      purchase_price: String(item.purchase_price || ''),
      gst_rate:       item.gst_rate || 18,
      stock:          String(item.stock     || ''),
      min_stock:      String(item.min_stock || ''),
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim())                          { Alert.alert('Error', 'Item name is required'); return; }
    if (!form.sale_price || parseFloat(form.sale_price) < 0) { Alert.alert('Error', 'Enter a valid sale price'); return; }
    setSaving(true);
    try {
      await saveItem({
        ...form,
        sale_price:     parseFloat(form.sale_price)     || 0,
        purchase_price: parseFloat(form.purchase_price) || 0,
        stock:          parseFloat(form.stock)           || 0,
        min_stock:      parseFloat(form.min_stock)       || 0,
      });
      setModal(false);
      load();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    Alert.alert('Delete Item', `Delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteItem(item.id);
        load();
      }},
    ]);
  };

  // ── Stats ──────────────────────────────────────────────────────
  const totalItems    = items.length;
  const lowStockCount = items.filter(i => i.min_stock > 0 && i.stock <= i.min_stock).length;
  const totalValue    = items.reduce((s, i) => s + (i.stock * i.sale_price), 0);

  // ── Render item ───────────────────────────────────────────────
  const renderItem = ({ item }) => {
    const isLow = item.min_stock > 0 && item.stock <= item.min_stock;
    return (
      <View style={styles.itemCard}>
        <View style={styles.cardMain}>
          {/* Left */}
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              {isLow && <View style={styles.lowBadge}><Text style={styles.lowText}>Low</Text></View>}
            </View>
            {item.code ? <Text style={styles.itemSub}>Code: {item.code}</Text> : null}
            {item.hsn  ? <Text style={styles.itemSub}>HSN: {item.hsn}</Text>   : null}
            <Text style={styles.itemSub}>GST: {item.gst_rate}%  ·  Unit: {item.unit}</Text>
          </View>

          {/* Right */}
          <View style={styles.cardRight}>
            <Text style={styles.salePrice}>{formatINR(item.sale_price)}</Text>
            {item.purchase_price > 0 && (
              <Text style={styles.purchasePrice}>Cost: {formatINR(item.purchase_price)}</Text>
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
        </View>

        {/* Stock bar */}
        <View style={styles.stockRow}>
          <Text style={[styles.stockLabel, isLow && { color: COLORS.danger }]}>
            Stock: {item.stock} {item.unit}
          </Text>
          {item.min_stock > 0 && (
            <Text style={styles.minStock}>Min: {item.min_stock}</Text>
          )}
          <Text style={styles.stockValue}>{formatINR(item.stock * item.sale_price)}</Text>
        </View>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inventory</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Stats strip */}
      <View style={styles.statsStrip}>
        <StatChip label="Total Items"  value={String(totalItems)}    color={COLORS.secondary} />
        <View style={styles.div} />
        <StatChip label="Low Stock"    value={String(lowStockCount)} color={lowStockCount > 0 ? COLORS.danger : COLORS.textMute} />
        <View style={styles.div} />
        <StatChip label="Stock Value"  value={formatINR(totalValue)} color={COLORS.primary} />
      </View>

      {/* Search + filter */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, code, HSN..."
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

      {lowStockCount > 0 && (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.lowFilter, lowStockOnly && styles.lowFilterActive]}
            onPress={toggleLow}
          >
            <Text style={[styles.lowFilterText, lowStockOnly && styles.lowFilterTextActive]}>
              ⚠️ Low Stock Only ({lowStockCount})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>{search ? 'No items found' : 'No items yet'}</Text>
            <Text style={styles.emptySub}>{search ? 'Try a different search' : 'Add products & services'}</Text>
            {!search && (
              <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
                <Text style={styles.emptyBtnText}>Add Item</Text>
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
            <Text style={styles.modalTitle}>{form.id ? 'Edit Item' : 'Add Item'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Text style={[styles.modalSave, saving && { opacity: 0.4 }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">

            <FieldLabel>Item Name *</FieldLabel>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={v => setForm(f => ({ ...f, name: v }))}
              placeholder="e.g. Rice Bag 25kg"
              placeholderTextColor={COLORS.textMute}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Item Code</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={form.code}
                  onChangeText={v => setForm(f => ({ ...f, code: v }))}
                  placeholder="SKU / barcode"
                  placeholderTextColor={COLORS.textMute}
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <FieldLabel>HSN/SAC</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={form.hsn}
                  onChangeText={v => setForm(f => ({ ...f, hsn: v }))}
                  placeholder="e.g. 1006"
                  placeholderTextColor={COLORS.textMute}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <FieldLabel>Unit</FieldLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {UNITS.map(u => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.chip, form.unit === u && styles.chipActive]}
                    onPress={() => setForm(f => ({ ...f, unit: u }))}
                  >
                    <Text style={[styles.chipText, form.unit === u && styles.chipTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Sale Price (₹) *</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={form.sale_price}
                  onChangeText={v => setForm(f => ({ ...f, sale_price: v }))}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.textMute}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <FieldLabel>Purchase Price (₹)</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={form.purchase_price}
                  onChangeText={v => setForm(f => ({ ...f, purchase_price: v }))}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.textMute}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <FieldLabel>GST Rate</FieldLabel>
            <View style={styles.gstRow}>
              {GST_RATES.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.gstChip, form.gst_rate === r && styles.gstChipActive]}
                  onPress={() => setForm(f => ({ ...f, gst_rate: r }))}
                >
                  <Text style={[styles.gstChipText, form.gst_rate === r && styles.gstChipTextActive]}>
                    {r}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Opening Stock</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={form.stock}
                  onChangeText={v => setForm(f => ({ ...f, stock: v }))}
                  placeholder="0"
                  placeholderTextColor={COLORS.textMute}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <FieldLabel>Min Stock Alert</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={form.min_stock}
                  onChangeText={v => setForm(f => ({ ...f, min_stock: v }))}
                  placeholder="0"
                  placeholderTextColor={COLORS.textMute}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

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

  filterRow:           { paddingHorizontal: 12, marginBottom: 8 },
  lowFilter:           { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  lowFilterActive:     { backgroundColor: '#FEE2E2', borderColor: COLORS.danger },
  lowFilterText:       { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  lowFilterTextActive: { color: COLORS.danger, fontWeight: FONTS.bold },

  list: { padding: 12, paddingTop: 4, paddingBottom: 80 },

  itemCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 10, overflow: 'hidden', ...SHADOW.sm,
  },
  cardMain:   { flexDirection: 'row', padding: 14, alignItems: 'flex-start' },
  nameRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  itemName:   { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, flex: 1 },
  itemSub:    { fontSize: 12, color: COLORS.textSub, marginTop: 2 },

  lowBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  lowText:  { fontSize: 10, fontWeight: FONTS.heavy, color: COLORS.danger },

  cardRight:    { alignItems: 'flex-end', marginLeft: 8 },
  salePrice:    { fontSize: 17, fontWeight: FONTS.heavy, color: COLORS.text, marginBottom: 2 },
  purchasePrice:{ fontSize: 12, color: COLORS.textSub },
  cardActions:  { flexDirection: 'row', gap: 4, marginTop: 8 },
  editBtn:      { padding: 6 },
  editIcon:     { fontSize: 16 },
  delBtn:       { padding: 6 },
  delIcon:      { fontSize: 16 },

  stockRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  stockLabel: { flex: 1, fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.semibold },
  minStock:   { fontSize: 12, color: COLORS.textMute, marginRight: 12 },
  stockValue: { fontSize: 12, fontWeight: FONTS.bold, color: COLORS.text },

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
  row: { flexDirection: 'row', alignItems: 'flex-start' },

  chip:          { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  chipActive:    { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  chipText:      { fontSize: 12, color: COLORS.textSub },
  chipTextActive:{ color: COLORS.primary, fontWeight: FONTS.bold },

  gstRow:           { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  gstChip:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  gstChipActive:    { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  gstChipText:      { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  gstChipTextActive:{ color: COLORS.primary, fontWeight: FONTS.bold },
});