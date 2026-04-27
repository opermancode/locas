import Icon from '../../utils/Icon';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, FlatList, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getParties, getItems,
  saveInvoice, getProfile, peekNextInvoiceNumber,
  getOpenPOsForParty, recordPODelivery,
} from '../../db';
import PODeliveryModal from '../PurchaseOrder/PODeliveryModal';
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
  const editInvoice      = route?.params?.invoice        || null;
  const preselectedParty = route?.params?.preselectedParty || route?.params?.prefillParty || null;
  const preselectedPO    = route?.params?.preselectedPO   || null;

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

  // ── Ship To state ─────────────────────────────────────────────
  const [shipToSame, setShipToSame]       = useState(true);
  const [shipToName, setShipToName]       = useState('');
  const [shipToAddress, setShipToAddress] = useState('');
  const [shipToGstin, setShipToGstin]     = useState('');

  // ── PO linking state ──────────────────────────────────────────
  const [openPOs, setOpenPOs]       = useState([]);
  const [poModal, setPOModal]       = useState(false);
  const [pendingSave, setPendingSave] = useState(null); // holds invoice+lineItems while PO modal is open

  // ── Modal state ───────────────────────────────────────────────
  const [partyModal, setPartyModal] = useState(false);
  const [itemModal, setItemModal]   = useState(false);

  // ── Date Picker Modal state ───────────────────────────────────
  const [datePickerVisible, setDatePickerVisible]   = useState(false);
  const [datePickerTarget, setDatePickerTarget]     = useState(null); // 'invoice' | 'due'
  const [calYear, setCalYear]   = useState('');
  const [calMonth, setCalMonth] = useState('');
  const [calDay, setCalDay]     = useState('');
  const [calViewYear, setCalViewYear]   = useState(new Date().getFullYear());
  const [calViewMonth, setCalViewMonth] = useState(new Date().getMonth()); // 0-indexed
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
  const isMounted = React.useRef(false);

  // Reload parties, items and invoice number every time screen comes into focus
  useFocusEffect(useCallback(() => {
    if (!isMounted.current) { isMounted.current = true; return; } // skip first mount — init() handles it
    (async () => {
      const [p, itms, num] = await Promise.all([getParties(), getItems(), peekNextInvoiceNumber()]);
      setParties(p);
      setItems(itms);
      // Only update invoice number if user hasn't manually changed it
      // i.e. it still looks like an auto-generated number (contains digits)
      if (!editInvoice) setInvoiceNo(num);
    })();
  }, []));

  const init = async () => {
    const [num, p, itms, prof] = await Promise.all([
      peekNextInvoiceNumber(),
      getParties(),
      getItems(),
      getProfile(),
    ]);
    setParties(p);
    setItems(itms);
    setProfile(prof);

    if (editInvoice) {
      const isDuplicate = !editInvoice.id; // duplicate: invoice object but no id

      // ── Edit / Duplicate mode: pre-populate all fields ──
      setInvoiceNo(isDuplicate ? num : editInvoice.invoice_number);
      setInvoiceDate(isDuplicate ? today() : editInvoice.date);
      setDueDate(isDuplicate ? addDays(today(), 30) : (editInvoice.due_date || addDays(editInvoice.date, 30)));
      setNotes(editInvoice.notes || '');
      setTerms(editInvoice.terms || 'Payment due within 30 days.');
      setInvoiceDiscount(String(editInvoice.discount || 0));
      setSupplyType(editInvoice.supply_type || 'intra');

      // Restore ship-to fields
      setShipToSame(editInvoice.ship_to_same !== false);
      setShipToName(editInvoice.ship_to_name || '');
      setShipToAddress(editInvoice.ship_to_address || '');
      setShipToGstin(editInvoice.ship_to_gstin || '');

      // Restore party from parties list (to get full object), fallback to invoice snapshot
      const matchedParty = editInvoice.party_id
        ? p.find(pt => pt.id === editInvoice.party_id) || null
        : null;
      setParty(matchedParty || (editInvoice.party_name ? {
        id: editInvoice.party_id,
        name: editInvoice.party_name,
        gstin: editInvoice.party_gstin,
        state: editInvoice.party_state,
        state_code: editInvoice.party_state_code,
        address: editInvoice.party_address,
      } : null));

      // Restore line items from invoice detail (items were loaded in InvoiceDetail)
      if (editInvoice.items && editInvoice.items.length > 0) {
        setLineItems(editInvoice.items.map(it => ({
          item_id:  it.item_id || null,
          name:     it.name,
          hsn:      it.hsn || '',
          unit:     it.unit || 'pcs',
          qty:      it.qty,
          rate:     it.rate,
          discount: it.discount || 0,
          gst_rate: it.gst_rate || 18,
          taxable:  it.taxable,
          cgst:     it.cgst || 0,
          sgst:     it.sgst || 0,
          igst:     it.igst || 0,
          total:    it.total,
          total_tax: (it.cgst || 0) + (it.sgst || 0) + (it.igst || 0),
        })));
      }
    } else {
      setInvoiceNo(num);

      // ── Pre-fill from PO (when navigated from PODetailScreen) ──
      if (preselectedParty) {
        // Match against loaded parties for full object, fallback to passed snapshot
        const matched = p.find(pt => pt.id === preselectedParty.id) || preselectedParty;
        setParty(matched);
      }

      if (preselectedPO) {
        // Set invoice date to PO date
        if (preselectedPO.date) setInvoiceDate(preselectedPO.date);
        // Set notes to reference the PO number
        if (preselectedPO.po_number) {
          setNotes(`Against PO: ${preselectedPO.po_number}`);
        }
      }
    }
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
    // Treat as service if item_type is 'service' OR if item has no stock field at all (legacy items)
    const isService = inv.item_type === 'service' || (inv.stock === 0 && !inv.item_type);
    const existingIdx = lineItems.findIndex(it => it.item_id === inv.id);

    if (existingIdx !== -1) {
      const existing = lineItems[existingIdx];
      const newQty = (parseFloat(existing.qty) || 0) + 1;
      // Only enforce stock limit for products with positive stock
      if (!isService && inv.stock > 0 && newQty > inv.stock) {
        Alert.alert('Not Enough Stock', `${inv.name} only has ${inv.stock} ${inv.unit} in stock.`, [{ text: 'OK' }]);
        return;
      }
      const updated = calcLineItem({ ...existing, qty: newQty }, supplyType);
      setLineItems(prev => prev.map((it, i) => i === existingIdx ? updated : it));
      return;
    }

    // Only block zero-stock for products (never for services)
    if (!isService && inv.stock !== undefined && inv.stock !== null && inv.stock <= 0) {
      Alert.alert('Out of Stock', `${inv.name} has no stock.\nPlease add stock in Inventory first.`, [{ text: 'OK' }]);
      return;
    }
    // Fresh add — keep modal open so user can add more items
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
    setLineItems(prev => [...prev, computed]);
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
    // Alert.alert buttons are no-op on web/Electron — use window.confirm instead
    if (Platform.OS === 'web') {
      if (window.confirm('Remove this item from the invoice?')) {
        setLineItems(prev => prev.filter((_, i) => i !== idx));
      }
      return;
    }
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
        ...(editInvoice ? { id: editInvoice.id } : {}),
        invoice_number:   invoiceNo.trim() || undefined,  // pass user-typed number; undefined = auto-generate
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
        paid:             editInvoice?.paid || 0,
        status:           editInvoice?.status || 'unpaid',
        supply_type:      supplyType,
        notes,
        terms,
        ship_to_same:    shipToSame,
        ship_to_name:    shipToSame ? '' : shipToName,
        ship_to_address: shipToSame ? '' : shipToAddress,
        ship_to_gstin:   shipToSame ? '' : shipToGstin,
        po_number: preselectedPO?.po_number || null,
        po_id:     preselectedPO?.id        || null,
        po_date:   preselectedPO?.date      || null,
      };

      const mappedItems = lineItems.map(it => ({
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
      }));

      // ── Check for open POs for this customer (only on new invoices for sales) ──
      // Skip if already coming from a PO detail screen (preselectedPO is already linked)
      if (!editInvoice && party?.id && !preselectedPO) {
        try {
          const pos = await getOpenPOsForParty(party.id);
          if (pos.length > 0) {
            // Load full details for each PO
            const { getPurchaseOrderDetail } = await import('../../db');
            const posWithItems = await Promise.all(pos.map(p => getPurchaseOrderDetail(p.id)));
            setPendingSave({ invoice, mappedItems });
            setOpenPOs(posWithItems);
            setPOModal(true);
            setSaving(false);
            return; // wait for PO modal response
          }
        } catch (_) {} // if PO check fails, just save normally
      }

      await doSave(invoice, mappedItems, null);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to save');
      setSaving(false);
    }
  };

  const doSave = async (invoice, mappedItems, poDelivery) => {
    setSaving(true);
    try {
      const result = await saveInvoice(invoice, mappedItems);

      // ── Duplicate invoice number conflict ────────────────────────
      if (result?.conflict) {
        setSaving(false);
        const num = result.invoice_number;
        const existingId = result.existingId;
        const msg = `Invoice number "${num}" already exists.\n\nDo you want to replace the existing invoice with this new one?`;

        if (Platform.OS === 'web') {
          if (window.confirm(msg)) {
            // User confirmed replace — save with the existing invoice's id (overwrites it)
            const { getInvoiceDetail } = await import('../../db');
            const existingInv = await getInvoiceDetail(existingId);
            const overwrite = { ...invoice, id: existingId };
            const invoiceId = await saveInvoice(overwrite, mappedItems);
            if (poDelivery?.poId && poDelivery?.deliveries?.length > 0) {
              await recordPODelivery(poDelivery.poId, poDelivery.deliveries).catch(() => {});
            }
            navigation.replace('InvoiceDetail', { invoiceId: existingId });
          }
          // else: user cancelled — stay on form, do nothing
          return;
        }

        Alert.alert(
          'Invoice number already exists',
          `"${num}" is already used.\n\nReplace the existing invoice with this new one?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Replace',
              style: 'destructive',
              onPress: async () => {
                setSaving(true);
                try {
                  const overwrite = { ...invoice, id: existingId };
                  await saveInvoice(overwrite, mappedItems);
                  if (poDelivery?.poId && poDelivery?.deliveries?.length > 0) {
                    await recordPODelivery(poDelivery.poId, poDelivery.deliveries).catch(() => {});
                  }
                  navigation.replace('InvoiceDetail', { invoiceId: existingId });
                } catch (e) {
                  Alert.alert('Error', e.message || 'Failed to save');
                } finally { setSaving(false); }
              },
            },
          ]
        );
        return;
      }

      const invoiceId = result; // normal save returns numeric id

      // Record PO delivery if user linked this invoice to a PO
      if (poDelivery?.poId && poDelivery?.deliveries?.length > 0) {
        try {
          await recordPODelivery(poDelivery.poId, poDelivery.deliveries);
        } catch (e) {
          console.warn('PO delivery record failed:', e.message);
        }
      }

      navigation.replace('InvoiceDetail', { invoiceId });
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Called when user confirms PO delivery from the modal
  const handlePOConfirm = (poDelivery) => {
    setPOModal(false);
    if (!pendingSave) return;
    // Inject po_number/po_id/po_date into the invoice before the first save
    // so we never need a second saveInvoice call just to patch these fields
    const linkedPO = openPOs.find(p => p.id === poDelivery.poId);
    const enrichedInvoice = linkedPO
      ? { ...pendingSave.invoice, po_number: linkedPO.po_number, po_id: linkedPO.id, po_date: linkedPO.date || null }
      : pendingSave.invoice;
    doSave(enrichedInvoice, pendingSave.mappedItems, poDelivery);
  };

  // Called when user skips PO linking
  const handlePOSkip = () => {
    setPOModal(false);
    if (pendingSave) {
      doSave(pendingSave.invoice, pendingSave.mappedItems, null);
    }
  };

  // ── Filtered lists ────────────────────────────────────────────
  const filteredParties = useMemo(() =>
    parties.filter(p =>
      p.name.toLowerCase().includes(partySearch.toLowerCase()) ||
      (p.phone || '').includes(partySearch)
    ), [parties, partySearch]);

  const filteredItems = useMemo(() =>
    items.filter(it =>
      it.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      (it.code || '').toLowerCase().includes(itemSearch.toLowerCase()) ||
      (it.hsn  || '').includes(itemSearch)
    ), [items, itemSearch]);

  // ── Date Picker helpers ───────────────────────────────────────
  const MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];

  const openDatePicker = (target) => {
    const dateStr = target === 'invoice' ? invoiceDate : dueDate;
    const parts   = (dateStr || '').split('-');
    const y = parseInt(parts[0]) || new Date().getFullYear();
    const m = parseInt(parts[1]) || new Date().getMonth() + 1;
    const d = parseInt(parts[2]) || new Date().getDate();
    setCalYear(String(y));
    setCalMonth(String(m).padStart(2, '0'));
    setCalDay(String(d).padStart(2, '0'));
    setCalViewYear(y);
    setCalViewMonth(m - 1);
    setDatePickerTarget(target);
    setDatePickerVisible(true);
  };

  const confirmDatePicker = () => {
    const y = parseInt(calYear);
    const m = parseInt(calMonth);
    const d = parseInt(calDay);
    if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) {
      Alert.alert('Invalid Date', 'Please enter a valid date.');
      return;
    }
    const formatted = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if (datePickerTarget === 'invoice') setInvoiceDate(formatted);
    else setDueDate(formatted);
    setDatePickerVisible(false);
  };

  const selectCalDay = (day) => {
    setCalDay(String(day).padStart(2,'0'));
    setCalYear(String(calViewYear));
    setCalMonth(String(calViewMonth + 1).padStart(2,'0'));
  };

  const getDaysInMonth = (year, month0) => {
    return new Date(year, month0 + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month0) => {
    return new Date(year, month0, 1).getDay(); // 0=Sun
  };

  const renderCalendarGrid = () => {
    const daysInMonth  = getDaysInMonth(calViewYear, calViewMonth);
    const firstDay     = getFirstDayOfMonth(calViewYear, calViewMonth);
    const selectedDay  = parseInt(calDay);
    const selectedMatch = parseInt(calMonth) === calViewMonth + 1 && parseInt(calYear) === calViewYear;
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    const rows = [];
    for (let r = 0; r < Math.ceil(cells.length / 7); r++) {
      rows.push(cells.slice(r * 7, r * 7 + 7));
    }
    return rows;
  };

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
            <Icon name="arrow-left" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{editInvoice ? (editInvoice.id ? 'Edit Invoice' : 'Duplicate Invoice') : 'New Invoice'}</Text>
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
                <TouchableOpacity
                  style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                  onPress={() => openDatePicker('invoice')}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: invoiceDate ? COLORS.text : COLORS.textMute, fontSize: 14 }}>
                    {invoiceDate || 'YYYY-MM-DD'}
                  </Text>
                  <Icon name="calendar" size={15} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel>Due Date</FieldLabel>
                <TouchableOpacity
                  style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                  onPress={() => openDatePicker('due')}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: dueDate ? COLORS.text : COLORS.textMute, fontSize: 14 }}>
                    {dueDate || 'YYYY-MM-DD'}
                  </Text>
                  <Icon name="calendar" size={15} color={COLORS.primary} />
                </TouchableOpacity>
                {/* Quick preset buttons for due date */}
                <View style={{ flexDirection: 'row', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Today',   days: 0  },
                    { label: '7 days',  days: 7  },
                    { label: '15 days', days: 15 },
                    { label: '30 days', days: 30 },
                    { label: '45 days', days: 45 },
                    { label: '60 days', days: 60 },
                  ].map(({ label, days }) => {
                    const preset = addDays(invoiceDate, days);
                    const isActive = dueDate === preset;
                    return (
                      <TouchableOpacity
                        key={label}
                        onPress={() => {
                          setDueDate(preset);
                          setTerms(days === 0
                            ? 'Payment due immediately.'
                            : `Payment due within ${days} days.`);
                        }}
                        style={{
                          paddingHorizontal: 8, paddingVertical: 3,
                          borderRadius: 12, borderWidth: 1,
                          borderColor: isActive ? COLORS.primary : COLORS.border,
                          backgroundColor: isActive ? COLORS.primaryLight : COLORS.bg,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: isActive ? FONTS.bold : FONTS.medium, color: isActive ? COLORS.primary : COLORS.textSub }}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
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
                {party.phone ? <View style={styles.subRow}><Icon name="phone" size={11} color={COLORS.textMute} /><Text style={styles.partySub}> {party.phone}</Text></View> : null}
                {party.gstin   ? <Text style={styles.partySub}>GST: {party.gstin}</Text> : null}
                {party.address ? <View style={styles.subRow}><Icon name="map-pin" size={11} color={COLORS.textMute} /><Text style={styles.partySub} numberOfLines={1}> {party.address}</Text></View> : null}
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
            {party ? (
              <TouchableOpacity
                style={styles.partyChevron}
                onPress={(e) => { e.stopPropagation?.(); setParty(null); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="x" size={16} color={COLORS.textMute} />
              </TouchableOpacity>
            ) : (
              <View style={styles.partyChevron}>
                <Icon name="chevron-right" size={16} color={COLORS.textMute} />
              </View>
            )}
          </TouchableOpacity>

          {/* ── Ship To ───────────────────────────────────── */}
          <SectionTitle title="Ship To" />
          {/* Same as billing checkbox */}
          <TouchableOpacity
            style={styles.shipToSameRow}
            onPress={() => setShipToSame(v => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, shipToSame && styles.checkboxChecked]}>
              {shipToSame && <Icon name="check" size={11} color="#fff" />}
            </View>
            <Text style={styles.shipToSameLabel}>Same as Billing Address</Text>
          </TouchableOpacity>

          {!shipToSame && (
            <View style={styles.card}>
              <FieldLabel>Ship To Name</FieldLabel>
              <TextInput
                style={styles.input}
                value={shipToName}
                onChangeText={setShipToName}
                placeholder="Recipient / warehouse name"
                placeholderTextColor={COLORS.textMute}
              />
              <FieldLabel>Ship To Address</FieldLabel>
              <TextInput
                style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
                value={shipToAddress}
                onChangeText={setShipToAddress}
                placeholder="Full shipping address"
                placeholderTextColor={COLORS.textMute}
                multiline
              />
              <FieldLabel>GSTIN (optional)</FieldLabel>
              <TextInput
                style={styles.input}
                value={shipToGstin}
                onChangeText={setShipToGstin}
                placeholder="GSTIN at delivery location"
                placeholderTextColor={COLORS.textMute}
                autoCapitalize="characters"
              />
            </View>
          )}

          {/* ── Items ─────────────────────────────────────── */}
          <View style={styles.sectionRow}>
            <SectionTitle title={`Items ${lineItems.length > 0 ? `(${lineItems.length})` : ''}`} />
            <TouchableOpacity style={styles.addItemBtn} onPress={openAddItem}>
              <Text style={styles.addItemBtnText}>+ Add Item</Text>
            </TouchableOpacity>
          </View>

          {lineItems.length === 0 ? (
            <TouchableOpacity style={styles.emptyItems} onPress={openAddItem}>
              <Icon name="package" size={28} color={COLORS.textMute} />
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
                    <Icon name="x" size={16} color={COLORS.danger} />
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

      {/* ══ Date Picker Modal ════════════════════════════════ */}
      <Modal visible={datePickerVisible} animationType="fade" transparent presentationStyle="overFullScreen">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: COLORS.card || COLORS.white || '#fff', borderRadius: 18, width: '100%', maxWidth: 360, padding: 20, shadowColor:'#000', shadowOpacity:0.2, shadowRadius:16, elevation:10 }}>

            {/* Header */}
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>
                {datePickerTarget === 'invoice' ? 'Invoice Date' : 'Due Date'}
              </Text>
              <TouchableOpacity onPress={() => setDatePickerVisible(false)}>
                <Icon name="x" size={18} color={COLORS.textMute} />
              </TouchableOpacity>
            </View>

            {/* Manual inputs: Day / Month / Year */}
            <View style={{ flexDirection:'row', gap: 8, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: COLORS.textMute, marginBottom: 4, fontWeight:'600' }}>DAY</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16, color: COLORS.text, textAlign:'center', backgroundColor: COLORS.bg }}
                  value={calDay}
                  onChangeText={v => { setCalDay(v.replace(/[^0-9]/g,'')); }}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="DD"
                  placeholderTextColor={COLORS.textMute}
                />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={{ fontSize: 11, color: COLORS.textMute, marginBottom: 4, fontWeight:'600' }}>MONTH</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16, color: COLORS.text, textAlign:'center', backgroundColor: COLORS.bg }}
                  value={calMonth}
                  onChangeText={v => {
                    const val = v.replace(/[^0-9]/g,'');
                    setCalMonth(val);
                    const m = parseInt(val);
                    if (m >= 1 && m <= 12) setCalViewMonth(m - 1);
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="MM"
                  placeholderTextColor={COLORS.textMute}
                />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={{ fontSize: 11, color: COLORS.textMute, marginBottom: 4, fontWeight:'600' }}>YEAR</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16, color: COLORS.text, textAlign:'center', backgroundColor: COLORS.bg }}
                  value={calYear}
                  onChangeText={v => {
                    const val = v.replace(/[^0-9]/g,'');
                    setCalYear(val);
                    const y = parseInt(val);
                    if (y >= 1900 && y <= 2100) setCalViewYear(y);
                  }}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="YYYY"
                  placeholderTextColor={COLORS.textMute}
                />
              </View>
            </View>

            {/* Month / Year nav */}
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  const prev = calViewMonth === 0 ? 11 : calViewMonth - 1;
                  const prevYear = calViewMonth === 0 ? calViewYear - 1 : calViewYear;
                  setCalViewMonth(prev);
                  setCalViewYear(prevYear);
                }}
                style={{ padding: 6 }}
              >
                <Icon name="chevron-left" size={18} color={COLORS.primary} />
              </TouchableOpacity>
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text }}>
                {MONTH_NAMES[calViewMonth]} {calViewYear}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  const next = calViewMonth === 11 ? 0 : calViewMonth + 1;
                  const nextYear = calViewMonth === 11 ? calViewYear + 1 : calViewYear;
                  setCalViewMonth(next);
                  setCalViewYear(nextYear);
                }}
                style={{ padding: 6 }}
              >
                <Icon name="chevron-right" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            {/* Day-of-week headers */}
            <View style={{ flexDirection:'row', marginBottom: 4 }}>
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                <Text key={d} style={{ flex:1, textAlign:'center', fontSize: 11, color: COLORS.textMute, fontWeight:'600' }}>{d}</Text>
              ))}
            </View>

            {/* Calendar grid */}
            {renderCalendarGrid().map((row, ri) => (
              <View key={ri} style={{ flexDirection:'row', marginBottom: 2 }}>
                {row.map((day, ci) => {
                  const isSelected = day !== null
                    && parseInt(calDay) === day
                    && parseInt(calMonth) === calViewMonth + 1
                    && parseInt(calYear) === calViewYear;
                  return (
                    <TouchableOpacity
                      key={ci}
                      style={{ flex: 1, alignItems:'center', justifyContent:'center', paddingVertical: 6,
                        borderRadius: 20,
                        backgroundColor: isSelected ? COLORS.primary : 'transparent',
                      }}
                      onPress={() => day && selectCalDay(day)}
                      disabled={!day}
                    >
                      <Text style={{
                        fontSize: 13,
                        color: !day ? 'transparent' : isSelected ? '#fff' : COLORS.text,
                        fontWeight: isSelected ? '700' : '400',
                      }}>
                        {day || ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {/* Action buttons */}
            <View style={{ flexDirection:'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => setDatePickerVisible(false)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, alignItems:'center' }}
              >
                <Text style={{ color: COLORS.textSub, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDatePicker}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: COLORS.primary, alignItems:'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ Party Picker Modal ════════════════════════════════ */}
      <Modal visible={partyModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Customer</Text>
            <TouchableOpacity onPress={() => setPartyModal(false)}>
              <Icon name="x" size={18} color={COLORS.textMute} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalSearchBox}>
            <Icon name="search" size={16} color={COLORS.textMute} style={{marginRight:8}} />
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
                <Icon name="x" size={14} color={COLORS.textMute} />
              </TouchableOpacity>
            )}
          </View>

          {/* Walk-in */}
          <TouchableOpacity style={styles.modalItem} onPress={() => selectParty(null)}>
            <View style={styles.partyAvatar}>
              <Icon name="user" size={16} color={COLORS.primary} />
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
                <Icon name="users" size={28} color={COLORS.textMute} />
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {lineItems.length > 0 && editingIdx === null && (
                <TouchableOpacity
                  onPress={() => setItemModal(false)}
                  style={{ backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 }}
                >
                  <Text style={{ color: '#fff', fontWeight: FONTS.bold, fontSize: 13 }}>Done ({lineItems.length})</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setItemModal(false)}>
                <Icon name="x" size={18} color={COLORS.textMute} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, itemTab === 'inventory' && styles.tabBtnActive]}
              onPress={() => setItemTab('inventory')}
            >
              <Text style={[styles.tabBtnText, itemTab === 'inventory' && styles.tabBtnTextActive]}>
                From Inventory
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, itemTab === 'manual' && styles.tabBtnActive]}
              onPress={() => setItemTab('manual')}
            >
              <Text style={[styles.tabBtnText, itemTab === 'manual' && styles.tabBtnTextActive]}>
                Manual Entry
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Inventory Tab ──────────────────────────────── */}
          {itemTab === 'inventory' ? (
            <View style={{ flex: 1 }}>
              <View style={styles.inventorySearchBox}>
                <Icon name="search" size={16} color={COLORS.textMute} style={{marginRight:8}} />
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
                    <Icon name="x" size={14} color={COLORS.textMute} />
                  </TouchableOpacity>
                )}
              </View>

              {filteredItems.length === 0 ? (
                <View style={styles.inventoryEmpty}>
                  <Icon name="package" size={28} color={COLORS.textMute} />
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
                      <><Text style={styles.goInventoryBtnText}>Go to Inventory</Text><Icon name="arrow-right" size={13} color={COLORS.primary} /></>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.goInventoryBtn, { marginTop: 8, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border }]}
                    onPress={() => setItemTab('manual')}
                  >
                    <Text style={[styles.goInventoryBtnText, { color: COLORS.textSub }]}>
                      Add manually
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
                    const isService = inv.item_type === 'service' || (inv.stock === 0 && !inv.item_type);
                    const isLow = !isService && inv.min_stock > 0 && inv.stock <= inv.min_stock;
                    const existingLine = lineItems.find(it => it.item_id === inv.id);
                    return (
                      <TouchableOpacity
                        style={styles.invItemRow}
                        onPress={() => addInventoryItem(inv)}
                        activeOpacity={0.75}
                      >
                        <View style={styles.invItemIconBox}>
                          <Icon name="package" size={16} color={COLORS.textSub} />
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
                            GST {inv.gst_rate}%  ·  {isService ? 'Service' : `Stock: ${inv.stock} ${inv.unit}`}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 6 }}>
                          <Text style={styles.invItemPrice}>₹{inv.sale_price}</Text>
                          <Text style={styles.invItemUnit}>per {inv.unit}</Text>
                        </View>
                        <View style={[styles.addCircle, existingLine && { backgroundColor: COLORS.primary }]}>
                          <Text style={[styles.addCircleText, existingLine && { color: '#fff' }]}>
                            {existingLine ? `+${existingLine.qty}` : '+'}
                          </Text>
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
                  {editingIdx !== null ? 'Update Item' : 'Add to Invoice'}
                </Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </View>
      </Modal>
      {/* ══ PO Delivery Modal ═══════════════════════════════ */}
      <PODeliveryModal
        visible={poModal}
        pos={openPOs}
        invoiceItems={lineItems}
        onConfirm={handlePOConfirm}
        onSkip={handlePOSkip}
      />

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
  // Ship To
  shipToSameRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, paddingHorizontal: 2 },
  shipToSameLabel:{ fontSize: 14, color: COLORS.text },
  checkbox:       { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card },
  checkboxChecked:{ backgroundColor: COLORS.primary, borderColor: COLORS.primary },

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