import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from '../../utils/Icon';
import { getPurchaseOrders, getPurchaseOrderDetail } from '../../db';
import { formatINR } from '../../utils/gst';
import { COLORS, RADIUS, FONTS } from '../../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TRIGGER_KEY  = '@locas_po_alert_days';
const DEFAULT_DAYS = 7;

const STATUS_CFG = {
  active:  { bg: '#DBEAFE', txt: '#1E40AF', label: 'Active'   },
  partial: { bg: '#FEF3C7', txt: '#92400E', label: 'Partial'  },
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  return diff;
}

export default function POAlertsScreen({ navigation }) {
  const insets      = useSafeAreaInsets();
  const [triggerDays, setTriggerDays] = useState(DEFAULT_DAYS);
  const [alertPOs,    setAlertPOs]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [editingDays, setEditingDays] = useState(false);
  const [tempDays,    setTempDays]    = useState(DEFAULT_DAYS);

  const load = async () => {
    setLoading(true);
    try {
      // Load user trigger preference
      const saved = await AsyncStorage.getItem(TRIGGER_KEY).catch(() => null);
      const days  = saved ? parseInt(saved) : DEFAULT_DAYS;
      setTriggerDays(days);
      setTempDays(days);

      const today   = new Date().toISOString().split('T')[0];
      const cutoff  = new Date();
      cutoff.setDate(cutoff.getDate() + days);
      const cutoffStr = cutoff.toISOString().split('T')[0];

      // Get all active/partial POs
      const all = await getPurchaseOrders();
      const relevant = all.filter(po =>
        (po.status === 'active' || po.status === 'partial') &&
        po.valid_until // only POs with a due date
      );

      // Load item details for each and compute total
      const enriched = await Promise.all(relevant.map(async po => {
        const detail = await getPurchaseOrderDetail(po.id).catch(() => null);
        const items  = detail?.items || [];
        const total  = items.reduce((s, it) => s + (it.qty_ordered || 0) * (it.rate || 0), 0);
        const remaining = items.reduce((s, it) => {
          const rem = (it.qty_ordered || 0) - (it.qty_delivered || 0);
          return s + Math.max(0, rem);
        }, 0);
        return { ...po, total, remaining, items };
      }));

      // Filter: overdue OR due within triggerDays
      const alerts = enriched
        .filter(po => po.valid_until <= cutoffStr)
        .sort((a, b) => a.valid_until.localeCompare(b.valid_until));

      setAlertPOs(alerts);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const saveTriggerDays = async (d) => {
    const clamped = Math.max(1, Math.min(90, parseInt(d) || DEFAULT_DAYS));
    setTriggerDays(clamped);
    setTempDays(clamped);
    await AsyncStorage.setItem(TRIGGER_KEY, String(clamped)).catch(() => {});
    setEditingDays(false);
    load();
  };

  const today = new Date().toISOString().split('T')[0];
  const overduePOs  = alertPOs.filter(po => po.valid_until < today);
  const upcomingPOs = alertPOs.filter(po => po.valid_until >= today);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>PO Due Alerts</Text>
          <Text style={s.subtitle}>
            {alertPOs.length === 0
              ? 'All POs are on track'
              : `${alertPOs.length} PO${alertPOs.length > 1 ? 's' : ''} need attention`}
          </Text>
        </View>
        <TouchableOpacity style={s.settingsBtn} onPress={() => setEditingDays(v => !v)}>
          <Icon name="sliders" size={16} color={COLORS.textSub} />
        </TouchableOpacity>
      </View>

      {/* Trigger threshold setting */}
      {editingDays && (
        <View style={s.triggerBox}>
          <Text style={s.triggerTitle}>Alert Trigger</Text>
          <Text style={s.triggerSub}>Show POs due within how many days?</Text>
          <View style={s.triggerRow}>
            {[3, 7, 14, 30].map(d => (
              <TouchableOpacity
                key={d}
                style={[s.dayChip, tempDays === d && s.dayChipActive]}
                onPress={() => saveTriggerDays(d)}
              >
                <Text style={[s.dayChipTxt, tempDays === d && s.dayChipTxtActive]}>
                  {d}d
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.triggerNote}>
            Currently alerting POs due within <Text style={{ color: COLORS.primary, fontWeight: FONTS.bold }}>{triggerDays} days</Text>
          </Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Overdue section */}
        {overduePOs.length > 0 && (
          <>
            <View style={s.sectionHead}>
              <View style={s.sectionDot} />
              <Text style={[s.sectionTitle, { color: COLORS.danger }]}>Overdue ({overduePOs.length})</Text>
            </View>
            {overduePOs.map(po => <POCard key={po.id} po={po} navigation={navigation} isOverdue />)}
          </>
        )}

        {/* Upcoming section */}
        {upcomingPOs.length > 0 && (
          <>
            <View style={s.sectionHead}>
              <View style={[s.sectionDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={[s.sectionTitle, { color: '#92400E' }]}>Due within {triggerDays} days ({upcomingPOs.length})</Text>
            </View>
            {upcomingPOs.map(po => <POCard key={po.id} po={po} navigation={navigation} />)}
          </>
        )}

        {/* Empty */}
        {!loading && alertPOs.length === 0 && (
          <View style={s.empty}>
            <Icon name="check-circle" size={40} color={COLORS.success} />
            <Text style={s.emptyTitle}>All clear!</Text>
            <Text style={s.emptySub}>
              No POs due within the next {triggerDays} days.{'\n'}
              Adjust the trigger using the settings icon above.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function POCard({ po, navigation, isOverdue }) {
  const days    = daysUntil(po.valid_until);
  const cfg     = STATUS_CFG[po.status] || STATUS_CFG.active;
  const today   = new Date().toISOString().split('T')[0];

  const daysLabel = days === null ? ''
    : days < 0  ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`
    : days === 0 ? 'Due today!'
    : `Due in ${days} day${days !== 1 ? 's' : ''}`;

  return (
    <TouchableOpacity
      style={[s.card, isOverdue && s.cardOverdue]}
      onPress={() => navigation.navigate('PODetail', { poId: po.id })}
      activeOpacity={0.8}
    >
      {/* Card header */}
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={s.poNum}>{po.po_number}</Text>
            <View style={[s.statusPill, { backgroundColor: cfg.bg }]}>
              <Text style={[s.statusTxt, { color: cfg.txt }]}>{cfg.label}</Text>
            </View>
          </View>
          <Text style={s.party}>{po.party_name || '—'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={s.totalAmt}>{formatINR(po.total)}</Text>
          <View style={[s.daysPill, isOverdue && s.daysPillOD]}>
            <Icon
              name={isOverdue ? 'alert-triangle' : 'clock'}
              size={10}
              color={isOverdue ? '#991B1B' : '#92400E'}
            />
            <Text style={[s.daysTxt, isOverdue && { color: '#991B1B' }]}>{daysLabel}</Text>
          </View>
        </View>
      </View>

      {/* Dates */}
      <View style={s.dateRow}>
        <View style={s.dateCell}>
          <Text style={s.dateLbl}>PO Date</Text>
          <Text style={s.dateVal}>{po.date}</Text>
        </View>
        <View style={s.dateCell}>
          <Text style={s.dateLbl}>Due Date</Text>
          <Text style={[s.dateVal, isOverdue && { color: COLORS.danger, fontWeight: FONTS.bold }]}>
            {po.valid_until}
          </Text>
        </View>
        <View style={s.dateCell}>
          <Text style={s.dateLbl}>Remaining</Text>
          <Text style={[s.dateVal, { color: COLORS.warning }]}>
            {po.remaining > 0 ? `${po.remaining} units` : '—'}
          </Text>
        </View>
      </View>

      {/* Items preview */}
      {(po.items || []).slice(0, 3).map((it, i) => {
        const rem = Math.max(0, (it.qty_ordered || 0) - (it.qty_delivered || 0));
        if (rem === 0) return null;
        return (
          <View key={i} style={s.itemRow}>
            <View style={s.itemDot} />
            <Text style={s.itemName} numberOfLines={1}>{it.name}</Text>
            <Text style={s.itemRem}>{rem} remaining</Text>
          </View>
        );
      })}
      {(po.items || []).length > 3 && (
        <Text style={s.moreItems}>+{(po.items || []).length - 3} more items</Text>
      )}

      {/* Action row */}
      <View style={s.actionRow}>
        <TouchableOpacity
          style={s.actionBtn}
          onPress={() => navigation.navigate('CreateInvoice', {
            prefillParty: { id: po.party_id, name: po.party_name },
            preselectedPO: po,
          })}
        >
          <Icon name="file-plus" size={13} color={COLORS.primary} />
          <Text style={s.actionTxt}>Create Invoice</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: COLORS.bg }]}
          onPress={() => navigation.navigate('PODetail', { poId: po.id })}
        >
          <Icon name="eye" size={13} color={COLORS.textSub} />
          <Text style={[s.actionTxt, { color: COLORS.textSub }]}>View PO</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bg },
  header:      { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:12, backgroundColor:COLORS.card, borderBottomWidth:1, borderBottomColor:COLORS.border },
  backBtn:     { padding:4, marginRight:10 },
  title:       { fontSize:18, fontWeight:FONTS.black, color:COLORS.text },
  subtitle:    { fontSize:12, color:COLORS.textMute, marginTop:1 },
  settingsBtn: { padding:8, backgroundColor:COLORS.bg, borderRadius:RADIUS.md },

  // Trigger box
  triggerBox:  { margin:12, backgroundColor:COLORS.card, borderRadius:RADIUS.lg, padding:14, borderWidth:1, borderColor:COLORS.border },
  triggerTitle:{ fontSize:14, fontWeight:FONTS.bold, color:COLORS.text, marginBottom:3 },
  triggerSub:  { fontSize:12, color:COLORS.textSub, marginBottom:12 },
  triggerRow:  { flexDirection:'row', gap:8, marginBottom:10 },
  dayChip:     { paddingHorizontal:16, paddingVertical:8, borderRadius:RADIUS.md, backgroundColor:COLORS.bg, borderWidth:1, borderColor:COLORS.border },
  dayChipActive:{ backgroundColor:COLORS.primary, borderColor:COLORS.primary },
  dayChipTxt:  { fontSize:13, fontWeight:FONTS.semibold, color:COLORS.textSub },
  dayChipTxtActive: { color:'#fff' },
  triggerNote: { fontSize:11, color:COLORS.textMute },

  // Section heads
  sectionHead:  { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:16, paddingTop:16, paddingBottom:6 },
  sectionDot:   { width:8, height:8, borderRadius:4, backgroundColor:COLORS.danger },
  sectionTitle: { fontSize:12, fontWeight:FONTS.bold, textTransform:'uppercase', letterSpacing:0.5 },

  // Card
  card:        { marginHorizontal:12, marginBottom:10, backgroundColor:COLORS.card, borderRadius:RADIUS.xl, padding:14, borderWidth:1, borderColor:COLORS.border },
  cardOverdue: { borderColor:COLORS.danger+'40', borderWidth:1.5 },
  cardHeader:  { flexDirection:'row', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 },
  poNum:       { fontSize:15, fontWeight:FONTS.black, color:COLORS.text },
  party:       { fontSize:12, color:COLORS.textSub, marginTop:3 },
  statusPill:  { paddingHorizontal:7, paddingVertical:2, borderRadius:RADIUS.full },
  statusTxt:   { fontSize:9, fontWeight:FONTS.black, letterSpacing:0.3 },
  totalAmt:    { fontSize:15, fontWeight:FONTS.black, color:COLORS.text },
  daysPill:    { flexDirection:'row', alignItems:'center', gap:3, backgroundColor:'#FEF3C7', paddingHorizontal:7, paddingVertical:3, borderRadius:RADIUS.full },
  daysPillOD:  { backgroundColor:'#FEE2E2' },
  daysTxt:     { fontSize:10, fontWeight:FONTS.bold, color:'#92400E' },

  // Dates
  dateRow:  { flexDirection:'row', backgroundColor:COLORS.bg, borderRadius:RADIUS.md, padding:10, marginBottom:10, gap:0 },
  dateCell: { flex:1, alignItems:'center' },
  dateLbl:  { fontSize:9, color:COLORS.textMute, textTransform:'uppercase', letterSpacing:0.4, marginBottom:3 },
  dateVal:  { fontSize:12, fontWeight:FONTS.semibold, color:COLORS.text },

  // Items
  itemRow:   { flexDirection:'row', alignItems:'center', gap:7, paddingVertical:4, borderTopWidth:1, borderTopColor:COLORS.border },
  itemDot:   { width:5, height:5, borderRadius:3, backgroundColor:COLORS.primary, flexShrink:0 },
  itemName:  { flex:1, fontSize:12, color:COLORS.text },
  itemRem:   { fontSize:11, color:COLORS.warning, fontWeight:FONTS.semibold },
  moreItems: { fontSize:11, color:COLORS.textMute, marginTop:4, paddingTop:4, borderTopWidth:1, borderTopColor:COLORS.border },

  // Actions
  actionRow: { flexDirection:'row', gap:8, marginTop:12, paddingTop:10, borderTopWidth:1, borderTopColor:COLORS.border },
  actionBtn: { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:5, paddingVertical:9, borderRadius:RADIUS.md, backgroundColor:COLORS.primaryLight, borderWidth:1, borderColor:COLORS.primary+'30' },
  actionTxt: { fontSize:12, fontWeight:FONTS.bold, color:COLORS.primary },

  // Empty
  empty:      { alignItems:'center', paddingTop:80, paddingHorizontal:32, gap:12 },
  emptyTitle: { fontSize:18, fontWeight:FONTS.bold, color:COLORS.text },
  emptySub:   { fontSize:13, color:COLORS.textMute, textAlign:'center', lineHeight:20 },
});
