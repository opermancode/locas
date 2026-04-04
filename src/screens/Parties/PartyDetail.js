import Icon from '../../utils/Icon';
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getParty, getInvoices, getQuotations, getPurchaseOrders,
  saveParty, deleteParty,
} from '../../db';
import { formatINR, formatINRCompact, today } from '../../utils/gst';
import { COLORS, RADIUS, FONTS } from '../../theme';

// ── Status helpers ────────────────────────────────────────────────
const INV_STATUS = {
  paid:    { bg: '#D1FAE5', text: '#065F46' },
  partial: { bg: '#FEF3C7', text: '#92400E' },
  unpaid:  { bg: '#FEE2E2', text: '#991B1B' },
  overdue: { bg: '#FECACA', text: '#7F1D1D' },
};
const QUO_STATUS = {
  draft:     { bg: '#F1F5F9', text: '#64748B' },
  sent:      { bg: '#DBEAFE', text: '#1E40AF' },
  converted: { bg: '#D1FAE5', text: '#065F46' },
};
const PO_STATUS = {
  active:    { bg: '#DBEAFE', text: '#1E40AF' },
  partial:   { bg: '#FEF3C7', text: '#92400E' },
  completed: { bg: '#D1FAE5', text: '#065F46' },
  cancelled: { bg: '#F3F4F6', text: '#6B7280' },
};

function resolveInvStatus(inv) {
  if (inv.status === 'paid') return 'paid';
  if (inv.due_date && inv.due_date < today() && inv.status !== 'paid') return 'overdue';
  return inv.status || 'unpaid';
}

// ── Tab definitions ───────────────────────────────────────────────
const TABS = [
  { key: 'overview',   label: 'Overview',  icon: 'user' },
  { key: 'invoices',   label: 'Invoices',  icon: 'file-text' },
  { key: 'quotations', label: 'Quotes',    icon: 'clipboard' },
  { key: 'pos',        label: 'PO Orders', icon: 'package' },
];

