import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, FlatList, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getParties, getItems,
  saveInvoice, getProfile, peekNextInvoiceNumber,
} from '../../db/db';
import {
  calcLineItem, calcInvoiceTotals, detectSupplyType,
  GST_RATES, formatINR, today, addDays, PAYMENT_METHODS, round,
} from '../../utils/gst';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';

const UNITS = ['pcs', 'kg', 'g', 'litre', 'ml', 'metre', 'box', 'bag', 'dozen', 'set'];

const EMPTY_ITEM = {
  item_id: null, name: '', hsn: '', unit: 'pcs',
  qty: '1', rate: '', discount: '0', gst_rate: 18,
};

export default function CreateInvoice({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const editInvoice = route?.params?.invoice || null;

  // ── Core state ────────────────────────────────────────────────
  const [invoiceNo, setInvoiceNo]         = useState('');
  const [invoiceDate, setInvoiceDate]     = useState(today());
  const [dueDate, setDueDate]             = useState(addDays(today(), 30));
  const [notes, setNotes]                 = useState('');
  const [terms, setTerms]                 = useState('Payment due within 30 days.');
  const [invoiceDiscount, setInvoiceDiscount] = useState('0');
  const [supplyType, setSupplyType]       = useState('intra');

  const [party, setParty]       = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [totals, setTotals]     = useState({});
  const [profile, setProfile]   = useState(null);
  const [saving, setSaving]     = useState(false);

  // ── Modal state ───────────────────────────────────────────────
  const [partyModal, setPartyModal] = useState(false);
  const [itemModal, setItemModal]   = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);
  const [draftItem, setDraftItem]   = useState(EMPTY_ITEM);
  const [itemTab, setItemTab]       = useState('inventory');

  // ── Picker data ───────────────────────────────────────────────
  const [parties, setParties]         = useState([]);
  const [items, setItems]             = useState([]);
  const [partySearch, setPartySearch] = useState('');
  const [itemSearch, setItemSearch]   = useState('');

  // ── Load ──────────────────────────────────────────────────────
  useEffect(() => { init(); }, []);

  const init = async () => {
    const [num, p, itms, prof] = await Promise.all([
      peekNextInvoiceNumber(),
      getParties(),
      getItems(),
      getProfile(),
    ]);
    setInvoiceNo(num);
    setParties(p);
    setItems(itms);
    setProfile(prof);
  };

  // ── Recalc totals ─────────────────────────────────────────────
  useEffect(() => {
    if (lineItems.length === 0) { setTotals({}); return; }
    const t = calcInvoiceTotals(lineItems, parseFloat(invoiceDiscount) || 0, supplyType);
    setTotals(t);
  }, [lineItems, invoiceDiscount, supplyType]);

  // ── Auto detect supply type ───────────────────────────────────
  useEffect(() => {
    if (!party || !profile) return;
    const st = detectSupplyType(profile.state_code, party.state_code);
    setSupplyType(st);
  }, [party, profile]);

  // ── Party select ──────────────────────────────────────────────
  const selectParty = (p) => {
    setParty(p);
    setPartyModal(false);
    setPartySearch('');
  };

  // ── Line item helpers ─────────────────────────────────────────
  const openAddItem = () => {
    setDraftItem({ ...EMPTY_ITEM });
    setEditingIdx(null);
    setItemSearch('');
    setItemTab('inventory');
    setItemModal(true);
  };

  const openEditItem = (idx) => {
    const item = lineItems[idx];
    setDraftItem({
      item_id:  item.item_id,
      name:     item.name,
      hsn:      item.hsn || '',
      unit:     item.unit || 'pcs',
      qty:      String(item.qty),
      rate:     String(item.rate),
      discount: String(item.discount || 0),
      gst_rate: item.gst_rate || 18,
    });
    setEditingIdx(idx);
    setItemTab('manual');
    setItemModal(true);
  };

  // ── Add inventory item directly ───────────────────────────────
  const addInventoryItem = (inv) => {
    const computed = calcLineItem({
      item_id:  inv.id,
      name:     inv.name,
      hsn:      inv.hsn || '',
      unit:     inv.unit || 'pcs',
      qty:      1,
      rate:     inv.sale_price || 0,
      discount: 0,
      gst_rate: inv.gst_rate || 18,
    }, supplyType);
    if (editingIdx !== null) {
      setLineItems(prev => prev.map((it, i) => i === editingIdx ? computed : it));
    } else {
      setLineItems(prev => [...prev, computed]);
    }
    setItemModal(false);
    setItemSearch('');
  };

  // ── Confirm manual item ───────────────────────────────────────
  const confirmItem = () => {
    if (!draftItem.name.trim())                           { Alert.alert('Error', 'Item name is required'); return; }
    if (!draftItem.rate || parseFloat(draftItem.rate) <= 0) { Alert.alert('Error', 'Enter a valid rate'); return; }
    if (!draftItem.qty  || parseFloat(draftItem.qty)  <= 0) { Alert.alert('Error', 'Enter a valid quantity'); return; }

    const computed = calcLineItem({
      ...draftItem,
      qty:      parseFloat(draftItem.qty),
      rate:     parseFloat(draftItem.rate),
      discount: parseFloat(draftItem.discount) || 0,
    }, supplyType);

    if (editingIdx !== null) {
      setLineItems(prev => prev.map((it, i) => i === editingIdx ? computed : it));
    } else {
      setLineItems(prev => [...prev, computed]);
    }
    setItemModal(false);
  };

  const removeItem = (idx) => {
    Alert.alert('Remove Item', 'Remove this item?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () =>
        setLineItems(prev => prev.filter((_, i) => i !== idx))
      },
    ]);
  };

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (lineItems.length === 0) { Alert.alert('Error', 'Add at least one item'); return; }
    setSaving(true);
    try {
      const invoice = {
        type:             'sale',
        party_id:         party?.id || null,
        party_name:       party?.name || '',
        party_gstin:      party?.gstin || '',
        party_state:      party?.state || '',
        party_state_code: party?.state_code || '',
        party_address:    party?.address || '',
        date:             invoiceDate,
        due_date:         dueDate,
        subtotal:         totals.subtotal || 0,
        discount:         parseFloat(invoiceDiscount) || 0,
        taxable:          totals.taxable || 0,
        cgst:             totals.cgst || 0,
        sgst:             totals.sgst || 0,
        igst:             totals.igst || 0,
        total_tax:        totals.total_tax || 0,
        total:            totals.total || 0,
        paid:             0,
        status:           'unpaid',
        supply_type:      supplyType,
        notes,
        terms,
      };

      const invoiceId = await saveInvoice(invoice, lineItems.map(it => ({
        item_id:  it.item_id,
        name:     it.name,
        hsn:      it.hsn || '',
        unit:     it.unit || 'pcs',
        qty:      it.qty,
        rate:     it.rate,
        discount: it.discount || 0,
        taxable:  it.taxable,
        gst_rate: it.gst_rate,
        cgst:     it.cgst,
        sgst:     it.sgst,
        igst:     it.igst,
        total:    it.total,
      })));

      navigation.replace('InvoiceDetail', { invoiceId });
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Filtered lists ────────────────────────────────────────────
  const filteredParties = parties.filter(p =>
    p.name.toLowerCase().includes(partySearch.toLowerCase()) ||
    (p.phone || '').includes(partySearch)
  );

  const filteredItems = items.filter(it =>
    it.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    (it.code || '').toLowerCase().includes(itemSearch.toLowerCase()) ||
    (it.hsn  || '').includes(itemSearch)
  );

  // ─────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>

        {/* ── Header ───────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Invoice</Text>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Text style={styles.saveBtnText}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
        >

          {/* ── Invoice Meta ──────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.rowGap}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Invoice No</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={invoiceNo}
                  onChangeText={setInvoiceNo}
                  placeholderTextColor={COLORS.textMute}
                />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel>Supply Type</FieldLabel>
                <View style={styles.toggleRow}>
                  {['intra', 'inter'].map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.toggleBtn, supplyType === t && styles.toggleBtnActive]}
                      onPress={() => setSupplyType(t)}
                    >
                      <Text style={[styles.toggleText, supplyType === t && styles.toggleTextActive]}>
                        {t === 'intra' ? 'Intra' : 'Inter'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.rowGap}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Date</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={invoiceDate}
                  onChangeText={setInvoiceDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.textMute}
                />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel>Due Date</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={dueDate}
                  onChangeText={setDueDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.textMute}
                />
              </View>
            </View>
          </View>

          {/* ── Customer ──────────────────────────────────── */}
          <SectionTitle title="Bill To" />
          <TouchableOpacity
            style={[styles.card, styles.partySelector]}
            onPress={() => { setPartySearch(''); setPartyModal(true); }}
          >
            {party ? (
              <View style={{ flex: 1 }}>
                <Text style={styles.partyName}>{party.name}</Text>
                {party.phone   ? <Text style={styles.partySub}>📞 {party.phone}</Text> : null}
                {party.gstin   ? <Text style={styles.partySub}>GST: {party.gstin}</Text> : null}
                {party.address ? <Text style={styles.partySub} numberOfLines={1}>📍 {party.address}</Text> : null}
                <View style={supplyType === 'inter' ? styles.igstBadge : styles.intraBadge}>
                  <Text style={supplyType === 'inter' ? styles.igstBadgeText : styles.intraBadgeText}>
                    {supplyType === 'inter' ? 'IGST — Inter-state' : 'CGST+SGST — Intra-state'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <Text style={styles.partySelectorPlaceholder}>Tap to select customer</Text>
                <Text style={styles.partySelectorHint}>or leave empty for walk-in</Text>
              </View>
            )}
            <View style={styles.partyChevron}>
              <Text style={{ color: COLORS.primary, fontSize: 18 }}>
                {party ? '✕' : '›'}
              </Text>
            </View>
            {party && (
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation?.(); setParty(null); }}
                style={styles.clearPartyBtn}
              >
                <Text style={{ color: COLORS.textMute, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {/* ── Items ─────────────────────────────────────── */}
          <View style={styles.sectionRow}>
            <SectionTitle title={`Items ${lineItems.length > 0 ? `(${lineItems.length})` : ''}`} />
            <TouchableOpacity style={styles.addItemBtn} onPress={openAddItem}>
              <Text style={styles.addItemBtnText}>+ Add Item</Text>
            </TouchableOpacity>
          </View>

          {lineItems.length === 0 ? (
            <TouchableOpacity style={styles.emptyItems} onPress={openAddItem}>
              <Text style={styles.emptyItemsIcon}>📦</Text>
              <Text style={styles.emptyItemsText}>Tap to add items</Text>
              <Text style={styles.emptyItemsHint}>Pick from inventory or add manually</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.card}>
              <View style={styles.tableHeader}>
                <Text style={[styles.thCell, { flex: 3 }]}>Item</Text>
                <Text style={[styles.thCell, { flex: 1, textAlign: 'center' }]}>Qty</Text>
                <Text style={[styles.thCell, { flex: 2, textAlign: 'right' }]}>Amount</Text>
                <Text style={[styles.thCell, { width: 32 }]} />
              </View>
              {lineItems.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.tableRow, idx < lineItems.length - 1 && styles.tableRowBorder]}
                  onPress={() => openEditItem(idx)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 3 }}>
                    <Text style={styles.tdName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.tdSub}>
                      ₹{item.rate}/{item.unit}
                      {item.discount > 0 ? `  ${item.discount}% off` : ''}
                      {'  '}GST {item.gst_rate}%
                    </Text>
                    <Text style={styles.tdGst}>
                      {supplyType === 'intra'
                        ? `CGST ₹${round(item.cgst)}  +  SGST ₹${round(item.sgst)}`
                        : `IGST ₹${round(item.igst)}`}
                    </Text>
                  </View>
                  <Text style={[styles.tdCell, { flex: 1, textAlign: 'center' }]}>
                    {item.qty}
                  </Text>
                  <Text style={[styles.tdCell, { flex: 2, textAlign: 'right', fontWeight: FONTS.bold }]}>
                    {formatINR(item.total)}
                  </Text>
                  <TouchableOpacity
                    style={{ width: 32, alignItems: 'center' }}
                    onPress={() => removeItem(idx)}
                  >
                    <Text style={{ color: COLORS.danger, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.addMoreRow} onPress={openAddItem}>
                <Text style={styles.addMoreText}>+ Add Another Item</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Totals ────────────────────────────────────── */}
          {lineItems.length > 0 && (
            <View style={styles.totalsCard}>
              <TotalRow label="Subtotal"      value={formatINR(totals.subtotal)} />
              <View style={styles.discountRow}>
                <Text style={styles.totalLabel}>Invoice Discount (%)</Text>
                <TextInput
                  style={styles.discountInput}
                  value={invoiceDiscount}
                  onChangeText={setInvoiceDiscount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textMute}
                />
              </View>
              <TotalRow label="Taxable Amount" value={formatINR(totals.taxable)} />
              {supplyType === 'intra' ? (
                <>
                  <TotalRow label="CGST"  value={formatINR(totals.cgst)} muted />
                  <TotalRow label="SGST"  value={formatINR(totals.sgst)} muted />
                </>
              ) : (
                <TotalRow label="IGST"   value={formatINR(totals.igst)} muted />
              )}
              <View style={styles.totalDivider} />
              <TotalRow label="Total"    value={formatINR(totals.total)} grand />
            </View>
          )}

          {/* ── Notes & Terms ─────────────────────────────── */}
          <View style={styles.card}>
            <FieldLabel>Notes (optional)</FieldLabel>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any note for customer..."
              placeholderTextColor={COLORS.textMute}
              multiline
              numberOfLines={2}
            />
            <FieldLabel>Terms & Conditions</FieldLabel>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={terms}
              onChangeText={setTerms}
              multiline
              numberOfLines={2}
              placeholderTextColor={COLORS.textMute}
            />
          </View>

          {/* ── Action buttons ────────────────────────────── */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnOutline]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.actionBtnOutlineText}>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary, saving && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Text style={styles.actionBtnPrimaryText}>Save Invoice</Text>
              }
            </TouchableOpacity>
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>
      </View>

      {/* ══ Party Picker Modal ════════════════════════════════ */}
      <Modal visible={partyModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Customer</Text>
            <TouchableOpacity onPress={() => setPartyModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalSearchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search by name or phone..."
              placeholderTextColor={COLORS.textMute}
              value={partySearch}
              onChangeText={setPartySearch}
              autoFocus
            />
            {partySearch.length > 0 && (
              <TouchableOpacity onPress={() => setPartySearch('')}>
                <Text style={{ color: COLORS.textMute, fontSize: 16, padding: 4 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Walk-in */}
          <TouchableOpacity style={styles.modalItem} onPress={() => selectParty(null)}>
            <View style={styles.partyAvatar}>
              <Text style={styles.partyAvatarText}>🚶</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalItemName}>Walk-in Customer</Text>
              <Text style={styles.modalItemSub}>No party linked to this invoice</Text>
            </View>
          </TouchableOpacity>

          <FlatList
            data={filteredParties}
            keyExtractor={i => String(i.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.modalItem} onPress={() => selectParty(item)}>
                <View style={[styles.partyAvatar, { backgroundColor: COLORS.primaryLight }]}>
                  <Text style={[styles.partyAvatarText, { color: COLORS.primary, fontSize: 16, fontWeight: FONTS.bold }]}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalItemName}>{item.name}</Text>
                  <Text style={styles.modalItemSub}>
                    {[item.phone, item.gstin, item.state].filter(Boolean).join('  ·  ')}
                  </Text>
                </View>
                {item.type === 'supplier' && (
                  <View style={styles.supplierTag}>
                    <Text style={styles.supplierTagText}>Supplier</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyIcon}>👥</Text>
                <Text style={styles.modalEmptyText}>No parties found</Text>
                <TouchableOpacity
                  style={styles.modalEmptyBtn}
                  onPress={() => { setPartyModal(false); navigation.navigate('PartiesTab'); }}
                >
                  <Text style={styles.modalEmptyBtnText}>+ Add Party</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </View>
      </Modal>

      {/* ══ Item Picker Modal ═════════════════════════════════ */}
      <Modal visible={itemModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingIdx !== null ? 'Edit Item' : 'Add Item'}
            </Text>
            <TouchableOpacity onPress={() => setItemModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, itemTab === 'inventory' && styles.tabBtnActive]}
              onPress={() => setItemTab('inventory')}
            >
              <Text style={[styles.tabBtnText, itemTab === 'inventory' && styles.tabBtnTextActive]}>
                📦 From Inventory
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, itemTab === 'manual' && styles.tabBtnActive]}
              onPress={() => setItemTab('manual')}
            >
              <Text style={[styles.tabBtnText, itemTab === 'manual' && styles.tabBtnTextActive]}>
                ✏️ Manual Entry
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Inventory Tab ──────────────────────────────── */}
          {itemTab === 'inventory' ? (
            <View style={{ flex: 1 }}>
              <View style={styles.inventorySearchBox}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.inventorySearchInput}
                  placeholder="Search by name, code or HSN..."
                  placeholderTextColor={COLORS.textMute}
                  value={itemSearch}
                  onChangeText={setItemSearch}
                  autoFocus
                />
                {itemSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setItemSearch('')}>
                    <Text style={{ color: COLORS.textMute, fontSize: 16, padding: 4 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {filteredItems.length === 0 ? (
                <View style={styles.inventoryEmpty}>
                  <Text style={styles.inventoryEmptyIcon}>📦</Text>
                  <Text style={styles.inventoryEmptyText}>
                    {items.length === 0
                      ? 'No items in inventory yet'
                      : 'No items match your search'}
                  </Text>
                  {items.length === 0 && (
                    <TouchableOpacity
                      style={styles.goInventoryBtn}
                      onPress={() => { setItemModal(false); navigation.navigate('Inventory'); }}
                    >
                      <Text style={styles.goInventoryBtnText}>Go to Inventory →</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.goInventoryBtn, { marginTop: 8, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border }]}
                    onPress={() => setItemTab('manual')}
                  >
                    <Text style={[styles.goInventoryBtnText, { color: COLORS.textSub }]}>
                      Add manually →
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={filteredItems}
                  keyExtractor={i => String(i.id)}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 24 }}
                  renderItem={({ item: inv }) => {
                    const isLow = inv.min_stock > 0 && inv.stock <= inv.min_stock;
                    return (
                      <TouchableOpacity
                        style={styles.invItemRow}
                        onPress={() => addInventoryItem(inv)}
                        activeOpacity={0.75}
                      >
                        <View style={styles.invItemIconBox}>
                          <Text style={styles.invItemIcon}>📦</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.invItemTopRow}>
                            <Text style={styles.invItemName} numberOfLines={1}>{inv.name}</Text>
                            {isLow && (
                              <View style={styles.lowBadge}>
                                <Text style={styles.lowBadgeText}>Low Stock</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.invItemSub}>
                            {inv.hsn ? `HSN: ${inv.hsn}  ·  ` : ''}
                            GST {inv.gst_rate}%  ·  Stock: {inv.stock} {inv.unit}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 6 }}>
                          <Text style={styles.invItemPrice}>₹{inv.sale_price}</Text>
                          <Text style={styles.invItemUnit}>per {inv.unit}</Text>
                        </View>
                        <View style={styles.addCircle}>
                          <Text style={styles.addCircleText}>+</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </View>
          ) : (
            /* ── Manual Tab ──────────────────────────────── */
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={{ padding: 16 }}
              showsVerticalScrollIndicator={false}
            >
              <FieldLabel>Item Name *</FieldLabel>
              <TextInput
                style={styles.input}
                value={draftItem.name}
                onChangeText={v => setDraftItem(d => ({ ...d, name: v }))}
                placeholder="e.g. Rice Bag 25kg"
                placeholderTextColor={COLORS.textMute}
              />

              <View style={styles.rowGap}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>HSN/SAC Code</FieldLabel>
                  <TextInput
                    style={styles.input}
                    value={draftItem.hsn}
                    onChangeText={v => setDraftItem(d => ({ ...d, hsn: v }))}
                    placeholder="e.g. 1006"
                    placeholderTextColor={COLORS.textMute}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Unit</FieldLabel>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {UNITS.map(u => (
                        <TouchableOpacity
                          key={u}
                          style={[styles.unitChip, draftItem.unit === u && styles.unitChipActive]}
                          onPress={() => setDraftItem(d => ({ ...d, unit: u }))}
                        >
                          <Text style={[styles.unitChipText, draftItem.unit === u && styles.unitChipTextActive]}>
                            {u}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>

              <View style={styles.rowGap}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Qty *</FieldLabel>
                  <TextInput
                    style={styles.input}
                    value={draftItem.qty}
                    onChangeText={v => setDraftItem(d => ({ ...d, qty: v }))}
                    keyboardType="decimal-pad"
                    placeholder="1"
                    placeholderTextColor={COLORS.textMute}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Rate (₹) *</FieldLabel>
                  <TextInput
                    style={styles.input}
                    value={draftItem.rate}
                    onChangeText={v => setDraftItem(d => ({ ...d, rate: v }))}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={COLORS.textMute}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Disc %</FieldLabel>
                  <TextInput
                    style={styles.input}
                    value={draftItem.discount}
                    onChangeText={v => setDraftItem(d => ({ ...d, discount: v }))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={COLORS.textMute}
                  />
                </View>
              </View>

              <FieldLabel>GST Rate</FieldLabel>
              <View style={styles.gstRateRow}>
                {GST_RATES.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.gstChip, draftItem.gst_rate === r && styles.gstChipActive]}
                    onPress={() => setDraftItem(d => ({ ...d, gst_rate: r }))}
                  >
                    <Text style={[styles.gstChipText, draftItem.gst_rate === r && styles.gstChipTextActive]}>
                      {r}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Live preview */}
              {draftItem.rate && parseFloat(draftItem.rate) > 0 && draftItem.qty && parseFloat(draftItem.qty) > 0
                ? (() => {
                    const preview = calcLineItem({
                      ...draftItem,
                      qty:      parseFloat(draftItem.qty) || 0,
                      rate:     parseFloat(draftItem.rate) || 0,
                      discount: parseFloat(draftItem.discount) || 0,
                    }, supplyType);
                    return (
                      <View style={styles.previewBox}>
                        <Text style={styles.previewTitle}>Live Preview</Text>
                        <View style={styles.previewRow}>
                          <Text style={styles.previewLbl}>Taxable Amount</Text>
                          <Text style={styles.previewVal}>{formatINR(preview.taxable)}</Text>
                        </View>
                        {supplyType === 'intra' ? (
                          <>
                            <View style={styles.previewRow}>
                              <Text style={styles.previewLbl}>CGST ({draftItem.gst_rate / 2}%)</Text>
                              <Text style={styles.previewVal}>{formatINR(preview.cgst)}</Text>
                            </View>
                            <View style={styles.previewRow}>
                              <Text style={styles.previewLbl}>SGST ({draftItem.gst_rate / 2}%)</Text>
                              <Text style={styles.previewVal}>{formatINR(preview.sgst)}</Text>
                            </View>
                          </>
                        ) : (
                          <View style={styles.previewRow}>
                            <Text style={styles.previewLbl}>IGST ({draftItem.gst_rate}%)</Text>
                            <Text style={styles.previewVal}>{formatINR(preview.igst)}</Text>
                          </View>
                        )}
                        <View style={[styles.previewRow, styles.previewTotalRow]}>
                          <Text style={styles.previewTotalLbl}>Item Total</Text>
                          <Text style={styles.previewTotalVal}>{formatINR(preview.total)}</Text>
                        </View>
                      </View>
                    );
                  })()
                : null
              }

              <TouchableOpacity style={styles.confirmItemBtn} onPress={confirmItem}>
                <Text style={styles.confirmItemBtnText}>
                  {editingIdx !== null ? '✓ Update Item' : '✓ Add to Invoice'}
                </Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────

function SectionTitle({ title }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function FieldLabel({ children }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

function TotalRow({ label, value, muted, grand }) {
  return (
    <View style={styles.totalRow}>
      <Text style={[
        styles.totalLabel,
        muted  && { color: COLORS.textSub, fontSize: 13 },
        grand  && { fontWeight: FONTS.heavy, fontSize: 16 },
      ]}>
        {label}
      </Text>
      <Text style={[
        styles.totalValue,
        muted  && { color: COLORS.textSub, fontSize: 13 },
        grand  && { fontWeight: FONTS.heavy, fontSize: 16, color: COLORS.primary },
      ]}>
        {value}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bg },
  scroll:      { padding: 16 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn:     { padding: 4 },
  backIcon:    { fontSize: 22, color: COLORS.primary },
  headerTitle: { fontSize: 17, fontWeight: FONTS.bold, color: COLORS.text },
  saveBtn:     { backgroundColor: COLORS.primary, paddingHorizontal: 18, paddingVertical: 9, borderRadius: RADIUS.md },
  saveBtnText: { color: COLORS.white, fontWeight: FONTS.bold, fontSize: 14 },

  // Cards
  card: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: 14, marginBottom: 12, ...SHADOW.sm,
  },

  // Row layout
  rowGap: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },

  // Fields
  fieldLabel: {
    fontSize: 12, fontWeight: FONTS.semibold, color: COLORS.textSub,
    marginBottom: 6, marginTop: 10,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  input: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 10,
    fontSize: 14, color: COLORS.text,
  },
  textarea: { minHeight: 56, textAlignVertical: 'top' },

  // Toggle
  toggleRow:        { flexDirection: 'row', gap: 6 },
  toggleBtn:        { flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  toggleBtnActive:  { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  toggleText:       { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  toggleTextActive: { color: COLORS.primary, fontWeight: FONTS.bold },

  // Party selector
  partySelector:            { flexDirection: 'row', alignItems: 'center', minHeight: 60 },
  partyName:                { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text },
  partySub:                 { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  partySelectorPlaceholder: { fontSize: 15, color: COLORS.textMute },
  partySelectorHint:        { fontSize: 12, color: COLORS.textMute, marginTop: 3 },
  partyChevron:             { paddingHorizontal: 8 },
  clearPartyBtn:            { padding: 8 },

  igstBadge:     { alignSelf: 'flex-start', backgroundColor: '#FFF3CD', borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  igstBadgeText: { fontSize: 11, color: '#856404', fontWeight: FONTS.semibold },
  intraBadge:    { alignSelf: 'flex-start', backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  intraBadgeText:{ fontSize: 11, color: COLORS.primary, fontWeight: FONTS.semibold },

  // Section
  sectionRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle:  { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 0, marginTop: 4 },
  addItemBtn:    { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md },
  addItemBtnText:{ color: COLORS.white, fontWeight: FONTS.bold, fontSize: 13 },

  // Empty items
  emptyItems: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: 32, alignItems: 'center', marginBottom: 12,
    borderWidth: 1.5, borderColor: COLORS.border, borderStyle: 'dashed',
  },
  emptyItemsIcon: { fontSize: 36, marginBottom: 8 },
  emptyItemsText: { fontSize: 15, color: COLORS.text, fontWeight: FONTS.semibold },
  emptyItemsHint: { fontSize: 12, color: COLORS.textMute, marginTop: 4 },

  // Table
  tableHeader:   { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  thCell:        { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase' },
  tableRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  tableRowBorder:{ borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tdName:        { fontSize: 14, fontWeight: FONTS.semibold, color: COLORS.text },
  tdSub:         { fontSize: 11, color: COLORS.textSub, marginTop: 2 },
  tdGst:         { fontSize: 11, color: COLORS.primary, marginTop: 1 },
  tdCell:        { fontSize: 14, color: COLORS.text },
  addMoreRow:    { paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 4 },
  addMoreText:   { fontSize: 14, color: COLORS.primary, fontWeight: FONTS.semibold },

  // Totals
  totalsCard:    { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 14, marginBottom: 12, ...SHADOW.sm },
  totalRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  totalLabel:    { fontSize: 14, color: COLORS.text, fontWeight: FONTS.medium },
  totalValue:    { fontSize: 14, color: COLORS.text, fontWeight: FONTS.semibold },
  totalDivider:  { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  discountRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  discountInput: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 7,
    fontSize: 14, color: COLORS.text, width: 80, textAlign: 'right',
  },

  // Action buttons
  actionRow:          { flexDirection: 'row', gap: 12, marginTop: 4 },
  actionBtn:          { flex: 1, paddingVertical: 14, borderRadius: RADIUS.lg, alignItems: 'center' },
  actionBtnOutline:   { borderWidth: 1.5, borderColor: COLORS.border },
  actionBtnOutlineText: { fontSize: 15, fontWeight: FONTS.semibold, color: COLORS.textSub },
  actionBtnPrimary:   { backgroundColor: COLORS.primary },
  actionBtnPrimaryText: { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.white },

  // Modal shared
  modalContainer: { flex: 1, backgroundColor: COLORS.bg },
  modalHeader:    {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle:  { fontSize: 17, fontWeight: FONTS.bold, color: COLORS.text },
  modalClose:  { fontSize: 20, color: COLORS.textMute, padding: 4 },

  // Modal search
  modalSearchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, margin: 12,
    borderRadius: RADIUS.md, paddingHorizontal: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  modalSearchInput: { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 11 },
  searchIcon:       { fontSize: 16, marginRight: 8 },

  // Party modal items
  modalItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  partyAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center',
  },
  partyAvatarText: { fontSize: 20 },
  modalItemName:   { fontSize: 15, fontWeight: FONTS.semibold, color: COLORS.text },
  modalItemSub:    { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  supplierTag:     { backgroundColor: '#E0F2FE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  supplierTagText: { fontSize: 10, color: '#0369A1', fontWeight: FONTS.bold },

  modalEmpty: { padding: 40, alignItems: 'center' },
  modalEmptyIcon:   { fontSize: 44, marginBottom: 12 },
  modalEmptyText:   { fontSize: 15, color: COLORS.textMute, marginBottom: 16 },
  modalEmptyBtn:    { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: RADIUS.md },
  modalEmptyBtnText:{ color: COLORS.white, fontWeight: FONTS.bold, fontSize: 14 },

  // Tabs
  tabRow:          { flexDirection: 'row', backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabBtn:          { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabBtnActive:    { borderBottomColor: COLORS.primary },
  tabBtnText:      { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  tabBtnTextActive:{ color: COLORS.primary, fontWeight: FONTS.bold },

  // Inventory search
  inventorySearchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, margin: 12,
    borderRadius: RADIUS.md, paddingHorizontal: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  inventorySearchInput: { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 11 },

  // Inventory item row
  invItemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  invItemIconBox: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  invItemIcon:    { fontSize: 20 },
  invItemTopRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  invItemName:    { fontSize: 14, fontWeight: FONTS.semibold, color: COLORS.text, flex: 1 },
  invItemSub:     { fontSize: 11, color: COLORS.textSub },
  invItemPrice:   { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text },
  invItemUnit:    { fontSize: 11, color: COLORS.textMute },

  lowBadge:     { backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full },
  lowBadgeText: { fontSize: 9, fontWeight: FONTS.heavy, color: COLORS.danger },

  addCircle: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  addCircleText: { color: COLORS.white, fontSize: 22, fontWeight: FONTS.bold, lineHeight: 26 },

  // Empty inventory
  inventoryEmpty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 32,
  },
  inventoryEmptyIcon: { fontSize: 52, marginBottom: 14 },
  inventoryEmptyText: { fontSize: 15, color: COLORS.textMute, textAlign: 'center', marginBottom: 20 },
  goInventoryBtn:     { backgroundColor: COLORS.primaryLight, paddingHorizontal: 20, paddingVertical: 10, borderRadius: RADIUS.md },
  goInventoryBtnText: { color: COLORS.primary, fontWeight: FONTS.bold, fontSize: 14 },

  // GST chips
  gstRateRow:        { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  gstChip:           { paddingHorizontal: 16, paddingVertical: 9, borderRadius: RADIUS.md, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  gstChipActive:     { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  gstChipText:       { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  gstChipTextActive: { color: COLORS.primary, fontWeight: FONTS.bold },

  // Unit chips
  unitChip:          { paddingHorizontal: 10, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  unitChipActive:    { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  unitChipText:      { fontSize: 12, color: COLORS.textSub },
  unitChipTextActive:{ color: COLORS.primary, fontWeight: FONTS.bold },

  // Preview box
  previewBox: {
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md,
    padding: 14, marginTop: 14, marginBottom: 4,
  },
  previewTitle:    { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.primary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  previewRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  previewLbl:      { fontSize: 13, color: COLORS.textSub },
  previewVal:      { fontSize: 13, color: COLORS.text, fontWeight: FONTS.semibold },
  previewTotalRow: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: COLORS.primary + '30' },
  previewTotalLbl: { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text },
  previewTotalVal: { fontSize: 18, fontWeight: FONTS.heavy, color: COLORS.primary },

  // Confirm item
  confirmItemBtn:     { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
  confirmItemBtnText: { color: COLORS.white, fontWeight: FONTS.bold, fontSize: 15 },
});
