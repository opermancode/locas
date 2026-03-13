import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, FlatList, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getNextInvoiceNumber, getParties, getItems,
  saveInvoice, getProfile,
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
  const [invoiceNo, setInvoiceNo]     = useState('');
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [dueDate, setDueDate]         = useState(addDays(today(), 30));
  const [notes, setNotes]             = useState('');
  const [terms, setTerms]             = useState('Payment due within 30 days.');
  const [invoiceDiscount, setInvoiceDiscount] = useState('0');
  const [supplyType, setSupplyType]   = useState('intra');

  const [party, setParty]     = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [totals, setTotals]   = useState({});
  const [profile, setProfile] = useState(null);
  const [saving, setSaving]   = useState(false);

  // ── Modal state ───────────────────────────────────────────────
  const [partyModal, setPartyModal]   = useState(false);
  const [itemModal, setItemModal]     = useState(false);
  const [editingIdx, setEditingIdx]   = useState(null); // which line item is being edited
  const [draftItem, setDraftItem]     = useState(EMPTY_ITEM);

  // ── Picker data ───────────────────────────────────────────────
  const [parties, setParties]   = useState([]);
  const [items, setItems]       = useState([]);
  const [partySearch, setPartySearch] = useState('');
  const [itemSearch, setItemSearch]   = useState('');

  // ── Load ──────────────────────────────────────────────────────
  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const [num, p, itms, prof] = await Promise.all([
      getNextInvoiceNumber(),
      getParties(),
      getItems(),
      getProfile(),
    ]);
    setInvoiceNo(num);
    setParties(p);
    setItems(itms);
    setProfile(prof);
  };

  // ── Recalc totals whenever items or discount change ───────────
  useEffect(() => {
    if (lineItems.length === 0) { setTotals({}); return; }
    const t = calcInvoiceTotals(lineItems, parseFloat(invoiceDiscount) || 0, supplyType);
    setTotals(t);
  }, [lineItems, invoiceDiscount, supplyType]);

  // ── Auto detect supply type when party changes ────────────────
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
    setItemModal(true);
  };

  const pickInventoryItem = (inv) => {
    setDraftItem(d => ({
      ...d,
      item_id:  inv.id,
      name:     inv.name,
      hsn:      inv.hsn || '',
      unit:     inv.unit || 'pcs',
      rate:     String(inv.sale_price || ''),
      gst_rate: inv.gst_rate || 18,
    }));
    setItemSearch('');
  };

  const confirmItem = () => {
    if (!draftItem.name.trim()) { Alert.alert('Error', 'Item name is required'); return; }
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
      { text: 'Remove', style: 'destructive', onPress: () => setLineItems(prev => prev.filter((_, i) => i !== idx)) },
    ]);
  };

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = async (status = 'unpaid') => {
    if (lineItems.length === 0) { Alert.alert('Error', 'Add at least one item'); return; }
    setSaving(true);
    try {
      const invoice = {
        invoice_number:   invoiceNo,
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
        status,
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
    (it.code || '').toLowerCase().includes(itemSearch.toLowerCase())
  );

  // ─────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Invoice</Text>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            onPress={() => handleSave('unpaid')}
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

          {/* Invoice Meta */}
          <View style={styles.card}>
            <Row>
              <Field label="Invoice No" flex={1}>
                <TextInput
                  style={styles.input}
                  value={invoiceNo}
                  onChangeText={setInvoiceNo}
                  placeholderTextColor={COLORS.textMute}
                />
              </Field>
              <View style={{ width: 12 }} />
              <Field label="Supply Type" flex={1}>
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
              </Field>
            </Row>

            <Row>
              <Field label="Date" flex={1}>
                <TextInput
                  style={styles.input}
                  value={invoiceDate}
                  onChangeText={setInvoiceDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.textMute}
                />
              </Field>
              <View style={{ width: 12 }} />
              <Field label="Due Date" flex={1}>
                <TextInput
                  style={styles.input}
                  value={dueDate}
                  onChangeText={setDueDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.textMute}
                />
              </Field>
            </Row>
          </View>

          {/* Customer */}
          <SectionTitle title="Bill To" />
          <TouchableOpacity
            style={[styles.card, styles.partySelector]}
            onPress={() => { setPartySearch(''); setPartyModal(true); }}
          >
            {party ? (
              <View style={{ flex: 1 }}>
                <Text style={styles.partyName}>{party.name}</Text>
                {party.phone    ? <Text style={styles.partySub}>📞 {party.phone}</Text> : null}
                {party.gstin    ? <Text style={styles.partySub}>GST: {party.gstin}</Text> : null}
                {party.address  ? <Text style={styles.partySub} numberOfLines={1}>📍 {party.address}</Text> : null}
                {supplyType === 'inter'
                  ? <View style={styles.igstBadge}><Text style={styles.igstBadgeText}>IGST — Inter-state</Text></View>
                  : <View style={styles.intraBadge}><Text style={styles.intraBadgeText}>CGST+SGST — Intra-state</Text></View>
                }
              </View>
            ) : (
              <Text style={styles.partySelectorPlaceholder}>Tap to select customer →</Text>
            )}
            {party && (
              <TouchableOpacity onPress={() => setParty(null)} style={styles.clearPartyBtn}>
                <Text style={{ color: COLORS.textMute, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {/* Line Items */}
          <View style={styles.sectionRow}>
            <SectionTitle title="Items" />
            <TouchableOpacity style={styles.addItemBtn} onPress={openAddItem}>
              <Text style={styles.addItemBtnText}>+ Add Item</Text>
            </TouchableOpacity>
          </View>

          {lineItems.length === 0 ? (
            <TouchableOpacity style={styles.emptyItems} onPress={openAddItem}>
              <Text style={styles.emptyItemsIcon}>📦</Text>
              <Text style={styles.emptyItemsText}>Tap to add items</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.card}>
              {/* Table header */}
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
                >
                  <View style={{ flex: 3 }}>
                    <Text style={styles.tdName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.tdSub}>
                      ₹{item.rate}/{ item.unit}
                      {item.discount > 0 ? `  ${item.discount}% off` : ''}
                      {'  '}GST {item.gst_rate}%
                    </Text>
                    <Text style={styles.tdGst}>
                      {supplyType === 'intra'
                        ? `CGST ₹${round(item.cgst)}  SGST ₹${round(item.sgst)}`
                        : `IGST ₹${round(item.igst)}`}
                    </Text>
                  </View>
                  <Text style={[styles.tdCell, { flex: 1, textAlign: 'center' }]}>{item.qty}</Text>
                  <Text style={[styles.tdCell, { flex: 2, textAlign: 'right', fontWeight: FONTS.bold }]}>
                    {formatINR(item.total)}
                  </Text>
                  <TouchableOpacity style={{ width: 32, alignItems: 'center' }} onPress={() => removeItem(idx)}>
                    <Text style={{ color: COLORS.danger, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Totals */}
          {lineItems.length > 0 && (
            <View style={styles.totalsCard}>
              <TotalRow label="Subtotal"   value={formatINR(totals.subtotal)} />
              <Field label="Invoice Discount (%)" style={{ marginVertical: 8 }}>
                <TextInput
                  style={[styles.input, { width: 80, textAlign: 'right' }]}
                  value={invoiceDiscount}
                  onChangeText={setInvoiceDiscount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textMute}
                />
              </Field>
              <TotalRow label="Taxable Amount" value={formatINR(totals.taxable)} />
              {supplyType === 'intra' ? (
                <>
                  <TotalRow label="CGST" value={formatINR(totals.cgst)} sub />
                  <TotalRow label="SGST" value={formatINR(totals.sgst)} sub />
                </>
              ) : (
                <TotalRow label="IGST" value={formatINR(totals.igst)} sub />
              )}
              <View style={styles.totalDivider} />
              <TotalRow label="Total" value={formatINR(totals.total)} grand />
            </View>
          )}

          {/* Notes & Terms */}
          <View style={styles.card}>
            <Field label="Notes (optional)">
              <TextInput
                style={[styles.input, styles.textarea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any note for customer..."
                placeholderTextColor={COLORS.textMute}
                multiline
                numberOfLines={2}
              />
            </Field>
            <View style={{ height: 12 }} />
            <Field label="Terms & Conditions">
              <TextInput
                style={[styles.input, styles.textarea]}
                value={terms}
                onChangeText={setTerms}
                multiline
                numberOfLines={2}
                placeholderTextColor={COLORS.textMute}
              />
            </Field>
          </View>

          {/* Save buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnOutline]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.actionBtnOutlineText}>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary, saving && { opacity: 0.5 }]}
              onPress={() => handleSave('unpaid')}
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

      {/* ── Party Picker Modal ─────────────────────────────── */}
      <Modal visible={partyModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Customer</Text>
            <TouchableOpacity onPress={() => setPartyModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalSearch}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or phone..."
              placeholderTextColor={COLORS.textMute}
              value={partySearch}
              onChangeText={setPartySearch}
              autoFocus
            />
          </View>
          {/* Walk-in option */}
          <TouchableOpacity style={styles.modalItem} onPress={() => selectParty(null)}>
            <Text style={styles.modalItemName}>🚶 Walk-in Customer</Text>
            <Text style={styles.modalItemSub}>No party linked</Text>
          </TouchableOpacity>
          <FlatList
            data={filteredParties}
            keyExtractor={i => String(i.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.modalItem} onPress={() => selectParty(item)}>
                <Text style={styles.modalItemName}>{item.name}</Text>
                <Text style={styles.modalItemSub}>
                  {[item.phone, item.gstin, item.state].filter(Boolean).join('  ·  ')}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyText}>No parties found</Text>
                <TouchableOpacity
                  onPress={() => { setPartyModal(false); navigation.navigate('PartiesTab'); }}
                >
                  <Text style={styles.modalEmptyLink}>+ Add Party</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </View>
      </Modal>

      {/* ── Item Picker / Editor Modal ─────────────────────── */}
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

          <ScrollView keyboardShouldPersistTaps="handled" style={{ padding: 16 }}>

            {/* Inventory search */}
            <Text style={styles.fieldLabel}>Pick from Inventory</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search inventory..."
              placeholderTextColor={COLORS.textMute}
              value={itemSearch}
              onChangeText={setItemSearch}
            />
            {itemSearch.length > 0 && (
              <View style={styles.inventorySuggestions}>
                {filteredItems.slice(0, 5).map(inv => (
                  <TouchableOpacity
                    key={inv.id}
                    style={styles.suggestionRow}
                    onPress={() => pickInventoryItem(inv)}
                  >
                    <Text style={styles.suggestionName}>{inv.name}</Text>
                    <Text style={styles.suggestionSub}>
                      ₹{inv.sale_price}  ·  GST {inv.gst_rate}%  ·  Stock {inv.stock}
                    </Text>
                  </TouchableOpacity>
                ))}
                {filteredItems.length === 0 && (
                  <Text style={styles.noSuggestions}>No match — fill manually below</Text>
                )}
              </View>
            )}

            <View style={styles.divider} />

            {/* Manual entry */}
            <Field label="Item Name *">
              <TextInput
                style={styles.input}
                value={draftItem.name}
                onChangeText={v => setDraftItem(d => ({ ...d, name: v }))}
                placeholder="e.g. Rice Bag 25kg"
                placeholderTextColor={COLORS.textMute}
              />
            </Field>

            <Row>
              <Field label="HSN/SAC Code" flex={1}>
                <TextInput
                  style={styles.input}
                  value={draftItem.hsn}
                  onChangeText={v => setDraftItem(d => ({ ...d, hsn: v }))}
                  placeholder="e.g. 1006"
                  placeholderTextColor={COLORS.textMute}
                  keyboardType="numeric"
                />
              </Field>
              <View style={{ width: 12 }} />
              <Field label="Unit" flex={1}>
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
              </Field>
            </Row>

            <Row>
              <Field label="Qty *" flex={1}>
                <TextInput
                  style={styles.input}
                  value={draftItem.qty}
                  onChangeText={v => setDraftItem(d => ({ ...d, qty: v }))}
                  keyboardType="decimal-pad"
                  placeholder="1"
                  placeholderTextColor={COLORS.textMute}
                />
              </Field>
              <View style={{ width: 12 }} />
              <Field label="Rate (₹) *" flex={1}>
                <TextInput
                  style={styles.input}
                  value={draftItem.rate}
                  onChangeText={v => setDraftItem(d => ({ ...d, rate: v }))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={COLORS.textMute}
                />
              </Field>
              <View style={{ width: 12 }} />
              <Field label="Disc %" flex={1}>
                <TextInput
                  style={styles.input}
                  value={draftItem.discount}
                  onChangeText={v => setDraftItem(d => ({ ...d, discount: v }))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={COLORS.textMute}
                />
              </Field>
            </Row>

            {/* GST Rate */}
            <Field label="GST Rate">
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
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
            </Field>

            {/* Live preview */}
            {draftItem.rate && draftItem.qty ? (() => {
              const preview = calcLineItem({
                ...draftItem,
                qty:      parseFloat(draftItem.qty) || 0,
                rate:     parseFloat(draftItem.rate) || 0,
                discount: parseFloat(draftItem.discount) || 0,
              }, supplyType);
              return (
                <View style={styles.previewBox}>
                  <Text style={styles.previewTitle}>Preview</Text>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLbl}>Taxable</Text>
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
                  <View style={[styles.previewRow, { marginTop: 4 }]}>
                    <Text style={[styles.previewLbl, { fontWeight: FONTS.bold, color: COLORS.text }]}>Total</Text>
                    <Text style={[styles.previewVal, { fontWeight: FONTS.heavy, color: COLORS.primary, fontSize: 16 }]}>
                      {formatINR(preview.total)}
                    </Text>
                  </View>
                </View>
              );
            })() : null}

            <TouchableOpacity style={styles.confirmItemBtn} onPress={confirmItem}>
              <Text style={styles.confirmItemBtnText}>
                {editingIdx !== null ? '✓ Update Item' : '✓ Add to Invoice'}
              </Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Tiny layout helpers ─────────────────────────────────────────

function Row({ children }) {
  return <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>{children}</View>;
}

function Field({ label, children, flex, style }) {
  return (
    <View style={[{ flex }, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function SectionTitle({ title }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function TotalRow({ label, value, sub, grand }) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, sub && { color: COLORS.textSub, fontSize: 13 }, grand && { fontWeight: FONTS.heavy, fontSize: 16 }]}>
        {label}
      </Text>
      <Text style={[styles.totalValue, sub && { color: COLORS.textSub, fontSize: 13 }, grand && { fontWeight: FONTS.heavy, fontSize: 16, color: COLORS.primary }]}>
        {value}
      </Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bg },
  scroll:      { padding: 16 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn:       { padding: 4 },
  backIcon:      { fontSize: 22, color: COLORS.primary },
  headerTitle:   { fontSize: 17, fontWeight: FONTS.bold, color: COLORS.text },
  saveBtn:       { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.md },
  saveBtnText:   { color: COLORS.white, fontWeight: FONTS.bold, fontSize: 14 },

  // Cards
  card: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: 14, marginBottom: 12, ...SHADOW.sm,
  },

  // Fields
  fieldLabel:    { fontSize: 12, fontWeight: FONTS.semibold, color: COLORS.textSub, marginBottom: 6, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 9,
    fontSize: 14, color: COLORS.text,
  },
  textarea: { minHeight: 56, textAlignVertical: 'top' },

  // Toggle
  toggleRow:        { flexDirection: 'row', gap: 6 },
  toggleBtn:        { flex: 1, paddingVertical: 9, borderRadius: RADIUS.sm, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  toggleBtnActive:  { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  toggleText:       { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  toggleTextActive: { color: COLORS.primary, fontWeight: FONTS.bold },

  // Party selector
  partySelector: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  partyName:                { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text },
  partySub:                 { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  partySelectorPlaceholder: { fontSize: 15, color: COLORS.textMute, flex: 1 },
  clearPartyBtn:            { padding: 8 },
  igstBadge:    { alignSelf: 'flex-start', backgroundColor: '#FFF3CD', borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  igstBadgeText:{ fontSize: 11, color: '#856404', fontWeight: FONTS.semibold },
  intraBadge:   { alignSelf: 'flex-start', backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  intraBadgeText:{ fontSize: 11, color: COLORS.primary, fontWeight: FONTS.semibold },

  // Section
  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 8, marginTop: 4 },
  addItemBtn:   { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.md },
  addItemBtnText: { color: COLORS.white, fontWeight: FONTS.bold, fontSize: 13 },

  // Empty items
  emptyItems:    { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 32, alignItems: 'center', marginBottom: 12, borderWidth: 1.5, borderColor: COLORS.border, borderStyle: 'dashed' },
  emptyItemsIcon:{ fontSize: 36, marginBottom: 8 },
  emptyItemsText:{ fontSize: 14, color: COLORS.textMute },

  // Table
  tableHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  thCell:      { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase' },
  tableRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  tableRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tdName:      { fontSize: 14, fontWeight: FONTS.semibold, color: COLORS.text },
  tdSub:       { fontSize: 11, color: COLORS.textSub, marginTop: 2 },
  tdGst:       { fontSize: 11, color: COLORS.primary, marginTop: 1 },
  tdCell:      { fontSize: 14, color: COLORS.text },

  // Totals
  totalsCard:    { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 14, marginBottom: 12, ...SHADOW.sm },
  totalRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  totalLabel:    { fontSize: 14, color: COLORS.text, fontWeight: FONTS.medium },
  totalValue:    { fontSize: 14, color: COLORS.text, fontWeight: FONTS.semibold },
  totalDivider:  { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },

  // Actions
  actionRow:         { flexDirection: 'row', gap: 12, marginTop: 4 },
  actionBtn:         { flex: 1, paddingVertical: 14, borderRadius: RADIUS.lg, alignItems: 'center' },
  actionBtnOutline:  { borderWidth: 1.5, borderColor: COLORS.border },
  actionBtnOutlineText: { fontSize: 15, fontWeight: FONTS.semibold, color: COLORS.textSub },
  actionBtnPrimary:  { backgroundColor: COLORS.primary },
  actionBtnPrimaryText: { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.white },

  // Modal
  modalContainer: { flex: 1, backgroundColor: COLORS.bg },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle:     { fontSize: 17, fontWeight: FONTS.bold, color: COLORS.text },
  modalClose:     { fontSize: 20, color: COLORS.textMute, padding: 4 },
  modalSearch:    { padding: 12, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalItem:      { padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.card },
  modalItemName:  { fontSize: 15, fontWeight: FONTS.semibold, color: COLORS.text },
  modalItemSub:   { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  modalEmpty:     { padding: 32, alignItems: 'center' },
  modalEmptyText: { fontSize: 15, color: COLORS.textMute, marginBottom: 12 },
  modalEmptyLink: { fontSize: 15, color: COLORS.primary, fontWeight: FONTS.bold },

  // Item form
  searchInput: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14, color: COLORS.text },
  inventorySuggestions: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, marginTop: 4, marginBottom: 4 },
  suggestionRow:  { padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  suggestionName: { fontSize: 14, fontWeight: FONTS.semibold, color: COLORS.text },
  suggestionSub:  { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  noSuggestions:  { padding: 12, fontSize: 13, color: COLORS.textMute, textAlign: 'center' },
  divider:        { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },

  unitChip:          { paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  unitChipActive:    { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  unitChipText:      { fontSize: 12, color: COLORS.textSub },
  unitChipTextActive:{ color: COLORS.primary, fontWeight: FONTS.bold },

  gstChip:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  gstChipActive:     { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  gstChipText:       { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  gstChipTextActive: { color: COLORS.primary, fontWeight: FONTS.bold },

  previewBox:   { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 14, marginTop: 12, marginBottom: 4 },
  previewTitle: { fontSize: 12, fontWeight: FONTS.bold, color: COLORS.primary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  previewRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  previewLbl:   { fontSize: 13, color: COLORS.textSub },
  previewVal:   { fontSize: 13, color: COLORS.text, fontWeight: FONTS.semibold },

  confirmItemBtn:     { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  confirmItemBtnText: { color: COLORS.white, fontWeight: FONTS.bold, fontSize: 15 },
});