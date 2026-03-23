import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getInvoices } from '../../db';
import { formatINR, formatINRCompact, today } from '../../utils/gst';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';

const STATUS_STYLE = {
  paid:    { bg: '#D1FAE5', text: '#065F46' },
  partial: { bg: '#FEF3C7', text: '#92400E' },
  unpaid:  { bg: '#FEE2E2', text: '#991B1B' },
  overdue: { bg: '#FECACA', text: '#7F1D1D' },
};

function resolveStatus(inv) {
  if (inv.status === 'paid') return 'paid';
  if (inv.due_date && inv.due_date < today() && inv.status !== 'paid') return 'overdue';
  return inv.status || 'unpaid';
}

export default function PartyDetail({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { partyId } = route.params;

  const [invoices, setInvoices] = useState([]);
  const [party, setParty]       = useState(null);
  const [loading, setLoading]   = useState(true);

  const load = async () => {
    try {
      // Get all invoices for this party
      const all = await getInvoices({});
      const partyInvs = all.filter(i => i.party_id === partyId);
      setInvoices(partyInvs);

      // Reconstruct party info from first invoice or params
      if (partyInvs.length > 0) {
        const i = partyInvs[0];
        setParty({
          id:         partyId,
          name:       i.party_name,
          gstin:      i.party_gstin,
          state:      i.party_state,
          state_code: i.party_state_code,
          address:    i.party_address,
        });
      } else {
        setParty({ id: partyId, name: route.params?.partyName || 'Party' });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const totalBusiness = invoices.reduce((s, i) => s + (i.total || 0), 0);
  const totalPaid     = invoices.reduce((s, i) => s + (i.paid  || 0), 0);
  const outstanding   = totalBusiness - totalPaid;
  const invoiceCount  = invoices.length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{party?.name || 'Party'}</Text>
        <TouchableOpacity
          style={styles.newInvBtn}
          onPress={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })}
        >
          <Text style={styles.newInvBtnText}>+ Invoice</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Party Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarText}>{party?.name?.charAt(0)?.toUpperCase() || '?'}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.partyName}>{party?.name}</Text>
            {party?.gstin   ? <Text style={styles.partySub}>GST: {party.gstin}</Text>   : null}
            {party?.state   ? <Text style={styles.partySub}>📍 {party.state} ({party.state_code})</Text> : null}
            {party?.address ? <Text style={styles.partySub} numberOfLines={2}>{party.address}</Text> : null}
          </View>
        </View>

        {/* KPI strip */}
        <View style={styles.kpiStrip}>
          <KPIChip label="Total Business" value={formatINRCompact(totalBusiness)} color={COLORS.primary} />
          <View style={styles.kpiDivider} />
          <KPIChip label="Paid"           value={formatINRCompact(totalPaid)}     color={COLORS.success} />
          <View style={styles.kpiDivider} />
          <KPIChip label="Outstanding"    value={formatINRCompact(outstanding)}   color={outstanding > 0 ? COLORS.danger : COLORS.textMute} />
          <View style={styles.kpiDivider} />
          <KPIChip label="Invoices"       value={String(invoiceCount)}            color={COLORS.secondary} />
        </View>

        {/* Invoice list */}
        <Text style={styles.sectionTitle}>Invoice History</Text>

        {invoices.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🧾</Text>
            <Text style={styles.emptyText}>No invoices yet for this party</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })}
            >
              <Text style={styles.emptyBtnText}>Create Invoice</Text>
            </TouchableOpacity>
          </View>
        ) : (
          invoices.map((inv, i) => {
            const status = resolveStatus(inv);
            const ss     = STATUS_STYLE[status] || STATUS_STYLE.unpaid;
            const balance= (inv.total || 0) - (inv.paid || 0);
            return (
              <TouchableOpacity
                key={inv.id}
                style={styles.invCard}
                onPress={() => navigation.navigate('InvoicesTab', { screen: 'InvoiceDetail', params: { invoiceId: inv.id } })}
                activeOpacity={0.85}
              >
                <View style={styles.invCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invNum}>{inv.invoice_number}</Text>
                    <Text style={styles.invDate}>{inv.date}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.invTotal}>{formatINR(inv.total)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: ss.bg }]}>
                      <Text style={[styles.statusText, { color: ss.text }]}>{status.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
                {balance > 0.01 && status !== 'paid' && (
                  <View style={styles.balanceRow}>
                    <Text style={styles.balanceLabel}>Balance</Text>
                    <Text style={styles.balanceValue}>{formatINR(balance)}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function KPIChip({ label, value, color }) {
  return (
    <View style={styles.kpiChip}>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:    { padding: 16 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn:      { padding: 4 },
  backIcon:     { fontSize: 22, color: COLORS.primary },
  headerTitle:  { flex: 1, fontSize: 17, fontWeight: FONTS.bold, color: COLORS.text, marginLeft: 10 },
  newInvBtn:    { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.md },
  newInvBtnText:{ color: COLORS.white, fontWeight: FONTS.bold, fontSize: 13 },

  infoCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'flex-start', ...SHADOW.sm,
  },
  avatarBox: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: FONTS.heavy, color: COLORS.primary },
  partyName:  { fontSize: 18, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 4 },
  partySub:   { fontSize: 13, color: COLORS.textSub, marginTop: 2 },

  kpiStrip: {
    flexDirection: 'row', backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg, padding: 12,
    marginBottom: 16, ...SHADOW.sm,
  },
  kpiChip:    { flex: 1, alignItems: 'center' },
  kpiValue:   { fontSize: 14, fontWeight: FONTS.heavy, marginBottom: 2 },
  kpiLabel:   { fontSize: 10, color: COLORS.textMute, textAlign: 'center' },
  kpiDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },

  sectionTitle: { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.textSub, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  invCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 10, overflow: 'hidden', ...SHADOW.sm,
  },
  invCardTop: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', padding: 14,
  },
  invNum:      { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 3 },
  invDate:     { fontSize: 12, color: COLORS.textMute },
  invTotal:    { fontSize: 16, fontWeight: FONTS.heavy, color: COLORS.text, marginBottom: 5 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText:  { fontSize: 11, fontWeight: FONTS.heavy, letterSpacing: 0.5 },

  balanceRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: '#FFF5F5', borderTopWidth: 1, borderTopColor: '#FEE2E2',
  },
  balanceLabel: { fontSize: 12, color: COLORS.danger, fontWeight: FONTS.semibold },
  balanceValue: { fontSize: 13, color: COLORS.danger, fontWeight: FONTS.heavy },

  empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 32 },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyText:    { fontSize: 15, color: COLORS.textMute, textAlign: 'center', marginBottom: 20 },
  emptyBtn:     { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.lg },
  emptyBtnText: { color: COLORS.white, fontWeight: FONTS.bold, fontSize: 15 },
});