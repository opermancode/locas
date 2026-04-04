import Icon from '../../utils/Icon';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, FlatList, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getParties, getItems, savePurchaseOrder } from '../../db';
import { today, addDays } from '../../utils/gst';
import { COLORS, RADIUS, FONTS } from '../../theme';

const UNITS = ['pcs', 'kg', 'g', 'litre', 'ml', 'metre', 'box', 'bag', 'dozen', 'set'];
const EMPTY_ITEM = { item_id: null, name: '', hsn: '', unit: 'pcs', qty_ordered: '1', rate: '', notes: '' };

export default function CreatePOScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const editPO = route?.params?.po || null;

  const [date, setDate]         = useState(today());
  const [validUntil, setValid]  = useState(addDays(today(), 30));
  const [notes, setNotes]       = useState('');
  const [terms, setTerms]       = useState('');
  const [party, setParty]       = useState(null);
  const [lineItems, setLineItems] = useState([{ ...EMPTY_ITEM, _key: Date.now() }]);
  const [saving, setSaving]     = useState(false);

  const [parties, setParties]   = useState([]);
  const [items, setItems]       = useState([]);
  const [partyModal, setPartyModal] = useState(false);
  const [itemModal, setItemModal]   = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);
  const [draftItem, setDraftItem]   = useState(EMPTY_ITEM);
  const [partySearch, setPartySearch] = useState('');
  const [itemSearch, setItemSearch]   = useState('');

  useEffect(() => {
    (async () => {
      const [p, itms] = await Promise.all([getParties('customer'), getItems()]);
      setParties(p);
      setItems(itms);
    })();
    if (editPO) {
      setDate(editPO.date);
      setValid(editPO.valid_until || '');
      setNotes(editPO.notes || '');
      setTerms(editPO.terms || '');
      setParty(editPO.party_id ? { id: editPO.party_id, name: editPO.party_name } : null);
      if (editPO.items?.length > 0) {
        setLineItems(editPO.items.map(i => ({ ...i, qty_ordered: String(i.qty_ordered), rate: String(i.rate || ''), _key: i.id })));
      }
    }
  }, []);

  // ── Open item editor ────────────────────────────────────────────
  const openAddItem = () => {
    setDraftItem({ ...EMPTY_ITEM, _key: Date.now() });
    setEditingIdx(null);
    setItemSearch('');
    setItemModal(true);
  };

  const openEditItem = (idx) => {
    setDraftItem({ ...lineItems[idx] });
    setEditingIdx(idx);
    setItemModal(true);
  };

  const pickInventoryItem = (inv) => {
    setDraftItem(d => ({
      ...d,
      item_id: inv.id,
      name:    inv.name,
      hsn:     inv.hsn || '',
      unit:    inv.unit || 'pcs',
      rate:    String(inv.sale_price || ''),
    }));
  };

  const confirmItem = () => {
    if (!draftItem.name.trim()) { Alert.alert('Error', 'Enter item name'); return; }
    const qty = parseFloat(draftItem.qty_ordered);
    if (!qty || qty <= 0) { Alert.alert('Error', 'Enter a valid quantity'); return; }

    if (editingIdx !== null) {
      setLineItems(prev => prev.map((it, i) => i === editingIdx ? { ...draftItem } : it));
    } else {
      setLineItems(prev => [...prev, { ...draftItem, _key: Date.now() }]);
    }
    setItemModal(false);
  };

  const removeItem = (idx) => {
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Save ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!party) { Alert.alert('Error', 'Select a customer'); return; }
    const validItems = lineItems.filter(i => i.name.trim() && parseFloat(i.qty_ordered) > 0);
    if (validItems.length === 0) { Alert.alert('Error', 'Add at least one item'); return; }

    setSaving(true);
    try {
      const poData = {
        id:            editPO?.id || null,
        party_id:      party.id,
        party_name:    party.name,
        party_gstin:   party.gstin || '',
        party_address: party.address || '',
        date,
        valid_until:   validUntil,
        notes,
        terms,
      };
      const items = validItems.map(i => ({
        item_id:     i.item_id || null,
        name:        i.name,
        hsn:         i.hsn || '',
        unit:        i.unit || 'pcs',
        qty_ordered: parseFloat(i.qty_ordered),
        rate:        parseFloat(i.rate) || 0,
        notes:       i.notes || '',
      }));
      await savePurchaseOrder(poData, items);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredParties = parties.filter(p =>
    p.name.toLowerCase().includes(partySearch.toLowerCase()) ||
    p.phone?.includes(partySearch)
  );
  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    i.code?.toLowerCase().includes(itemSearch.toLowerCase())
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editPO ? 'Edit Purchase Order' : 'New Purchase Order'}</Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>

        {/* Customer */}
        <SL>Customer *</SL>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => { setPartySearch(''); setPartyModal(true); }}>
          {party ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.pickerVal}>{party.name}</Text>
              {party.gstin ? <Text style={styles.pickerSub}>GSTIN: {party.gstin}</Text> : null}
            </View>
          ) : (
            <Text style={styles.pickerPlaceholder}>Select customer...</Text>
          )}
          <Icon name="chevron-down" size={16} color={COLORS.textMute} />
        </TouchableOpacity>

        {/* Dates */}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <SL>PO Date *</SL>
            <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMute} />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <SL>Valid Until</SL>
            <TextInput style={styles.input} value={validUntil} onChangeText={setValid} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMute} />
          </View>
        </View>

        {/* Items */}
        <View style={styles.itemsHeader}>
          <Text style={styles.sectionLabel}>Items Ordered ({lineItems.length})</Text>
          <TouchableOpacity style={styles.addItemBtn} onPress={openAddItem}>
            <Icon name="plus" size={14} color={COLORS.primary} />
            <Text style={styles.addItemTxt}>Add Item</Text>
          </TouchableOpacity>
        </View>

        {lineItems.length === 0 ? (
          <TouchableOpacity style={styles.emptyItems} onPress={openAddItem}>
            <Icon name="package" size={24} color={COLORS.textMute} />
            <Text style={styles.emptyItemsTxt}>Tap to add items the customer wants</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.itemsCard}>
            {lineItems.map((item, idx) => (
              <View key={item._key || idx} style={[styles.itemRow, idx < lineItems.length - 1 && styles.itemRowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name || 'Unnamed item'}</Text>
                  <Text style={styles.itemMeta}>
                    Qty: <Text style={{ fontWeight: FONTS.bold, color: COLORS.primary }}>{item.qty_ordered} {item.unit}</Text>
                    {item.rate ? `  ·  Rate: ₹${item.rate}` : ''}
                    {item.hsn ? `  ·  HSN: ${item.hsn}` : ''}
                  </Text>
                  {item.notes ? <Text style={styles.itemNote}>{item.notes}</Text> : null}
                </View>
                <View style={styles.itemActions}>
                  <TouchableOpacity onPress={() => openEditItem(idx)} style={styles.itemActionBtn}>
                    <Icon name="edit-2" size={14} color={COLORS.textSub} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeItem(idx)} style={[styles.itemActionBtn, styles.itemDelBtn]}>
                    <Icon name="trash-2" size={14} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Notes & Terms */}
        <SL>Notes (optional)</SL>
        <TextInput
          style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Internal notes about this PO..."
          placeholderTextColor={COLORS.textMute}
          multiline
        />
        <SL>Terms (optional)</SL>
        <TextInput
          style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
          value={terms}
          onChangeText={setTerms}
          placeholder="Delivery terms, conditions..."
          placeholderTextColor={COLORS.textMute}
          multiline
        />

        {/* Info box */}
        <View style={styles.infoBox}>
          <Icon name="info" size={14} color={COLORS.info} />
          <Text style={styles.infoTxt}>
            When you create an invoice for this customer, the app will ask if it's fulfilling this PO and automatically track quantities delivered.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Bottom Save */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.bottomSave, saving && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.bottomSaveTxt}>{editPO ? 'Update Purchase Order' : 'Create Purchase Order'}</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Party Modal */}
      <Modal visible={partyModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Customer</Text>
              <TouchableOpacity onPress={() => setPartyModal(false)} style={{ padding: 4 }}>
                <Icon name="x" size={18} color={COLORS.textMute} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Icon name="search" size={15} color={COLORS.textMute} />
              <TextInput
                style={styles.modalSearchInput}
                value={partySearch}
                onChangeText={setPartySearch}
                placeholder="Search customers..."
                placeholderTextColor={COLORS.textMute}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredParties}
              keyExtractor={p => String(p.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: p }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => { setParty(p); setPartyModal(false); }}
                >
                  <View style={[styles.avatar, { backgroundColor: COLORS.primaryLight }]}>
                    <Text style={styles.avatarTxt}>{p.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemName}>{p.name}</Text>
                    {p.phone ? <Text style={styles.modalItemSub}>{p.phone}</Text> : null}
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.modalEmpty}>No customers found</Text>}
            />
          </View>
        </View>
      </Modal>

      {/* Item Edit Modal */}
      <Modal visible={itemModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingIdx !== null ? 'Edit Item' : 'Add Item'}</Text>
              <TouchableOpacity onPress={() => setItemModal(false)} style={{ padding: 4 }}>
                <Icon name="x" size={18} color={COLORS.textMute} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">

              {/* Pick from inventory */}
              <SL>Pick from Inventory</SL>
              <View style={styles.modalSearch}>
                <Icon name="search" size={15} color={COLORS.textMute} />
                <TextInput
                  style={styles.modalSearchInput}
                  value={itemSearch}
                  onChangeText={setItemSearch}
                  placeholder="Search inventory..."
                  placeholderTextColor={COLORS.textMute}
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {filteredItems.slice(0, 12).map(inv => (
                  <TouchableOpacity
                    key={inv.id}
                    style={[styles.invChip, draftItem.item_id === inv.id && styles.invChipActive]}
                    onPress={() => pickInventoryItem(inv)}
                  >
                    <Text style={[styles.invChipTxt, draftItem.item_id === inv.id && styles.invChipTxtActive]} numberOfLines={1}>{inv.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <SL>Item Name *</SL>
              <TextInput style={styles.input} value={draftItem.name} onChangeText={v => setDraftItem(d => ({ ...d, name: v }))} placeholder="e.g. Steel Pipes 25mm" placeholderTextColor={COLORS.textMute} />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <SL>Qty Ordered *</SL>
                  <TextInput style={styles.input} value={draftItem.qty_ordered} onChangeText={v => setDraftItem(d => ({ ...d, qty_ordered: v }))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={COLORS.textMute} />
                </View>
                <View style={{ width: 10 }} />
                <View style={{ flex: 1 }}>
                  <SL>Unit</SL>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 2 }}>
                    {UNITS.map(u => (
                      <TouchableOpacity key={u} style={[styles.unitChip, draftItem.unit === u && styles.unitChipActive]} onPress={() => setDraftItem(d => ({ ...d, unit: u }))}>
                        <Text style={[styles.unitTxt, draftItem.unit === u && styles.unitTxtActive]}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <SL>Expected Rate (₹)</SL>
                  <TextInput style={styles.input} value={draftItem.rate} onChangeText={v => setDraftItem(d => ({ ...d, rate: v }))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={COLORS.textMute} />
                </View>
                <View style={{ width: 10 }} />
                <View style={{ flex: 1 }}>
                  <SL>HSN Code</SL>
                  <TextInput style={styles.input} value={draftItem.hsn} onChangeText={v => setDraftItem(d => ({ ...d, hsn: v }))} placeholder="e.g. 7304" placeholderTextColor={COLORS.textMute} />
                </View>
              </View>

              <SL>Notes (optional)</SL>
              <TextInput style={styles.input} value={draftItem.notes} onChangeText={v => setDraftItem(d => ({ ...d, notes: v }))} placeholder="Spec, color, etc." placeholderTextColor={COLORS.textMute} />

              <TouchableOpacity style={styles.confirmBtn} onPress={confirmItem}>
                <Text style={styles.confirmTxt}>{editingIdx !== null ? 'Update Item' : 'Add Item'}</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SL({ children }) {
  return <Text style={{ fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7, marginTop: 16 }}>{children}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn:  { padding: 4, marginRight: 10 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: FONTS.black, color: COLORS.text },
  saveBtn:  { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.md },
  saveBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
  scroll:   { padding: 16, paddingBottom: 100 },
  row:      { flexDirection: 'row' },
  input:    { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: COLORS.text },
  pickerBtn:{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 13 },
  pickerVal:{ flex: 1, fontSize: 14, fontWeight: FONTS.semibold, color: COLORS.text },
  pickerSub:{ fontSize: 11, color: COLORS.textSub, marginTop: 1 },
  pickerPlaceholder: { flex: 1, fontSize: 14, color: COLORS.textMute },
  sectionLabel: { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.6 },
  itemsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 8 },
  addItemBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.md, backgroundColor: COLORS.primaryLight },
  addItemTxt:  { fontSize: 12, fontWeight: FONTS.bold, color: COLORS.primary },
  emptyItems:  { alignItems: 'center', paddingVertical: 28, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed', gap: 8 },
  emptyItemsTxt: { fontSize: 13, color: COLORS.textMute },
  itemsCard:   { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  itemRow:     { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  itemRowBorder:{ borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemName:    { fontSize: 14, fontWeight: FONTS.semibold, color: COLORS.text, marginBottom: 2 },
  itemMeta:    { fontSize: 12, color: COLORS.textSub },
  itemNote:    { fontSize: 11, color: COLORS.textMute, marginTop: 2, fontStyle: 'italic' },
  itemActions: { flexDirection: 'row', gap: 6 },
  itemActionBtn: { padding: 7, borderRadius: RADIUS.sm, backgroundColor: COLORS.bg },
  itemDelBtn:  { backgroundColor: COLORS.dangerLight },
  infoBox:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: COLORS.infoLight, borderRadius: RADIUS.md, padding: 12, marginTop: 16 },
  infoTxt:     { flex: 1, fontSize: 12, color: COLORS.info, lineHeight: 18 },
  bottomBar:   { padding: 16, paddingBottom: 16, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border },
  bottomSave:  { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 15, alignItems: 'center' },
  bottomSaveTxt: { color: '#fff', fontWeight: FONTS.black, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl, maxHeight: '90%' },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle:   { fontSize: 17, fontWeight: FONTS.black, color: COLORS.text },
  modalSearch:  { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, paddingHorizontal: 12, height: 42, backgroundColor: COLORS.bg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  modalSearchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  modalItem:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalItemName:{ fontSize: 14, fontWeight: FONTS.semibold, color: COLORS.text },
  modalItemSub: { fontSize: 12, color: COLORS.textSub },
  modalEmpty:   { textAlign: 'center', color: COLORS.textMute, padding: 24 },
  avatar:       { width: 38, height: 38, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:    { fontSize: 16, fontWeight: FONTS.black, color: COLORS.primary },
  invChip:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, marginRight: 7 },
  invChipActive:{ backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  invChipTxt:   { fontSize: 12, color: COLORS.textSub, maxWidth: 100 },
  invChipTxtActive: { color: COLORS.primary, fontWeight: FONTS.bold },
  unitChip:     { paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.sm, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, marginRight: 6 },
  unitChipActive:{ backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  unitTxt:      { fontSize: 12, color: COLORS.textSub },
  unitTxtActive:{ color: COLORS.primary, fontWeight: FONTS.bold },
  confirmBtn:   { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  confirmTxt:   { color: '#fff', fontWeight: FONTS.black, fontSize: 15 },
});
