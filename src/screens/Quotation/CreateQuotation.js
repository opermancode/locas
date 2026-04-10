  import Icon from '../../utils/Icon';
  import React, { useState, useEffect, useCallback } from 'react';
  import { useFocusEffect } from '@react-navigation/native';
  import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Modal, FlatList, Alert, ActivityIndicator,
    KeyboardAvoidingView, Platform, Dimensions,
  } from 'react-native';
  import { useSafeAreaInsets } from 'react-native-safe-area-context';
  import {
    getParties, getItems,
    saveQuotation, getProfile, peekNextQuoteNumber,
  } from '../../db';
  import {
    calcLineItem, calcInvoiceTotals, detectSupplyType,
    GST_RATES, formatINR, today, addDays, round,
  } from '../../utils/gst';
  import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';

  const UNITS = ['pcs', 'kg', 'g', 'litre', 'ml', 'metre', 'box', 'bag', 'dozen', 'set'];

  const EMPTY_ITEM = {
    item_id: null, name: '', hsn: '', unit: 'pcs',
    qty: '1', rate: '', discount: '0', gst_rate: 18,
  };

  export default function CreateQuotation({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const editQuotation = route?.params?.quotation || null;
    const isDesktop = Platform.OS === 'web' && Dimensions.get('window').width >= 768;

    // ── Core state ────────────────────────────────────────────────
    const [quoteNo, setQuoteNo]           = useState('');
    const [quoteDate, setQuoteDate]       = useState(today());
    const [validUntil, setValidUntil]     = useState(addDays(today(), 15)); // 15 days validity
    const [notes, setNotes]               = useState('');
    const [terms, setTerms]               = useState('This quotation is valid for 15 days.');
    const [quoteDiscount, setQuoteDiscount] = useState('0');
    const [supplyType, setSupplyType]     = useState('intra');

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

    // ── Date Picker state ─────────────────────────────────────────
    const [datePickerVisible, setDatePickerVisible]   = useState(false);
    const [datePickerTarget, setDatePickerTarget]     = useState(null); // 'quote' | 'valid'
    const [calYear, setCalYear]   = useState('');
    const [calMonth, setCalMonth] = useState('');
    const [calDay, setCalDay]     = useState('');
    const [calViewYear, setCalViewYear]   = useState(new Date().getFullYear());
    const [calViewMonth, setCalViewMonth] = useState(new Date().getMonth());

    // ── Picker data ───────────────────────────────────────────────
    const [parties, setParties]         = useState([]);
    const [items, setItems]             = useState([]);
    const [partySearch, setPartySearch] = useState('');
    const [itemSearch, setItemSearch]   = useState('');

    // ── Load ──────────────────────────────────────────────────────
    useEffect(() => { init(); }, []);
    const isMounted = React.useRef(false);

    useFocusEffect(useCallback(() => {
      if (!isMounted.current) { isMounted.current = true; return; }
      (async () => {
        const [p, itms] = await Promise.all([getParties(), getItems()]);
        setParties(p);
        setItems(itms);
      })();
    }, []));

    const init = async () => {
      const [num, p, itms, prof] = await Promise.all([
        peekNextQuoteNumber(),
        getParties(),
        getItems(),
        getProfile(),
      ]);
      setParties(p);
      setItems(itms);
      setProfile(prof);

      if (editQuotation) {
        // Edit mode
        setQuoteNo(editQuotation.quote_number);
        setQuoteDate(editQuotation.date);
        setValidUntil(editQuotation.valid_until || addDays(editQuotation.date, 15));
        setNotes(editQuotation.notes || '');
        setTerms(editQuotation.terms || 'This quotation is valid for 15 days.');
        setQuoteDiscount(String(editQuotation.discount || 0));
        setSupplyType(editQuotation.supply_type || 'intra');

        const matchedParty = editQuotation.party_id
          ? p.find(pt => pt.id === editQuotation.party_id) || null
          : null;
        setParty(matchedParty || (editQuotation.party_name ? {
          id: editQuotation.party_id,
          name: editQuotation.party_name,
          gstin: editQuotation.party_gstin,
          state: editQuotation.party_state,
          state_code: editQuotation.party_state_code,
          address: editQuotation.party_address,
        } : null));

        if (editQuotation.items?.length) {
          setLineItems(editQuotation.items.map(it => ({
            item_id: it.item_id,
            name: it.name,
            hsn: it.hsn || '',
            unit: it.unit || 'pcs',
            qty: String(it.qty),
            rate: String(it.rate),
            discount: String(it.discount || 0),
            gst_rate: it.gst_rate || 18,
            taxable: it.taxable,
            cgst: it.cgst,
            sgst: it.sgst,
            igst: it.igst,
            total: it.total,
          })));
        }
      } else {
        setQuoteNo(num);
      }
    };

    // ── Recalculate totals when items or discount change ──────────
    useEffect(() => {
      const supply = party ? detectSupplyType(profile?.state_code, party.state_code) : supplyType;
      setSupplyType(supply);
      const calculated = lineItems.map(it => calcLineItem(it, supply));
      const t = calcInvoiceTotals(calculated, parseFloat(quoteDiscount) || 0, supply);
      setTotals(t);
    }, [lineItems, quoteDiscount, party, profile]);

    // ── Party selection ───────────────────────────────────────────
    const selectParty = (p) => {
      setParty(p);
      setPartyModal(false);
      setPartySearch('');
    };

    // ── Item management ───────────────────────────────────────────
    const openAddItem = () => {
      setEditingIdx(null);
      setDraftItem(EMPTY_ITEM);
      setItemTab('inventory');
      setItemModal(true);
    };

    const openEditItem = (idx) => {
      setEditingIdx(idx);
      setDraftItem({ ...lineItems[idx] });
      setItemTab('custom');
      setItemModal(true);
    };

    const selectInventoryItem = (inv) => {
      setDraftItem({
        item_id: inv.id,
        name: inv.name,
        hsn: inv.hsn || '',
        unit: inv.unit || 'pcs',
        qty: '1',
        rate: String(inv.sale_price || ''),
        discount: '0',
        gst_rate: inv.gst_rate || 18,
      });
      setItemTab('custom');
    };

    const saveLineItem = () => {
      if (!draftItem.name.trim()) { Alert.alert('Error', 'Item name required'); return; }
      if (!draftItem.rate || parseFloat(draftItem.rate) <= 0) { Alert.alert('Error', 'Rate required'); return; }
      
      const supply = party ? detectSupplyType(profile?.state_code, party.state_code) : supplyType;
      const calculated = calcLineItem(draftItem, supply);
      
      if (editingIdx !== null) {
        const updated = [...lineItems];
        updated[editingIdx] = calculated;
        setLineItems(updated);
      } else {
        setLineItems([...lineItems, calculated]);
      }
      setItemModal(false);
      setDraftItem(EMPTY_ITEM);
    };

    const removeItem = (idx) => {
      Alert.alert('Remove Item', 'Remove this item from quotation?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => {
          setLineItems(lineItems.filter((_, i) => i !== idx));
        }},
      ]);
    };

    // ── Save quotation ────────────────────────────────────────────
    const handleSave = async (status = 'draft') => {
      if (lineItems.length === 0) {
        Alert.alert('Error', 'Add at least one item');
        return;
      }

      setSaving(true);
      try {
        const supply = party ? detectSupplyType(profile?.state_code, party.state_code) : supplyType;
        const finalItems = lineItems.map(it => calcLineItem(it, supply));
        const t = calcInvoiceTotals(finalItems, parseFloat(quoteDiscount) || 0, supply);

        const quotationData = {
          id: editQuotation?.id || null,
          party_id: party?.id || null,
          party_name: party?.name || '',
          party_gstin: party?.gstin || '',
          party_state: party?.state || '',
          party_state_code: party?.state_code || '',
          party_address: party?.address || '',
          date: quoteDate,
          valid_until: validUntil,
          subtotal: t.subtotal,
          discount: parseFloat(quoteDiscount) || 0,
          taxable: t.taxable,
          cgst: t.cgst,
          sgst: t.sgst,
          igst: t.igst,
          total_tax: t.totalTax,
          total: t.total,
          supply_type: supply,
          notes,
          terms,
          status: editQuotation?.status || status,
        };

        const lineItemsData = finalItems.map(it => ({
          item_id: it.item_id,
          name: it.name,
          hsn: it.hsn,
          unit: it.unit,
          qty: parseFloat(it.qty),
          rate: parseFloat(it.rate),
          discount: parseFloat(it.discount) || 0,
          taxable: it.taxable,
          gst_rate: it.gst_rate,
          cgst: it.cgst,
          sgst: it.sgst,
          igst: it.igst,
          total: it.total,
        }));

        await saveQuotation(quotationData, lineItemsData);
        navigation.goBack();
      } catch (e) {
        Alert.alert('Error', e.message);
      } finally {
        setSaving(false);
      }
    };

    // ── Filtered lists ────────────────────────────────────────────
    const filteredParties = parties.filter(p =>
      p.name.toLowerCase().includes(partySearch.toLowerCase()) ||
      (p.phone && p.phone.includes(partySearch))
    );
    const filteredItems = items.filter(i =>
      i.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      (i.code && i.code.toLowerCase().includes(itemSearch.toLowerCase()))
    );

    // ── Date Picker helpers ───────────────────────────────────────
    const QUO_MONTH_NAMES = ['January','February','March','April','May','June',
                            'July','August','September','October','November','December'];

    const openQuoDatePicker = (target) => {
      const dateStr = target === 'quote' ? quoteDate : validUntil;
      const parts   = (dateStr || '').split('-');
      const y = parseInt(parts[0]) || new Date().getFullYear();
      const m = parseInt(parts[1]) || new Date().getMonth() + 1;
      const d = parseInt(parts[2]) || new Date().getDate();
      setCalYear(String(y));
      setCalMonth(String(m).padStart(2,'0'));
      setCalDay(String(d).padStart(2,'0'));
      setCalViewYear(y);
      setCalViewMonth(m - 1);
      setDatePickerTarget(target);
      setDatePickerVisible(true);
    };

    const confirmQuoDatePicker = () => {
      const y = parseInt(calYear), m = parseInt(calMonth), d = parseInt(calDay);
      if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) {
        Alert.alert('Invalid Date', 'Please enter a valid date.');
        return;
      }
      const formatted = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      if (datePickerTarget === 'quote') setQuoteDate(formatted);
      else setValidUntil(formatted);
      setDatePickerVisible(false);
    };

    const selectQuoCalDay = (day) => {
      setCalDay(String(day).padStart(2,'0'));
      setCalYear(String(calViewYear));
      setCalMonth(String(calViewMonth + 1).padStart(2,'0'));
    };

    const getQuoCalendarGrid = () => {
      const total = new Date(calViewYear, calViewMonth + 1, 0).getDate();
      const first = new Date(calViewYear, calViewMonth, 1).getDay();
      const cells = [...Array(first).fill(null), ...Array.from({length: total}, (_, i) => i + 1)];
      const rows = [];
      for (let r = 0; r < Math.ceil(cells.length / 7); r++) rows.push(cells.slice(r*7, r*7+7));
      return rows;
    };

    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.container, { paddingTop: isDesktop ? 0 : insets.top }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Icon name="arrow-left" size={22} color={COLORS.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>
                {editQuotation ? 'Edit Quotation' : 'New Quotation'}
              </Text>
              <Text style={styles.headerSub}>{quoteNo}</Text>
            </View>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={() => handleSave('draft')}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="check" size={16} color="#fff" />
                  <Text style={styles.saveBtnText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scroll}>
            {/* Date & Validity */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Quotation Details</Text>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Date</Text>
                  <TouchableOpacity
                    style={[styles.input, { flexDirection:'row', alignItems:'center', justifyContent:'space-between' }]}
                    onPress={() => openQuoDatePicker('quote')}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: quoteDate ? COLORS.text : COLORS.textMute, fontSize: 14 }}>
                      {quoteDate || 'YYYY-MM-DD'}
                    </Text>
                    <Icon name="calendar" size={15} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Valid Until</Text>
                  <TouchableOpacity
                    style={[styles.input, { flexDirection:'row', alignItems:'center', justifyContent:'space-between' }]}
                    onPress={() => openQuoDatePicker('valid')}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: validUntil ? COLORS.text : COLORS.textMute, fontSize: 14 }}>
                      {validUntil || 'YYYY-MM-DD'}
                    </Text>
                    <Icon name="calendar" size={15} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Party Selection */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Customer</Text>
              <TouchableOpacity style={styles.selectBtn} onPress={() => setPartyModal(true)}>
                {party ? (
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectValue}>{party.name}</Text>
                    {party.gstin && <Text style={styles.selectSub}>GSTIN: {party.gstin}</Text>}
                  </View>
                ) : (
                  <Text style={styles.selectPlaceholder}>Select customer</Text>
                )}
                <Icon name="chevron-right" size={18} color={COLORS.textMute} />
              </TouchableOpacity>
            </View>

            {/* Line Items */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Items</Text>
                <TouchableOpacity style={styles.addItemBtn} onPress={openAddItem}>
                  <Icon name="plus" size={14} color={COLORS.primary} />
                  <Text style={styles.addItemText}>Add Item</Text>
                </TouchableOpacity>
              </View>
              
              {lineItems.length === 0 ? (
                <View style={styles.emptyItems}>
                  <Icon name="package" size={24} color={COLORS.textMute} />
                  <Text style={styles.emptyItemsText}>No items added</Text>
                </View>
              ) : (
                lineItems.map((item, idx) => (
                  <View key={idx} style={styles.lineItem}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => openEditItem(idx)}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemMeta}>
                        {item.qty} {item.unit} × {formatINR(parseFloat(item.rate))}
                        {parseFloat(item.discount) > 0 ? ` (-${item.discount}%)` : ''}
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.itemTotal}>{formatINR(item.total || 0)}</Text>
                    <TouchableOpacity onPress={() => removeItem(idx)} style={styles.removeBtn}>
                      <Icon name="x" size={16} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

            {/* Discount */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Discount</Text>
              <View style={styles.discountRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={quoteDiscount}
                  onChangeText={setQuoteDiscount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textMute}
                />
                <Text style={styles.discountLabel}>% off</Text>
              </View>
            </View>

            {/* Totals */}
            <View style={styles.totalsCard}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>{formatINR(totals.subtotal || 0)}</Text>
              </View>
              {parseFloat(quoteDiscount) > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Discount ({quoteDiscount}%)</Text>
                  <Text style={[styles.totalValue, { color: COLORS.danger }]}>
                    -{formatINR(totals.discountAmount || 0)}
                  </Text>
                </View>
              )}
              {supplyType === 'intra' ? (
                <>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>CGST</Text>
                    <Text style={styles.totalValue}>{formatINR(totals.cgst || 0)}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>SGST</Text>
                    <Text style={styles.totalValue}>{formatINR(totals.sgst || 0)}</Text>
                  </View>
                </>
              ) : (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>IGST</Text>
                  <Text style={styles.totalValue}>{formatINR(totals.igst || 0)}</Text>
                </View>
              )}
              <View style={[styles.totalRow, styles.grandTotal]}>
                <Text style={styles.grandTotalLabel}>Total</Text>
                <Text style={styles.grandTotalValue}>{formatINR(totals.total || 0)}</Text>
              </View>
            </View>

            {/* Notes & Terms */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Notes & Terms</Text>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Additional notes..."
                placeholderTextColor={COLORS.textMute}
                multiline
              />
              <Text style={[styles.label, { marginTop: 12 }]}>Terms</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={terms}
                onChangeText={setTerms}
                placeholder="Terms and conditions..."
                placeholderTextColor={COLORS.textMute}
                multiline
              />
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>

          {/* ══ Date Picker Modal ════════════════════════════════ */}
          <Modal visible={datePickerVisible} animationType="fade" transparent presentationStyle="overFullScreen">
            <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'center', alignItems:'center', padding:20 }}>
              <View style={{ backgroundColor: COLORS.card || '#fff', borderRadius:18, width:'100%', maxWidth:360, padding:20, elevation:10 }}>

                <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                  <Text style={{ fontSize:16, fontWeight:'700', color:COLORS.text }}>
                    {datePickerTarget === 'quote' ? 'Quotation Date' : 'Valid Until'}
                  </Text>
                  <TouchableOpacity onPress={() => setDatePickerVisible(false)}>
                    <Icon name="x" size={18} color={COLORS.textMute} />
                  </TouchableOpacity>
                </View>

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
                      onChangeText={v => { const val=v.replace(/[^0-9]/g,''); setCalMonth(val); const m=parseInt(val); if(m>=1&&m<=12) setCalViewMonth(m-1); }}
                      keyboardType="number-pad" maxLength={2} placeholder="MM" placeholderTextColor={COLORS.textMute}
                    />
                  </View>
                  <View style={{ flex:2 }}>
                    <Text style={{ fontSize:11, color:COLORS.textMute, marginBottom:4, fontWeight:'600' }}>YEAR</Text>
                    <TextInput
                      style={{ borderWidth:1, borderColor:COLORS.border, borderRadius:10, paddingHorizontal:10, paddingVertical:8, fontSize:16, color:COLORS.text, textAlign:'center', backgroundColor:COLORS.bg }}
                      value={calYear}
                      onChangeText={v => { const val=v.replace(/[^0-9]/g,''); setCalYear(val); const y=parseInt(val); if(y>=1900&&y<=2100) setCalViewYear(y); }}
                      keyboardType="number-pad" maxLength={4} placeholder="YYYY" placeholderTextColor={COLORS.textMute}
                    />
                  </View>
                </View>

                <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <TouchableOpacity onPress={() => { const p=calViewMonth===0?11:calViewMonth-1; if(calViewMonth===0) setCalViewYear(y=>y-1); setCalViewMonth(p); }} style={{ padding:6 }}>
                    <Icon name="chevron-left" size={18} color={COLORS.primary} />
                  </TouchableOpacity>
                  <Text style={{ fontSize:14, fontWeight:'700', color:COLORS.text }}>{QUO_MONTH_NAMES[calViewMonth]} {calViewYear}</Text>
                  <TouchableOpacity onPress={() => { const n=calViewMonth===11?0:calViewMonth+1; if(calViewMonth===11) setCalViewYear(y=>y+1); setCalViewMonth(n); }} style={{ padding:6 }}>
                    <Icon name="chevron-right" size={18} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection:'row', marginBottom:4 }}>
                  {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                    <Text key={d} style={{ flex:1, textAlign:'center', fontSize:11, color:COLORS.textMute, fontWeight:'600' }}>{d}</Text>
                  ))}
                </View>

                {getQuoCalendarGrid().map((row, ri) => (
                  <View key={ri} style={{ flexDirection:'row', marginBottom:2 }}>
                    {row.map((day, ci) => {
                      const isSel = day && parseInt(calDay)===day && parseInt(calMonth)===calViewMonth+1 && parseInt(calYear)===calViewYear;
                      return (
                        <TouchableOpacity key={ci} disabled={!day} onPress={() => day && selectQuoCalDay(day)}
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
                  <TouchableOpacity onPress={confirmQuoDatePicker}
                    style={{ flex:1, paddingVertical:12, borderRadius:10, backgroundColor:COLORS.primary, alignItems:'center' }}>
                    <Text style={{ color:'#fff', fontWeight:'700' }}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Party Modal */}
          <Modal visible={partyModal} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { paddingBottom: insets.bottom }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Customer</Text>
                  <TouchableOpacity onPress={() => setPartyModal(false)}>
                    <Icon name="x" size={22} color={COLORS.text} />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalSearch}>
                  <Icon name="search" size={16} color={COLORS.textMute} />
                  <TextInput
                    style={styles.modalSearchInput}
                    placeholder="Search..."
                    placeholderTextColor={COLORS.textMute}
                    value={partySearch}
                    onChangeText={setPartySearch}
                  />
                </View>
                <FlatList
                  data={filteredParties}
                  keyExtractor={p => String(p.id)}
                  renderItem={({ item: p }) => (
                    <TouchableOpacity style={styles.modalItem} onPress={() => selectParty(p)}>
                      <Text style={styles.modalItemName}>{p.name}</Text>
                      {p.gstin && <Text style={styles.modalItemSub}>GSTIN: {p.gstin}</Text>}
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.modalEmpty}>No customers found</Text>
                  }
                />
              </View>
            </View>
          </Modal>

          {/* Item Modal */}
          <Modal visible={itemModal} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { paddingBottom: insets.bottom }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {editingIdx !== null ? 'Edit Item' : 'Add Item'}
                  </Text>
                  <TouchableOpacity onPress={() => setItemModal(false)}>
                    <Icon name="x" size={22} color={COLORS.text} />
                  </TouchableOpacity>
                </View>
                
                {/* Tabs */}
                <View style={styles.tabRow}>
                  <TouchableOpacity
                    style={[styles.tab, itemTab === 'inventory' && styles.tabActive]}
                    onPress={() => setItemTab('inventory')}
                  >
                    <Text style={[styles.tabText, itemTab === 'inventory' && styles.tabTextActive]}>
                      From Inventory
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tab, itemTab === 'custom' && styles.tabActive]}
                    onPress={() => setItemTab('custom')}
                  >
                    <Text style={[styles.tabText, itemTab === 'custom' && styles.tabTextActive]}>
                      Custom Item
                    </Text>
                  </TouchableOpacity>
                </View>

                {itemTab === 'inventory' ? (
                  <>
                    <View style={styles.modalSearch}>
                      <Icon name="search" size={16} color={COLORS.textMute} />
                      <TextInput
                        style={styles.modalSearchInput}
                        placeholder="Search items..."
                        placeholderTextColor={COLORS.textMute}
                        value={itemSearch}
                        onChangeText={setItemSearch}
                      />
                    </View>
                    <FlatList
                      data={filteredItems}
                      keyExtractor={i => String(i.id)}
                      renderItem={({ item: i }) => (
                        <TouchableOpacity style={styles.modalItem} onPress={() => selectInventoryItem(i)}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.modalItemName}>{i.name}</Text>
                            <Text style={styles.modalItemSub}>
                              {formatINR(i.sale_price)} · GST {i.gst_rate}%
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )}
                      ListEmptyComponent={
                        <Text style={styles.modalEmpty}>No items in inventory</Text>
                      }
                    />
                  </>
                ) : (
                  <ScrollView style={{ flex: 1 }}>
                    <View style={{ padding: 16 }}>
                      <Text style={styles.label}>Item Name *</Text>
                      <TextInput
                        style={styles.input}
                        value={draftItem.name}
                        onChangeText={v => setDraftItem({ ...draftItem, name: v })}
                        placeholder="Item name"
                        placeholderTextColor={COLORS.textMute}
                      />
                      
                      <View style={[styles.row, { marginTop: 12 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Qty *</Text>
                          <TextInput
                            style={styles.input}
                            value={draftItem.qty}
                            onChangeText={v => setDraftItem({ ...draftItem, qty: v })}
                            keyboardType="numeric"
                            placeholder="1"
                            placeholderTextColor={COLORS.textMute}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Rate *</Text>
                          <TextInput
                            style={styles.input}
                            value={draftItem.rate}
                            onChangeText={v => setDraftItem({ ...draftItem, rate: v })}
                            keyboardType="numeric"
                            placeholder="0.00"
                            placeholderTextColor={COLORS.textMute}
                          />
                        </View>
                      </View>
                      
                      <View style={[styles.row, { marginTop: 12 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>GST %</Text>
                          <View style={styles.gstRow}>
                            {GST_RATES.map(rate => (
                              <TouchableOpacity
                                key={rate}
                                style={[
                                  styles.gstChip,
                                  draftItem.gst_rate === rate && styles.gstChipActive,
                                ]}
                                onPress={() => setDraftItem({ ...draftItem, gst_rate: rate })}
                              >
                                <Text style={[
                                  styles.gstChipText,
                                  draftItem.gst_rate === rate && styles.gstChipTextActive,
                                ]}>
                                  {rate}%
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Discount %</Text>
                          <TextInput
                            style={styles.input}
                            value={draftItem.discount}
                            onChangeText={v => setDraftItem({ ...draftItem, discount: v })}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={COLORS.textMute}
                          />
                        </View>
                      </View>

                      <TouchableOpacity style={styles.saveItemBtn} onPress={saveLineItem}>
                        <Text style={styles.saveItemBtnText}>
                          {editingIdx !== null ? 'Update Item' : 'Add Item'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                )}
              </View>
            </View>
          </Modal>
        </View>
      </KeyboardAvoidingView>
    );
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: FONTS.bold, color: COLORS.text },
    headerSub: { fontSize: 12, color: COLORS.textMute, marginTop: 2 },
    saveBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 9,
      borderRadius: RADIUS.md,
    },
    saveBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },

    scroll: { padding: 16 },

    card: {
      backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 16,
      marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    cardTitle: { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 12 },
    
    row: { flexDirection: 'row', gap: 12 },
    label: { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textMute, marginBottom: 6, textTransform: 'uppercase' },
    input: {
      backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
      borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 10,
      fontSize: 14, color: COLORS.text,
    },
    textArea: { minHeight: 70, textAlignVertical: 'top' },

    selectBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
      borderRadius: RADIUS.md, padding: 14,
    },
    selectValue: { fontSize: 14, fontWeight: FONTS.medium, color: COLORS.text },
    selectSub: { fontSize: 12, color: COLORS.textMute, marginTop: 2 },
    selectPlaceholder: { fontSize: 14, color: COLORS.textMute },

    addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    addItemText: { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.primary },
    
    emptyItems: { alignItems: 'center', paddingVertical: 24 },
    emptyItemsText: { fontSize: 13, color: COLORS.textMute, marginTop: 8 },
    
    lineItem: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    itemName: { fontSize: 14, fontWeight: FONTS.medium, color: COLORS.text },
    itemMeta: { fontSize: 12, color: COLORS.textMute, marginTop: 2 },
    itemTotal: { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text },
    removeBtn: { padding: 4 },

    discountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    discountLabel: { fontSize: 14, color: COLORS.textMute },

    totalsCard: {
      backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 16,
      marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
    },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
    totalLabel: { fontSize: 13, color: COLORS.textSub },
    totalValue: { fontSize: 13, fontWeight: FONTS.medium, color: COLORS.text },
    grandTotal: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 8, paddingTop: 12 },
    grandTotalLabel: { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text },
    grandTotalValue: { fontSize: 18, fontWeight: FONTS.black, color: COLORS.primary },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
      backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    modalTitle: { fontSize: 17, fontWeight: FONTS.bold, color: COLORS.text },
    modalSearch: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      margin: 16, padding: 12, backgroundColor: COLORS.bg,
      borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    },
    modalSearchInput: { flex: 1, fontSize: 14, color: COLORS.text },
    modalItem: {
      padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    modalItemName: { fontSize: 14, fontWeight: FONTS.medium, color: COLORS.text },
    modalItemSub: { fontSize: 12, color: COLORS.textMute, marginTop: 2 },
    modalEmpty: { padding: 24, textAlign: 'center', color: COLORS.textMute },

    tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
    tabText: { fontSize: 13, fontWeight: FONTS.medium, color: COLORS.textMute },
    tabTextActive: { color: COLORS.primary, fontWeight: FONTS.bold },

    gstRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    gstChip: {
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm,
      backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    },
    gstChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
    gstChipText: { fontSize: 12, fontWeight: FONTS.medium, color: COLORS.textSub },
    gstChipTextActive: { color: COLORS.primary, fontWeight: FONTS.bold },

    saveItemBtn: {
      backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.md,
      alignItems: 'center', marginTop: 20,
    },
    saveItemBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 14 },
  });