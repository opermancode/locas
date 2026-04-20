import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from '../../utils/Icon';
import { getPurchaseOrders, getPurchaseOrderDetail } from '../../db';
import { formatINR, formatINRCompact } from '../../utils/gst';
import { COLORS, RADIUS, FONTS } from '../../theme';

const STATUS_COLOR = {
  active:  { bg: '#DBEAFE', txt: '#1E40AF' },
  partial: { bg: '#FEF3C7', txt: '#92400E' },
};

export default function POBacklogScreen({ navigation }) {
  const insets   = useSafeAreaInsets();
  const [pos,    setPos]    = useState([]);
  const [loading,setLoading]= useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const all = await getPurchaseOrders();
      const active = all.filter(po => po.status === 'active' || po.status === 'partial');
      const enriched = await Promise.all(active.map(async po => {
        const detail = await getPurchaseOrderDetail(po.id).catch(() => null);
        const items  = (detail?.items || []).map(it => ({
          ...it,
          remaining:     Math.max(0, (it.qty_ordered || 0) - (it.qty_delivered || 0)),
          remainingValue:Math.max(0, (it.qty_ordered || 0) - (it.qty_delivered || 0)) * (it.rate || 0),
          totalValue:    (it.qty_ordered || 0) * (it.rate || 0),
        })).filter(it => it.remaining > 0);
        const totalOrdered   = (detail?.items || []).reduce((s, it) => s + (it.qty_ordered || 0) * (it.rate || 0), 0);
        const remainingValue = items.reduce((s, it) => s + it.remainingValue, 0);
        return { ...po, items, totalOrdered, remainingValue };
      }));
      // Only show POs that still have remaining items
      setPos(enriched.filter(po => po.remainingValue > 0).sort((a, b) => b.remainingValue - a.remainingValue));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const totalRemaining = pos.reduce((s, po) => s + po.remainingValue, 0);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>PO Backlog</Text>
          <Text style={s.subtitle}>
            {pos.length} active · {formatINR(totalRemaining)} remaining
          </Text>
        </View>
      </View>

      {/* Summary bar */}
      <View style={s.summaryBar}>
        <View style={s.summaryCell}>
          <Text style={s.summaryVal}>{pos.length}</Text>
          <Text style={s.summaryLbl}>Open POs</Text>
        </View>
        <View style={s.summaryDiv} />
        <View style={s.summaryCell}>
          <Text style={[s.summaryVal, { color: COLORS.danger }]}>{formatINRCompact(totalRemaining)}</Text>
          <Text style={s.summaryLbl}>Total Remaining</Text>
        </View>
      </View>

      {/* Board */}
      <ScrollView
        contentContainerStyle={s.board}
        showsVerticalScrollIndicator={false}
      >
        {pos.length === 0 && !loading && (
          <View style={s.empty}>
            <Icon name="check-circle" size={40} color={COLORS.success} />
            <Text style={s.emptyTitle}>All delivered!</Text>
            <Text style={s.emptySub}>No remaining quantities on any PO.</Text>
          </View>
        )}

        <View style={s.ticketGrid}>
          {pos.map(po => {
            const cfg   = STATUS_COLOR[po.status] || STATUS_COLOR.active;
            const pct   = po.totalOrdered > 0
              ? Math.round(((po.totalOrdered - po.remainingValue) / po.totalOrdered) * 100)
              : 0;
            return (
              <TouchableOpacity
                key={po.id}
                style={s.ticket}
                onPress={() => navigation.navigate('PODetail', { poId: po.id })}
                activeOpacity={0.8}
              >
                {/* Ticket header */}
                <View style={s.ticketHead}>
                  <View style={[s.statusChip, { backgroundColor: cfg.bg }]}>
                    <Text style={[s.statusTxt, { color: cfg.txt }]}>{po.status}</Text>
                  </View>
                  <Text style={s.poNum}>{po.po_number}</Text>
                </View>

                {/* Party */}
                <Text style={s.partyName} numberOfLines={1}>{po.party_name || '—'}</Text>

                {/* Progress bar */}
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${pct}%` }]} />
                </View>
                <Text style={s.progressTxt}>{pct}% delivered</Text>

                {/* Values */}
                <View style={s.valueRow}>
                  <View style={s.valueCell}>
                    <Text style={s.valueLbl}>Ordered</Text>
                    <Text style={[s.valueAmt, { color: '#10B981' }]}>{formatINRCompact(po.totalOrdered)}</Text>
                  </View>
                  <View style={s.valueCell}>
                    <Text style={s.valueLbl}>Remaining</Text>
                    <Text style={[s.valueAmt, { color: COLORS.danger }]}>{formatINRCompact(po.remainingValue)}</Text>
                  </View>
                </View>

                {/* Item pills */}
                <View style={s.itemsWrap}>
                  {po.items.slice(0, 3).map((it, i) => (
                    <View key={i} style={s.itemPill}>
                      <Text style={s.itemPillTxt} numberOfLines={1}>
                        {it.name} · <Text style={{ color: COLORS.danger }}>{it.remaining} left</Text>
                      </Text>
                    </View>
                  ))}
                  {po.items.length > 3 && (
                    <View style={s.itemPill}>
                      <Text style={s.itemPillTxt}>+{po.items.length - 3} more</Text>
                    </View>
                  )}
                </View>

                {/* Due date */}
                {po.valid_until && (
                  <View style={s.dueRow}>
                    <Icon name="calendar" size={10} color={COLORS.textMute} />
                    <Text style={s.dueTxt}>Due {po.valid_until}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bg },
  header:      { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:12, backgroundColor:COLORS.card, borderBottomWidth:1, borderBottomColor:COLORS.border },
  backBtn:     { padding:4, marginRight:10 },
  title:       { fontSize:18, fontWeight:FONTS.black, color:COLORS.text },
  subtitle:    { fontSize:12, color:COLORS.textMute, marginTop:1 },

  summaryBar:  { flexDirection:'row', backgroundColor:COLORS.card, borderBottomWidth:1, borderBottomColor:COLORS.border, paddingVertical:12 },
  summaryCell: { flex:1, alignItems:'center' },
  summaryDiv:  { width:1, backgroundColor:COLORS.border },
  summaryVal:  { fontSize:20, fontWeight:FONTS.black, color:COLORS.text },
  summaryLbl:  { fontSize:10, color:COLORS.textMute, textTransform:'uppercase', letterSpacing:0.4, marginTop:2 },

  board:       { padding:12, paddingBottom:40 },

  ticketGrid:  {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  ticket: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: Platform.OS === 'web' ? 'calc(50% - 6px)' : '48%',
    minWidth: 260,
    flex: Platform.OS === 'web' ? undefined : 1,
  },

  ticketHead:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:6 },
  statusChip:  { paddingHorizontal:6, paddingVertical:2, borderRadius:RADIUS.full },
  statusTxt:   { fontSize:9, fontWeight:FONTS.black, textTransform:'uppercase', letterSpacing:0.3 },
  poNum:       { fontSize:11, fontWeight:FONTS.bold, color:COLORS.textSub },

  partyName:   { fontSize:15, fontWeight:FONTS.black, color:COLORS.text, marginBottom:10 },

  progressTrack:{ height:4, backgroundColor:COLORS.border, borderRadius:2, marginBottom:4, overflow:'hidden' },
  progressFill: { height:'100%', backgroundColor:'#10B981', borderRadius:2 },
  progressTxt:  { fontSize:10, color:COLORS.textMute, marginBottom:10 },

  valueRow:    { flexDirection:'row', gap:8, marginBottom:10 },
  valueCell:   { flex:1, backgroundColor:COLORS.bg, borderRadius:RADIUS.md, padding:8, alignItems:'center' },
  valueLbl:    { fontSize:9, color:COLORS.textMute, textTransform:'uppercase', letterSpacing:0.3, marginBottom:3 },
  valueAmt:    { fontSize:14, fontWeight:FONTS.black },

  itemsWrap:   { flexDirection:'row', flexWrap:'wrap', gap:4, marginBottom:8 },
  itemPill:    { backgroundColor:COLORS.bg, borderRadius:RADIUS.full, paddingHorizontal:8, paddingVertical:3, borderWidth:1, borderColor:COLORS.border },
  itemPillTxt: { fontSize:10, color:COLORS.textSub },

  dueRow:      { flexDirection:'row', alignItems:'center', gap:4 },
  dueTxt:      { fontSize:10, color:COLORS.textMute },

  empty:       { alignItems:'center', paddingTop:80, gap:12 },
  emptyTitle:  { fontSize:18, fontWeight:FONTS.bold, color:COLORS.text },
  emptySub:    { fontSize:13, color:COLORS.textMute, textAlign:'center' },
});