export default function PartyDetail({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { partyId } = route.params;

  const [party, setParty]         = useState(null);
  const [invoices, setInvoices]   = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [pos, setPOs]             = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const load = async () => {
    try {
      const [p, allInv, allQuo, allPO] = await Promise.all([
        getParty(partyId),
        getInvoices({}),
        getQuotations({ party_id: partyId }),
        getPurchaseOrders({ party_id: partyId }),
      ]);

      // Party from store — best source
      // Fallback: reconstruct from invoices if party was deleted from store
      const partyInvs = allInv.filter(i => i.party_id === partyId);
      const resolvedParty = p || (partyInvs.length > 0 ? {
        id:         partyId,
        name:       partyInvs[0].party_name,
        gstin:      partyInvs[0].party_gstin,
        state:      partyInvs[0].party_state,
        state_code: partyInvs[0].party_state_code,
        address:    partyInvs[0].party_address,
        type:       'customer',
        balance:    0,
        phone:      '',
        email:      '',
      } : { id: partyId, name: route.params?.partyName || 'Party', type: 'customer' });

      setParty(resolvedParty);
      setInvoices(partyInvs.sort((a, b) => b.date.localeCompare(a.date)));
      setQuotations(allQuo);
      setPOs(allPO);
    } catch (e) {
      console.error('PartyDetail load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [partyId]));

  const handleDelete = async () => {
    const doIt = async () => {
      await deleteParty(partyId);
      navigation.goBack();
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete ${party?.name}? This cannot be undone.`)) doIt();
    } else {
      Alert.alert('Delete Party', `Delete ${party?.name}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doIt },
      ]);
    }
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }
  if (!party) {
    return <View style={s.center}><Text style={{ color: COLORS.textMute }}>Party not found</Text></View>;
  }

  // ── Computed stats ─────────────────────────────────────────────
  const salesInvs     = invoices.filter(i => i.type === 'sale' || !i.type);
  const purchaseInvs  = invoices.filter(i => i.type === 'purchase');
  const totalSales    = salesInvs.reduce((s, i) => s + (i.total || 0), 0);
  const totalPaid     = salesInvs.reduce((s, i) => s + (i.paid || 0), 0);
  const outstanding   = salesInvs.reduce((s, i) => s + Math.max(0, (i.total || 0) - (i.paid || 0)), 0);
  const openPOs       = pos.filter(p => p.status === 'active' || p.status === 'partial').length;
  const activeQuotes  = quotations.filter(q => q.status !== 'converted').length;
  const isCustomer    = party.type !== 'supplier';

  const tabCounts = {
    invoices:   invoices.length,
    quotations: quotations.length,
    pos:        pos.length,
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={s.headerAvatar}>
          <Text style={s.headerAvatarTxt}>{party.name?.charAt(0)?.toUpperCase() || '?'}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.headerName} numberOfLines={1}>{party.name}</Text>
          <View style={s.headerBadgeRow}>
            <View style={[s.typeBadge, party.type === 'supplier' && s.typeBadgeSupplier]}>
              <Text style={[s.typeBadgeTxt, party.type === 'supplier' && s.typeBadgeTxtSupplier]}>
                {party.type === 'supplier' ? 'Supplier' : 'Customer'}
              </Text>
            </View>
            {outstanding > 0 && (
              <View style={s.outstBadge}>
                <Text style={s.outstBadgeTxt}>{formatINRCompact(outstanding)} due</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => navigation.navigate('PartiesList', { editPartyId: partyId })}
        >
          <Icon name="edit-2" size={16} color={COLORS.textSub} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.iconBtn, s.iconBtnDanger]} onPress={handleDelete}>
          <Icon name="trash-2" size={16} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      {/* ── KPI strip ── */}
      <View style={s.kpiStrip}>
        <KPI label="Total Sales"  value={formatINRCompact(totalSales)}   color={COLORS.primary} />
        <View style={s.kpiDiv} />
        <KPI label="Collected"   value={formatINRCompact(totalPaid)}    color={COLORS.success} />
        <View style={s.kpiDiv} />
        <KPI label="Outstanding" value={formatINRCompact(outstanding)}  color={outstanding > 0 ? COLORS.danger : COLORS.textMute} />
        <View style={s.kpiDiv} />
        <KPI label="Invoices"    value={String(invoices.length)}         color={COLORS.text} />
      </View>

      {/* ── Quick action buttons ── */}
      <View style={s.quickActions}>
        <TouchableOpacity
          style={s.qaBtn}
          onPress={() => navigation.navigate('InvoicesTab', {
            screen: 'CreateInvoice',
            params: { prefillParty: party },
          })}
        >
          <Icon name="file-plus" size={15} color={COLORS.primary} />
          <Text style={s.qaBtnTxt}>New Invoice</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.qaBtn}
          onPress={() => navigation.navigate('QuotationsTab', {
            screen: 'CreateQuotation',
            params: { prefillParty: party },
          })}
        >
          <Icon name="clipboard" size={15} color={COLORS.info} />
          <Text style={[s.qaBtnTxt, { color: COLORS.info }]}>New Quote</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.qaBtn}
          onPress={() => navigation.navigate('More', {
            screen: 'CreatePO',
            params: { prefillParty: party },
          })}
        >
          <Icon name="package" size={15} color={COLORS.warning} />
          <Text style={[s.qaBtnTxt, { color: COLORS.warning }]}>New PO</Text>
        </TouchableOpacity>
      </View>

      {/* ── Tab bar ── */}
      <View style={s.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tab, activeTab === tab.key && s.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Icon name={tab.icon} size={13} color={activeTab === tab.key ? COLORS.primary : COLORS.textMute} />
            <Text style={[s.tabTxt, activeTab === tab.key && s.tabTxtActive]}>
              {tab.label}
              {tabCounts[tab.key] !== undefined && tabCounts[tab.key] > 0
                ? ` (${tabCounts[tab.key]})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Tab content ── */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>

        {/* ─── OVERVIEW ─────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            {/* Contact info */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Contact Info</Text>
              <InfoRow icon="user"       label="Name"    value={party.name} />
              {party.phone   && <InfoRow icon="phone"      label="Phone"   value={party.phone} />}
              {party.email   && <InfoRow icon="mail"       label="Email"   value={party.email} />}
              {party.gstin   && <InfoRow icon="hash"       label="GSTIN"   value={party.gstin} />}
              {party.pan     && <InfoRow icon="credit-card" label="PAN"    value={party.pan} />}
              {party.address && <InfoRow icon="map-pin"    label="Address" value={party.address} />}
              {party.state   && <InfoRow icon="map"        label="State"   value={`${party.state} (${party.state_code || ''})`} />}
            </View>

            {/* Business summary */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Business Summary</Text>
              <SummaryRow label="Total invoices"   value={String(invoices.length)} />
              <SummaryRow label="Total sales"      value={formatINR(totalSales)} />
              <SummaryRow label="Total collected"  value={formatINR(totalPaid)}   valueColor={COLORS.success} />
              {outstanding > 0 && (
                <SummaryRow label="Outstanding"    value={formatINR(outstanding)} valueColor={COLORS.danger} />
              )}
              {purchaseInvs.length > 0 && (
                <SummaryRow label="Purchase invoices" value={String(purchaseInvs.length)} />
              )}
              {quotations.length > 0 && (
                <SummaryRow label="Quotations"     value={`${quotations.length} (${activeQuotes} active)`} />
              )}
              {pos.length > 0 && (
                <SummaryRow label="Purchase orders" value={`${pos.length} (${openPOs} open)`} />
              )}
            </View>

            {/* Recent invoices preview */}
            {invoices.length > 0 && (
              <View style={s.card}>
                <View style={s.cardTitleRow}>
                  <Text style={s.cardTitle}>Recent Invoices</Text>
                  <TouchableOpacity onPress={() => setActiveTab('invoices')}>
                    <Text style={s.seeAll}>See all →</Text>
                  </TouchableOpacity>
                </View>
                {invoices.slice(0, 3).map(inv => (
                  <InvoiceRow key={inv.id} inv={inv} onPress={() =>
                    navigation.navigate('InvoicesTab', { screen: 'InvoiceDetail', params: { invoiceId: inv.id } })
                  } />
                ))}
              </View>
            )}

            {/* Open POs preview */}
            {pos.filter(p => p.status === 'active' || p.status === 'partial').length > 0 && (
              <View style={s.card}>
                <View style={s.cardTitleRow}>
                  <Text style={s.cardTitle}>Open Purchase Orders</Text>
                  <TouchableOpacity onPress={() => setActiveTab('pos')}>
                    <Text style={s.seeAll}>See all →</Text>
                  </TouchableOpacity>
                </View>
                {pos.filter(p => p.status === 'active' || p.status === 'partial').slice(0, 3).map(po => (
                  <PORow key={po.id} po={po} onPress={() =>
                    navigation.navigate('More', { screen: 'PODetail', params: { poId: po.id } })
                  } />
                ))}
              </View>
            )}
          </>
        )}

        {/* ─── INVOICES ─────────────────────────────────────── */}
        {activeTab === 'invoices' && (
          <>
            {invoices.length === 0 ? (
              <EmptyState
                icon="file-text"
                title="No invoices yet"
                sub="Create an invoice for this party"
                btnLabel="Create Invoice"
                onBtn={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice', params: { prefillParty: party } })}
              />
            ) : (
              invoices.map(inv => (
                <InvoiceRow
                  key={inv.id}
                  inv={inv}
                  showType
                  onPress={() => navigation.navigate('InvoicesTab', { screen: 'InvoiceDetail', params: { invoiceId: inv.id } })}
                />
              ))
            )}
          </>
        )}

        {/* ─── QUOTATIONS ───────────────────────────────────── */}
        {activeTab === 'quotations' && (
          <>
            {quotations.length === 0 ? (
              <EmptyState
                icon="clipboard"
                title="No quotations yet"
                sub="Create a quotation for this party"
                btnLabel="Create Quotation"
                onBtn={() => navigation.navigate('QuotationsTab', { screen: 'CreateQuotation', params: { prefillParty: party } })}
              />
            ) : (
              quotations.map(q => {
                const qs = QUO_STATUS[q.status] || QUO_STATUS.draft;
                return (
                  <TouchableOpacity
                    key={q.id}
                    style={s.rowCard}
                    onPress={() => navigation.navigate('QuotationsTab', { screen: 'QuotationDetail', params: { id: q.id } })}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowNum}>{q.quote_number}</Text>
                      <Text style={s.rowDate}>{q.date}{q.valid_until ? `  ·  Valid till ${q.valid_until}` : ''}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={s.rowAmt}>{formatINR(q.total)}</Text>
                      <View style={[s.pill, { backgroundColor: qs.bg }]}>
                        <Text style={[s.pillTxt, { color: qs.text }]}>{q.status.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={14} color={COLORS.textMute} style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}

        {/* ─── PURCHASE ORDERS ──────────────────────────────── */}
        {activeTab === 'pos' && (
          <>
            {pos.length === 0 ? (
              <EmptyState
                icon="package"
                title="No purchase orders yet"
                sub="Create a PO when this customer sends an order list"
                btnLabel="Create PO"
                onBtn={() => navigation.navigate('More', { screen: 'CreatePO', params: { prefillParty: party } })}
              />
            ) : (
              pos.map(po => (
                <PORow
                  key={po.id}
                  po={po}
                  onPress={() => navigation.navigate('More', { screen: 'PODetail', params: { poId: po.id } })}
                />
              ))
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function KPI({ label, value, color }) {
  return (
    <View style={s.kpiChip}>
      <Text style={[s.kpiVal, { color }]}>{value}</Text>
      <Text style={s.kpiLbl}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={s.infoRow}>
      <Icon name={icon} size={13} color={COLORS.textMute} />
      <Text style={s.infoLbl}>{label}</Text>
      <Text style={s.infoVal} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function SummaryRow({ label, value, valueColor }) {
  return (
    <View style={s.sumRow}>
      <Text style={s.sumLbl}>{label}</Text>
      <Text style={[s.sumVal, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function InvoiceRow({ inv, onPress, showType }) {
  const status = resolveInvStatus(inv);
  const ss     = INV_STATUS[status] || INV_STATUS.unpaid;
  const balance = (inv.total || 0) - (inv.paid || 0);
  return (
    <TouchableOpacity style={s.rowCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[s.invTypeDot, { backgroundColor: inv.type === 'purchase' ? COLORS.info : COLORS.primary }]} />
      <View style={{ flex: 1 }}>
        <Text style={s.rowNum}>{inv.invoice_number}</Text>
        <Text style={s.rowDate}>{inv.date}{showType ? `  ·  ${inv.type === 'purchase' ? 'Purchase' : 'Sale'}` : ''}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={s.rowAmt}>{formatINR(inv.total)}</Text>
        <View style={[s.pill, { backgroundColor: ss.bg }]}>
          <Text style={[s.pillTxt, { color: ss.text }]}>{status.toUpperCase()}</Text>
        </View>
        {balance > 0.01 && status !== 'paid' && (
          <Text style={s.rowBalance}>Due: {formatINR(balance)}</Text>
        )}
      </View>
      <Icon name="chevron-right" size={14} color={COLORS.textMute} style={{ marginLeft: 6 }} />
    </TouchableOpacity>
  );
}

function PORow({ po, onPress }) {
  const ps = PO_STATUS[po.status] || PO_STATUS.active;
  return (
    <TouchableOpacity style={s.rowCard} onPress={onPress} activeOpacity={0.8}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowNum}>{po.po_number}</Text>
        <Text style={s.rowDate}>{po.date}{po.valid_until ? `  ·  Valid till ${po.valid_until}` : ''}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <View style={[s.pill, { backgroundColor: ps.bg }]}>
          <Text style={[s.pillTxt, { color: ps.text }]}>{po.status.toUpperCase()}</Text>
        </View>
      </View>
      <Icon name="chevron-right" size={14} color={COLORS.textMute} style={{ marginLeft: 6 }} />
    </TouchableOpacity>
  );
}

function EmptyState({ icon, title, sub, btnLabel, onBtn }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIconWrap}>
        <Icon name={icon} size={28} color={COLORS.primary} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptySub}>{sub}</Text>
      <TouchableOpacity style={s.emptyBtn} onPress={onBtn}>
        <Text style={s.emptyBtnTxt}>{btnLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn:      { padding: 4, marginRight: 6 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerAvatarTxt: { fontSize: 16, fontWeight: FONTS.black, color: '#fff' },
  headerName:   { fontSize: 16, fontWeight: FONTS.black, color: COLORS.text },
  headerBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  typeBadge:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight },
  typeBadgeSupplier: { backgroundColor: COLORS.infoLight },
  typeBadgeTxt: { fontSize: 10, fontWeight: FONTS.bold, color: COLORS.primary },
  typeBadgeTxtSupplier: { color: COLORS.info },
  outstBadge:   { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full, backgroundColor: COLORS.dangerLight },
  outstBadgeTxt:{ fontSize: 10, fontWeight: FONTS.bold, color: COLORS.danger },
  iconBtn:      { padding: 8, borderRadius: RADIUS.sm, backgroundColor: COLORS.bg, marginLeft: 6 },
  iconBtnDanger:{ backgroundColor: COLORS.dangerLight },

  // KPI strip
  kpiStrip: { flexDirection: 'row', backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  kpiChip:  { flex: 1, alignItems: 'center', paddingVertical: 12 },
  kpiDiv:   { width: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  kpiVal:   { fontSize: 15, fontWeight: FONTS.black, marginBottom: 2 },
  kpiLbl:   { fontSize: 9, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },

  // Quick actions
  quickActions: {
    flexDirection: 'row', backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 8, gap: 8,
  },
  qaBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: RADIUS.md, backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.border },
  qaBtnTxt: { fontSize: 12, fontWeight: FONTS.bold, color: COLORS.primary },

  // Tab bar
  tabBar: {
    flexDirection: 'row', backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tab:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 11 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabTxt:    { fontSize: 11, fontWeight: FONTS.medium, color: COLORS.textMute },
  tabTxtActive: { color: COLORS.primary, fontWeight: FONTS.bold },

  // Tab content
  tabContent: { padding: 12 },

  // Cards
  card: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginBottom: 10,
  },
  cardTitle:    { fontSize: 10, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  seeAll:       { fontSize: 12, color: COLORS.primary, fontWeight: FONTS.semibold },

  // Info rows
  infoRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoLbl:  { fontSize: 12, color: COLORS.textMute, width: 60, marginTop: 1 },
  infoVal:  { flex: 1, fontSize: 13, fontWeight: FONTS.medium, color: COLORS.text },

  // Summary rows
  sumRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sumLbl:   { fontSize: 13, color: COLORS.textSub },
  sumVal:   { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.text },

  // Row cards (invoices, quotations, POs)
  rowCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 12, marginBottom: 8, gap: 8,
  },
  invTypeDot: { width: 4, height: 36, borderRadius: 2, flexShrink: 0 },
  rowNum:     { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 2 },
  rowDate:    { fontSize: 11, color: COLORS.textMute },
  rowAmt:     { fontSize: 14, fontWeight: FONTS.black, color: COLORS.text },
  rowBalance: { fontSize: 11, color: COLORS.danger, fontWeight: FONTS.semibold },
  pill:       { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  pillTxt:    { fontSize: 9, fontWeight: FONTS.black, letterSpacing: 0.4 },

  // Empty state
  empty:        { alignItems: 'center', paddingTop: 50, paddingHorizontal: 24 },
  emptyIconWrap:{ width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle:   { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 6, textAlign: 'center' },
  emptySub:     { fontSize: 13, color: COLORS.textMute, textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  emptyBtn:     { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 11, borderRadius: RADIUS.lg },
  emptyBtnTxt:  { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
});
