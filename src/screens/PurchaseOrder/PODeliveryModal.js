/**
 * PODeliveryModal
 *
 * Shown from CreateInvoice when the selected customer has open POs.
 * User picks which PO items this invoice is fulfilling and sets qty.
 * Returns { poId, deliveries: [{ po_item_id, qty_delivered }] }
 */
import Icon from '../../utils/Icon';
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal,
} from 'react-native';
import { COLORS, RADIUS, FONTS } from '../../theme';

export default function PODeliveryModal({ visible, pos, invoiceItems, onConfirm, onSkip }) {
  // pos = array of open POs for this customer (with .items)
  const [selectedPO, setSelectedPO] = useState(pos?.[0] || null);
  const [deliveries, setDeliveries] = useState({});

  React.useEffect(() => {
    if (pos?.length > 0) {
      setSelectedPO(pos[0]);
      // Pre-fill deliveries from invoice items by matching name
      const pre = {};
      pos[0]?.items?.forEach(poItem => {
        const match = invoiceItems?.find(ii =>
          ii.name?.toLowerCase() === poItem.name?.toLowerCase() ||
          (ii.item_id && ii.item_id === poItem.item_id)
        );
        if (match) {
          const remaining = poItem.qty_ordered - (poItem.qty_delivered || 0);
          pre[poItem.id] = String(Math.min(remaining, parseFloat(match.qty) || 0));
        }
      });
      setDeliveries(pre);
    }
  }, [visible, pos]);

  if (!visible || !pos?.length) return null;

  const handleConfirm = () => {
    const result = Object.entries(deliveries)
      .filter(([, v]) => parseFloat(v) > 0)
      .map(([id, v]) => ({ po_item_id: Number(id), qty_delivered: parseFloat(v) }));
    onConfirm({ poId: selectedPO.id, deliveries: result });
  };

  const poItems = selectedPO?.items || [];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />

          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Link to Purchase Order?</Text>
              <Text style={s.sub}>This customer has open POs. Mark what's being delivered now.</Text>
            </View>
          </View>

          <ScrollView style={s.body} keyboardShouldPersistTaps="handled">

            {/* PO selector if multiple */}
            {pos.length > 1 && (
              <>
                <Text style={s.label}>Select PO</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {pos.map(po => (
                    <TouchableOpacity
                      key={po.id}
                      style={[s.poChip, selectedPO?.id === po.id && s.poChipActive]}
                      onPress={() => { setSelectedPO(po); setDeliveries({}); }}
                    >
                      <Text style={[s.poChipTxt, selectedPO?.id === po.id && s.poChipTxtActive]}>{po.po_number}</Text>
                      <Text style={[s.poChipSub, selectedPO?.id === po.id && { color: COLORS.primary }]}>{po.party_name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {selectedPO && (
              <View style={s.poInfo}>
                <Text style={s.poNum}>{selectedPO.po_number}</Text>
                <Text style={s.poDate}>Date: {selectedPO.date}{selectedPO.valid_until ? `  ·  Valid till: ${selectedPO.valid_until}` : ''}</Text>
              </View>
            )}

            <Text style={s.label}>Set Qty Delivered per Item</Text>
            <Text style={s.hint}>Leave 0 for items not being delivered now.</Text>

            {poItems.map(item => {
              const remaining = item.qty_ordered - (item.qty_delivered || 0);
              if (remaining <= 0) return null; // already fully delivered
              return (
                <View key={item.id} style={s.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemName}>{item.name}</Text>
                    <Text style={s.itemMeta}>
                      {item.qty_delivered || 0} / {item.qty_ordered} {item.unit} delivered
                      {'  ·  '}<Text style={{ color: COLORS.warning }}>{remaining} remaining</Text>
                    </Text>
                  </View>
                  <View style={s.qtyInput}>
                    <TouchableOpacity
                      style={s.qtyBtn}
                      onPress={() => {
                        const cur = parseFloat(deliveries[item.id] || 0);
                        if (cur > 0) setDeliveries(d => ({ ...d, [item.id]: String(Math.max(0, cur - 1)) }));
                      }}
                    >
                      <Text style={s.qtyBtnTxt}>−</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={s.qtyField}
                      value={deliveries[item.id] || '0'}
                      onChangeText={v => setDeliveries(d => ({ ...d, [item.id]: v }))}
                      keyboardType="decimal-pad"
                    />
                    <TouchableOpacity
                      style={s.qtyBtn}
                      onPress={() => {
                        const cur = parseFloat(deliveries[item.id] || 0);
                        setDeliveries(d => ({ ...d, [item.id]: String(Math.min(remaining, cur + 1)) }));
                      }}
                    >
                      <Text style={s.qtyBtnTxt}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            <View style={{ height: 16 }} />
          </ScrollView>

          {/* Actions */}
          <View style={s.footer}>
            <TouchableOpacity style={s.skipBtn} onPress={onSkip}>
              <Text style={s.skipTxt}>Skip — Not a PO Invoice</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.confirmBtn} onPress={handleConfirm}>
              <Icon name="check" size={15} color="#fff" />
              <Text style={s.confirmTxt}>Confirm Delivery</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.65)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl, maxHeight: '85%' },
  handle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderDark, alignSelf: 'center', marginTop: 12 },
  header:  { padding: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title:   { fontSize: 17, fontWeight: FONTS.black, color: COLORS.text, marginBottom: 3 },
  sub:     { fontSize: 12, color: COLORS.textSub, lineHeight: 17 },
  body:    { padding: 16 },
  label:   { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  hint:    { fontSize: 11, color: COLORS.textMute, marginBottom: 10, marginTop: -2 },

  poChip:       { paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, marginRight: 8 },
  poChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  poChipTxt:    { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.textSub },
  poChipTxtActive:{ color: COLORS.primary },
  poChipSub:    { fontSize: 10, color: COLORS.textMute, marginTop: 1 },

  poInfo:  { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 10, marginBottom: 14 },
  poNum:   { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.primary },
  poDate:  { fontSize: 11, color: COLORS.textSub, marginTop: 2 },

  itemRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  itemName: { fontSize: 14, fontWeight: FONTS.semibold, color: COLORS.text, marginBottom: 2 },
  itemMeta: { fontSize: 11, color: COLORS.textSub },

  qtyInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  qtyBtn:   { width: 32, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bgDeep },
  qtyBtnTxt:{ fontSize: 18, fontWeight: FONTS.bold, color: COLORS.text },
  qtyField: { width: 48, textAlign: 'center', fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text, paddingVertical: 8 },

  footer:     { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  skipBtn:    { flex: 1, paddingVertical: 13, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  skipTxt:    { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.textSub },
  confirmBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  confirmTxt: { fontSize: 14, fontWeight: FONTS.bold, color: '#fff' },
});
