import Icon from '../../utils/Icon';
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Modal, TextInput, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getPurchaseOrderDetail, updatePOStatus, deletePurchaseOrder } from '../../db';
import { COLORS, RADIUS, FONTS } from '../../theme';

const STATUS_META = {
  active:    { label: 'Active',    bg: '#DBEAFE', text: '#1E40AF', icon: 'clock' },
  partial:   { label: 'Partial',   bg: '#FEF3C7', text: '#92400E', icon: 'loader' },
  completed: { label: 'Completed', bg: '#D1FAE5', text: '#065F46', icon: 'check-circle' },
  cancelled: { label: 'Cancelled', bg: '#F3F4F6', text: '#6B7280', icon: 'x-circle' },
};

export default function PODetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { poId } = route.params;

  const [po, setPO]         = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await getPurchaseOrderDetail(poId);
      setPO(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleDelete = () => {
    const doDelete = async () => {
      await deletePurchaseOrder(poId);
      navigation.goBack();
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete ${po.po_number}? This cannot be undone.`)) doDelete();
    } else {
      Alert.alert('Delete PO', `Delete ${po.po_number}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleCancel = async () => {
    await updatePOStatus(poId, 'cancelled');
    load();
  };

  if (loading) return <View style={[s.container, s.center, { paddingTop: insets.top }]}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  if (!po) return <View style={[s.container, s.center, { paddingTop: insets.top }]}><Text style={{ color: COLORS.textMute }}>PO not found</Text></View>;

  const sm = STATUS_META[po.status] || STATUS_META.active;
  const items = po.items || [];
  const totalOrdered   = items.reduce((sum, i) => sum + (i.qty_ordered || 0), 0);
  const totalDelivered = items.reduce((sum, i) => sum + (i.qty_delivered || 0), 0);
  const fulfillPct     = totalOrdered > 0 ? Math.round((totalDelivered / totalOrdered) * 100) : 0;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.headerTitle}>{po.po_number}</Text>
          {po.client_po_number && po.auto_po_number && po.client_po_number !== po.auto_po_number ? (
            <Text style={s.headerSub2}>Ref: {po.auto_po_number} · {po.party_name} · {po.date}</Text>
          ) : (
            <Text style={s.headerSub}>{po.party_name} · {po.date}</Text>
          )}
        </View>
        <View style={[s.statusPill, { backgroundColor: sm.bg }]}>
          <Text style={[s.statusTxt, { color: sm.text }]}>{sm.label}</Text>
        </View>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => navigation.navigate('CreatePO', { po: { ...po } })}
        >
          <Icon name="edit-2" size={16} color={COLORS.textSub} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.iconBtn, s.iconBtnDanger]} onPress={handleDelete}>
          <Icon name="trash-2" size={16} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Progress overview */}
        <View style={s.progressCard}>
          <View style={s.progressRow}>
            <View style={s.progressCell}>
              <Text style={s.progressLbl}>Total Items</Text>
              <Text style={s.progressVal}>{items.length}</Text>
            </View>
            <View style={s.progressSep} />
            <View style={s.progressCell}>
              <Text style={s.progressLbl}>Delivered</Text>
              <Text style={[s.progressVal, { color: COLORS.success }]}>{totalDelivered}</Text>
            </View>
            <View style={s.progressSep} />
            <View style={s.progressCell}>
              <Text style={s.progressLbl}>Remaining</Text>
              <Text style={[s.progressVal, { color: totalOrdered - totalDelivered > 0 ? COLORS.warning : COLORS.success }]}>
                {totalOrdered - totalDelivered}
              </Text>
            </View>
            <View style={s.progressSep} />
            <View style={s.progressCell}>
              <Text style={s.progressLbl}>Fulfilled</Text>
              <Text style={[s.progressVal, { color: fulfillPct === 100 ? COLORS.success : COLORS.primary }]}>{fulfillPct}%</Text>
            </View>
          </View>
          {/* Progress bar */}
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${fulfillPct}%`, backgroundColor: fulfillPct === 100 ? COLORS.success : COLORS.primary }]} />
          </View>
        </View>

        {/* Customer */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Customer</Text>
          <Text style={s.partyName}>{po.party_name}</Text>
          {po.party_gstin ? <Text style={s.partySub}>GSTIN: {po.party_gstin}</Text> : null}
          {po.party_address ? <Text style={s.partySub}>{po.party_address}</Text> : null}
          <View style={s.dateRow}>
            <View style={s.dateCell}>
              <Text style={s.dateLbl}>PO Number</Text>
              <Text style={s.dateVal}>{po.po_number}</Text>
              {po.client_po_number && po.auto_po_number && po.client_po_number !== po.auto_po_number ? (
                <Text style={s.dateValSub}>Auto: {po.auto_po_number}</Text>
              ) : null}
            </View>
            <View style={s.dateCell}>
              <Text style={s.dateLbl}>PO Date</Text>
              <Text style={s.dateVal}>{po.date}</Text>
            </View>
            {po.valid_until ? (
              <View style={s.dateCell}>
                <Text style={s.dateLbl}>Valid Until</Text>
                <Text style={s.dateVal}>{po.valid_until}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Items with delivery tracking */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Ordered Items ({items.length})</Text>
          {items.map((item, idx) => {
            const remaining = item.qty_ordered - (item.qty_delivered || 0);
            const done = remaining <= 0;
            return (
              <View key={item.id || idx} style={[s.itemRow, idx < items.length - 1 && s.itemBorder]}>
                <View style={[s.itemDot, { backgroundColor: done ? COLORS.success : COLORS.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName}>{item.name}</Text>
                  <Text style={s.itemMeta}>
                    {item.hsn ? `HSN: ${item.hsn}  ·  ` : ''}
                    {item.rate > 0 ? `₹${item.rate}/${item.unit}` : item.unit}
                  </Text>
                  {/* Mini progress bar per item */}
                  <View style={s.itemBarTrack}>
                    <View style={[s.itemBarFill, {
                      width: item.qty_ordered > 0 ? `${Math.min(100, ((item.qty_delivered||0)/item.qty_ordered)*100)}%` : '0%',
                      backgroundColor: done ? COLORS.success : COLORS.primary,
                    }]} />
                  </View>
                  <Text style={s.itemProgress}>
                    <Text style={{ color: done ? COLORS.success : COLORS.primary, fontWeight: FONTS.bold }}>
                      {item.qty_delivered || 0}
                    </Text>
                    {' '}/ {item.qty_ordered} {item.unit} delivered
                    {remaining > 0 ? <Text style={{ color: COLORS.textMute }}>  ·  {remaining} remaining</Text> : <Text style={{ color: COLORS.success }}>  ✓ Complete</Text>}
                  </Text>
                </View>
                {done ? (
                  <View style={s.doneTag}>
                    <Icon name="check" size={12} color={COLORS.success} />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* Notes / Terms */}
        {(po.notes || po.terms) ? (
          <View style={s.card}>
            {po.notes ? <><Text style={s.cardTitle}>Notes</Text><Text style={s.notesText}>{po.notes}</Text></> : null}
            {po.terms ? <><Text style={[s.cardTitle, { marginTop: po.notes ? 10 : 0 }]}>Terms</Text><Text style={s.notesText}>{po.terms}</Text></> : null}
          </View>
        ) : null}

        {/* Info box about invoice linking */}
        <View style={s.infoBox}>
          <Icon name="info" size={14} color={COLORS.info} />
          <Text style={s.infoTxt}>
            Create an invoice for <Text style={{ fontWeight: FONTS.bold }}>{po.party_name}</Text> — the app will ask if it's against this PO and will update the delivery quantities automatically.
          </Text>
        </View>

        {/* Actions */}
        <View style={s.actionsRow}>
          <TouchableOpacity
            style={s.actionPrimary}
            onPress={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice', params: { preselectedParty: { id: po.party_id, name: po.party_name, gstin: po.party_gstin }, preselectedPO: po } })}
          >
            <Icon name="file-text" size={15} color="#fff" />
            <Text style={s.actionPrimaryTxt}>Create Invoice for this PO</Text>
          </TouchableOpacity>
        </View>

        {po.status !== 'cancelled' && po.status !== 'completed' ? (
          <TouchableOpacity style={s.cancelBtn} onPress={handleCancel}>
            <Icon name="x-circle" size={15} color={COLORS.danger} />
            <Text style={s.cancelTxt}>Cancel this PO</Text>
          </TouchableOpacity>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center:    { alignItems: 'center', justifyContent: 'center' },
  header:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn:   { padding: 4 },
  headerTitle:{ fontSize: 17, fontWeight: FONTS.black, color: COLORS.text },
  headerSub: { fontSize: 12, color: COLORS.textMute, marginTop: 1 },
  headerSub2:{ fontSize: 11, color: COLORS.textMute, marginTop: 1 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, marginRight: 6 },
  statusTxt:  { fontSize: 10, fontWeight: FONTS.black, letterSpacing: 0.5 },
  iconBtn:    { padding: 8, borderRadius: RADIUS.sm, backgroundColor: COLORS.bg, marginLeft: 6 },
  iconBtnDanger: { backgroundColor: COLORS.dangerLight },

  progressCard: { backgroundColor: COLORS.card, margin: 12, marginBottom: 0, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: 14 },
  progressRow:  { flexDirection: 'row', marginBottom: 12 },
  progressCell: { flex: 1, alignItems: 'center' },
  progressSep:  { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  progressLbl:  { fontSize: 10, fontWeight: FONTS.medium, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  progressVal:  { fontSize: 20, fontWeight: FONTS.black, color: COLORS.text },
  barTrack:     { height: 6, backgroundColor: COLORS.bg, borderRadius: 3, overflow: 'hidden' },
  barFill:      { height: 6, borderRadius: 3 },

  card:      { backgroundColor: COLORS.card, margin: 12, marginBottom: 0, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: 14 },
  cardTitle: { fontSize: 10, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  partyName: { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 3 },
  partySub:  { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  dateRow:   { flexDirection: 'row', gap: 20, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  dateCell:  { flex: 1 },
  dateLbl:   { fontSize: 10, fontWeight: FONTS.medium, color: COLORS.textMute, textTransform: 'uppercase', marginBottom: 2 },
  dateVal:   { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.text },
  dateValSub:{ fontSize: 10, color: COLORS.textMute, marginTop: 1 },

  itemRow:   { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, gap: 10 },
  itemBorder:{ borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemDot:   { width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0 },
  itemName:  { fontSize: 14, fontWeight: FONTS.semibold, color: COLORS.text, marginBottom: 2 },
  itemMeta:  { fontSize: 11, color: COLORS.textSub, marginBottom: 5 },
  itemBarTrack: { height: 4, backgroundColor: COLORS.bg, borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  itemBarFill:  { height: 4, borderRadius: 2 },
  itemProgress: { fontSize: 12, color: COLORS.textSub },
  doneTag:   { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.successBg, alignItems: 'center', justifyContent: 'center' },

  notesText: { fontSize: 13, color: COLORS.textSub, lineHeight: 20 },
  infoBox:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: COLORS.infoLight, borderRadius: RADIUS.md, padding: 12, margin: 12, marginBottom: 0 },
  infoTxt:   { flex: 1, fontSize: 12, color: COLORS.info, lineHeight: 18 },

  actionsRow:     { padding: 12, paddingBottom: 0 },
  actionPrimary:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.lg },
  actionPrimaryTxt:{ color: '#fff', fontWeight: FONTS.bold, fontSize: 14 },
  cancelBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: RADIUS.lg, backgroundColor: COLORS.dangerLight, margin: 12, marginTop: 10 },
  cancelTxt:  { color: COLORS.danger, fontWeight: FONTS.bold, fontSize: 14 },
});
