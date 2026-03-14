import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, TextInput, ActivityIndicator, Share,
  FlatList, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getInvoiceDetail, recordPayment, deleteInvoice, getProfile } from '../../db/db';
import { formatINR, PAYMENT_METHODS, today, round } from '../../utils/gst';
import { TEMPLATES, buildHTML } from '../../utils/templates/index';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W * 0.62;
const CARD_GAP = 12;

const STATUS_STYLE = {
  paid:    { bg: '#D1FAE5', text: '#065F46' },
  partial: { bg: '#FEF3C7', text: '#92400E' },
  unpaid:  { bg: '#FEE2E2', text: '#991B1B' },
  overdue: { bg: '#FECACA', text: '#7F1D1D' },
};

export default function InvoiceDetail({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { invoiceId } = route.params;

  const [invoice, setInvoice]     = useState(null);
  const [profile, setProfile]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [printing, setPrinting]   = useState(false);

  // Template
  const [selectedTpl, setSelectedTpl] = useState('t1');
  const [tplModal, setTplModal]       = useState(false);
  const [actionAfterPick, setActionAfterPick] = useState(null); // 'pdf' | 'print'
  const flatRef = useRef(null);

  // Payment modal
  const [payModal, setPayModal]   = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payRef, setPayRef]       = useState('');
  const [payDate, setPayDate]     = useState(today());
  const [payNote, setPayNote]     = useState('');
  const [paying, setPaying]       = useState(false);

  // ── Load ──────────────────────────────────────────────────────
  const load = async () => {
    try {
      const [inv, prof] = await Promise.all([
        getInvoiceDetail(invoiceId),
        getProfile(),
      ]);
      setInvoice(inv);
      setProfile(prof);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  // ── Status ────────────────────────────────────────────────────
  const getStatus = () => {
    if (!invoice) return 'unpaid';
    if (invoice.status === 'paid') return 'paid';
    if (invoice.due_date && invoice.due_date < today() && invoice.status !== 'paid') return 'overdue';
    return invoice.status || 'unpaid';
  };

  const balance = invoice ? (invoice.total || 0) - (invoice.paid || 0) : 0;

  // ── Payment ───────────────────────────────────────────────────
  const openPayModal = () => {
    setPayAmount(balance.toFixed(2));
    setPayMethod('Cash');
    setPayRef('');
    setPayDate(today());
    setPayNote('');
    setPayModal(true);
  };

  const handlePayment = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0)     { Alert.alert('Error', 'Enter a valid amount'); return; }
    if (amt > balance + 0.01) { Alert.alert('Error', `Max payable: ${formatINR(balance)}`); return; }
    setPaying(true);
    try {
      await recordPayment(invoiceId, amt, payMethod, payRef, payDate, payNote);
      setPayModal(false);
      load();
      Alert.alert('✅ Payment Recorded', `${formatINR(amt)} via ${payMethod}`);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setPaying(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────
  const handleDelete = () => {
    Alert.alert('Delete Invoice', `Delete ${invoice.invoice_number}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteInvoice(invoiceId);
        navigation.goBack();
      }},
    ]);
  };

  // ── Template picker flow ──────────────────────────────────────
  const openTemplatePicker = (action) => {
    setActionAfterPick(action);
    setTplModal(true);
  };

  const confirmTemplate = async () => {
    setTplModal(false);
    if (actionAfterPick === 'pdf')   await doPDF();
    if (actionAfterPick === 'print') await doPrint();
  };

  // ── PDF / Print ───────────────────────────────────────────────
  const doPDF = async () => {
    setPrinting(true);
    try {
      const html = buildHTML(selectedTpl, invoice, profile);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Invoice ${invoice.invoice_number}`,
        UTI: 'com.adobe.pdf',
      });
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setPrinting(false);
    }
  };

  const doPrint = async () => {
    setPrinting(true);
    try {
      const html = buildHTML(selectedTpl, invoice, profile);
      await Print.printAsync({ html });
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setPrinting(false);
    }
  };

  // ── WhatsApp ──────────────────────────────────────────────────
  const handleWhatsApp = async () => {
    const inv     = invoice;
    const isInter = inv.supply_type === 'inter';
    const msg =
`🧾 *Invoice ${inv.invoice_number}*
From: ${profile?.name || 'My Business'}
Date: ${inv.date}${inv.due_date ? `\nDue:  ${inv.due_date}` : ''}

*Items:*
${(inv.items || []).map(i => `• ${i.name} × ${i.qty} = ${formatINR(i.total)}`).join('\n')}

Taxable: ${formatINR(inv.taxable)}
${isInter
  ? `IGST: ${formatINR(inv.igst)}`
  : `CGST: ${formatINR(inv.cgst)}\nSGST: ${formatINR(inv.sgst)}`}
*Total: ${formatINR(inv.total)}*${inv.paid > 0 ? `\nPaid:  ${formatINR(inv.paid)}\nBalance: ${formatINR(balance)}` : ''}

_Generated by Locas_`;
    try {
      await Share.share({ message: msg });
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  // ── Template card renderer ────────────────────────────────────
  const renderTemplateCard = ({ item }) => {
    const isSelected = selectedTpl === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.tplCard,
          { borderColor: isSelected ? item.accent : COLORS.border },
          isSelected && { borderWidth: 2.5 },
        ]}
        onPress={() => setSelectedTpl(item.id)}
        activeOpacity={0.85}
      >
        {/* Mini preview */}
        <View style={[styles.tplPreview, { backgroundColor: item.accent + '15' }]}>
          {/* Header bar */}
          <View style={[styles.tplHeaderBar, { backgroundColor: item.accent }]}>
            <View style={styles.tplHeaderLeft}>
              <View style={[styles.tplLine, { width: 50, backgroundColor: 'rgba(255,255,255,0.8)' }]} />
              <View style={[styles.tplLine, { width: 34, backgroundColor: 'rgba(255,255,255,0.5)', marginTop: 3 }]} />
            </View>
            <View style={styles.tplHeaderRight}>
              <View style={[styles.tplLine, { width: 36, backgroundColor: 'rgba(255,255,255,0.6)', alignSelf: 'flex-end' }]} />
              <View style={[styles.tplLine, { width: 28, backgroundColor: 'rgba(255,255,255,0.4)', marginTop: 3, alignSelf: 'flex-end' }]} />
            </View>
          </View>

          {/* Body lines */}
          <View style={styles.tplBody}>
            {/* Two party columns */}
            <View style={styles.tplPartyRow}>
              <View style={styles.tplPartyCol}>
                <View style={[styles.tplLine, { width: 30, backgroundColor: item.accent, height: 2 }]} />
                <View style={[styles.tplLine, { width: 44, marginTop: 3 }]} />
                <View style={[styles.tplLine, { width: 36, marginTop: 2 }]} />
              </View>
              <View style={styles.tplPartyCol}>
                <View style={[styles.tplLine, { width: 30, backgroundColor: item.accent, height: 2 }]} />
                <View style={[styles.tplLine, { width: 44, marginTop: 3 }]} />
                <View style={[styles.tplLine, { width: 36, marginTop: 2 }]} />
              </View>
            </View>

            {/* Table header */}
            <View style={[styles.tplTableHeader, { backgroundColor: item.accent }]}>
              {[40, 20, 24, 24].map((w, i) => (
                <View key={i} style={[styles.tplThLine, { width: w }]} />
              ))}
            </View>

            {/* Table rows */}
            {[0, 1, 2].map(i => (
              <View key={i} style={[styles.tplTableRow, { backgroundColor: i % 2 === 0 ? item.accent + '10' : '#fff' }]}>
                {[40, 20, 24, 24].map((w, j) => (
                  <View key={j} style={[styles.tplTdLine, { width: w, backgroundColor: j === 3 ? item.accent + '60' : '#CBD5E1' }]} />
                ))}
              </View>
            ))}

            {/* Total block */}
            <View style={styles.tplTotalRow}>
              <View style={{ flex: 1 }} />
              <View style={styles.tplTotalBox}>
                <View style={[styles.tplLine, { width: 50, backgroundColor: '#CBD5E1' }]} />
                <View style={[styles.tplLine, { width: 50, marginTop: 2, backgroundColor: '#CBD5E1' }]} />
                <View style={[styles.tplLine, { width: 50, height: 3, marginTop: 4, backgroundColor: item.accent }]} />
              </View>
            </View>
          </View>
        </View>

        {/* Card footer */}
        <View style={styles.tplFooter}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tplName}>{item.name}</Text>
            <Text style={styles.tplSubtitle}>{item.subtitle}</Text>
          </View>
          {isSelected && (
            <View style={[styles.tplCheck, { backgroundColor: item.accent }]}>
              <Text style={styles.tplCheckText}>✓</Text>
            </View>
          )}
        </View>

        {item.id === 't5' && (
          <View style={styles.thermalBadge}>
            <Text style={styles.thermalBadgeText}>🖨️ Thermal</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ── Loading ───────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Invoice not found</Text>
      </View>
    );
  }

  const statusKey   = getStatus();
  const statusStyle = STATUS_STYLE[statusKey] || STATUS_STYLE.unpaid;
  const activeTpl   = TEMPLATES.find(t => t.id === selectedTpl) || TEMPLATES[0];

  // ─────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle}>{invoice.invoice_number}</Text>
          <Text style={styles.headerSub}>{invoice.date}</Text>
        </View>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteIcon}>🗑️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Amount card */}
        <View style={styles.amountCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.amountLabel}>Invoice Total</Text>
            <Text style={styles.amountValue}>{formatINR(invoice.total)}</Text>
            {invoice.paid > 0 && (
              <Text style={styles.amountPaid}>Paid: {formatINR(invoice.paid)}</Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.text }]}>
                {statusKey.toUpperCase()}
              </Text>
            </View>
            {balance > 0.01 && (
              <Text style={styles.balanceText}>Balance: {formatINR(balance)}</Text>
            )}
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {balance > 0.01 && (
            <ActionBtn icon="💰" label="Payment"   color={COLORS.success}  onPress={openPayModal} />
          )}
          <ActionBtn icon="📄" label="PDF"        color={COLORS.primary}  onPress={() => openTemplatePicker('pdf')}   loading={printing} />
          <ActionBtn icon="💬" label="WhatsApp"   color="#25D366"         onPress={handleWhatsApp} />
          <ActionBtn icon="🖨️" label="Print"      color={COLORS.secondary} onPress={() => openTemplatePicker('print')} loading={printing} />
        </View>

        {/* Active template strip */}
        <TouchableOpacity
          style={styles.tplStrip}
          onPress={() => openTemplatePicker('pdf')}
          activeOpacity={0.8}
        >
          <View style={[styles.tplStripDot, { backgroundColor: activeTpl.accent }]} />
          <Text style={styles.tplStripLabel}>
            {activeTpl.name} — {activeTpl.subtitle}
          </Text>
          <Text style={styles.tplStripChange}>Change →</Text>
        </TouchableOpacity>

        {/* Supply type */}
        <View style={styles.supplyBadge}>
          <Text style={styles.supplyText}>
            {invoice.supply_type === 'inter'
              ? '🔀 Inter-state — IGST Applied'
              : '✅ Intra-state — CGST + SGST Applied'}
          </Text>
        </View>

        {/* Party */}
        {invoice.party_name ? (
          <>
            <SectionTitle title="Bill To" />
            <View style={styles.card}>
              <Text style={styles.partyName}>{invoice.party_name}</Text>
              {invoice.party_address ? <Text style={styles.partyDetail}>📍 {invoice.party_address}</Text> : null}
              {invoice.party_gstin   ? <Text style={styles.partyDetail}>GST: {invoice.party_gstin}</Text>  : null}
              {invoice.party_state   ? <Text style={styles.partyDetail}>State: {invoice.party_state} ({invoice.party_state_code})</Text> : null}
            </View>
          </>
        ) : null}

        {/* Items */}
        <SectionTitle title="Items" />
        <View style={styles.card}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 3 }]}>Item</Text>
            <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Qty</Text>
            <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>Total</Text>
          </View>
          {invoice.items.map((item, i) => (
            <View key={i} style={[styles.itemRow, i < invoice.items.length - 1 && styles.itemRowBorder]}>
              <View style={{ flex: 3 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemSub}>
                  ₹{item.rate}/{item.unit}
                  {item.discount > 0 ? `  ${item.discount}% disc` : ''}
                </Text>
                <Text style={styles.itemGst}>
                  {invoice.supply_type === 'intra'
                    ? `CGST ₹${round(item.cgst)}  +  SGST ₹${round(item.sgst)}`
                    : `IGST ₹${round(item.igst)}`}
                </Text>
              </View>
              <Text style={[styles.td, { flex: 1, textAlign: 'center' }]}>{item.qty}</Text>
              <Text style={[styles.td, { flex: 2, textAlign: 'right', fontWeight: FONTS.bold }]}>
                {formatINR(item.total)}
              </Text>
            </View>
          ))}
        </View>

        {/* Tax breakdown */}
        <SectionTitle title="Tax Breakdown" />
        <View style={styles.card}>
          <TaxRow label="Subtotal"      value={formatINR(invoice.subtotal)} />
          {invoice.discount > 0 && (
            <TaxRow label={`Discount (${invoice.discount}%)`} value={`-${formatINR(invoice.subtotal - invoice.taxable)}`} />
          )}
          <TaxRow label="Taxable Amount" value={formatINR(invoice.taxable)} />
          {invoice.supply_type === 'intra' ? (
            <>
              <TaxRow label="CGST" value={formatINR(invoice.cgst)} muted />
              <TaxRow label="SGST" value={formatINR(invoice.sgst)} muted />
            </>
          ) : (
            <TaxRow label="IGST" value={formatINR(invoice.igst)} muted />
          )}
          <View style={styles.taxDivider} />
          <TaxRow label="Total Tax"   value={formatINR(invoice.total_tax)} />
          <TaxRow label="Grand Total" value={formatINR(invoice.total)} grand />
          {invoice.paid > 0  && <TaxRow label="Paid"        value={formatINR(invoice.paid)}  />}
          {balance > 0.01    && <TaxRow label="Balance Due" value={formatINR(balance)} danger />}
        </View>

        {/* Payments */}
        {invoice.payments?.length > 0 && (
          <>
            <SectionTitle title="Payment History" />
            <View style={styles.card}>
              {invoice.payments.map((p, i) => (
                <View key={i} style={[styles.payRow, i < invoice.payments.length - 1 && styles.payRowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.payMethod}>{p.method}</Text>
                    <Text style={styles.paySub}>{p.date}{p.reference ? `  ·  ${p.reference}` : ''}</Text>
                  </View>
                  <Text style={styles.payAmt}>{formatINR(p.amount)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Notes / Terms */}
        {invoice.notes ? (
          <>
            <SectionTitle title="Notes" />
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{invoice.notes}</Text>
            </View>
          </>
        ) : null}

        {invoice.terms ? (
          <>
            <SectionTitle title="Terms & Conditions" />
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{invoice.terms}</Text>
            </View>
          </>
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ── Template Picker Modal ──────────────────────────── */}
      <Modal visible={tplModal} transparent animationType="slide">
        <View style={styles.tplOverlay}>
          <View style={styles.tplSheet}>

            {/* Sheet header */}
            <View style={styles.tplSheetHeader}>
              <View>
                <Text style={styles.tplSheetTitle}>Choose Template</Text>
                <Text style={styles.tplSheetSub}>Swipe to browse · tap to select</Text>
              </View>
              <TouchableOpacity onPress={() => setTplModal(false)} style={styles.tplCloseBtn}>
                <Text style={styles.tplClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Swipeable cards */}
            <FlatList
              ref={flatRef}
              data={TEMPLATES}
              keyExtractor={t => t.id}
              renderItem={renderTemplateCard}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_W + CARD_GAP}
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={styles.tplList}
              ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
            />

            {/* Dot indicators */}
            <View style={styles.dotsRow}>
              {TEMPLATES.map(t => (
                <View
                  key={t.id}
                  style={[
                    styles.dot,
                    selectedTpl === t.id && [styles.dotActive, { backgroundColor: activeTpl.accent }],
                  ]}
                />
              ))}
            </View>

            {/* Confirm button */}
            <View style={styles.tplActions}>
              <TouchableOpacity
                style={styles.tplCancelBtn}
                onPress={() => setTplModal(false)}
              >
                <Text style={styles.tplCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tplConfirmBtn, { backgroundColor: activeTpl.accent }]}
                onPress={confirmTemplate}
              >
                <Text style={styles.tplConfirmText}>
                  Use {activeTpl.name}  →
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* ── Payment Modal ──────────────────────────────────── */}
      <Modal visible={payModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Payment</Text>
              <TouchableOpacity onPress={() => setPayModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">

              <View style={styles.payInvInfo}>
                <Text style={styles.payInvNum}>{invoice.invoice_number}</Text>
                <Text style={styles.payInvParty}>{invoice.party_name || 'Walk-in'}</Text>
                <Text style={styles.payInvBalance}>Balance due: {formatINR(balance)}</Text>
              </View>

              <FieldLabel>Amount (₹)*</FieldLabel>
              <TextInput
                style={styles.input}
                value={payAmount}
                onChangeText={setPayAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={COLORS.textMute}
              />

              <FieldLabel>Date</FieldLabel>
              <TextInput
                style={styles.input}
                value={payDate}
                onChangeText={setPayDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMute}
              />

              <FieldLabel>Payment Method</FieldLabel>
              <View style={styles.methodRow}>
                {PAYMENT_METHODS.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.methodChip, payMethod === m && styles.methodChipActive]}
                    onPress={() => setPayMethod(m)}
                  >
                    <Text style={[styles.methodText, payMethod === m && styles.methodTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <FieldLabel>Reference (optional)</FieldLabel>
              <TextInput
                style={styles.input}
                value={payRef}
                onChangeText={setPayRef}
                placeholder="UTR / Cheque No."
                placeholderTextColor={COLORS.textMute}
              />

              <FieldLabel>Note (optional)</FieldLabel>
              <TextInput
                style={styles.input}
                value={payNote}
                onChangeText={setPayNote}
                placeholder="Any note..."
                placeholderTextColor={COLORS.textMute}
              />

              <TouchableOpacity
                style={[styles.confirmBtn, paying && { opacity: 0.5 }]}
                onPress={handlePayment}
                disabled={paying}
              >
                {paying
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.confirmBtnText}>✅ Confirm Payment</Text>
                }
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Tiny helpers ─────────────────────────────────────────────────

function SectionTitle({ title }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}
function FieldLabel({ children }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}
function TaxRow({ label, value, muted, grand, danger }) {
  return (
    <View style={styles.taxRow}>
      <Text style={[styles.taxLabel, muted && { color: COLORS.textSub }, grand && { fontWeight: FONTS.heavy }]}>
        {label}
      </Text>
      <Text style={[
        styles.taxValue,
        muted   && { color: COLORS.textSub },
        grand   && { fontWeight: FONTS.heavy, color: COLORS.primary, fontSize: 16 },
        danger  && { color: COLORS.danger, fontWeight: FONTS.bold },
      ]}>
        {value}
      </Text>
    </View>
  );
}
function ActionBtn({ icon, label, color, onPress, loading }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} disabled={loading} activeOpacity={0.8}>
      <View style={[styles.actionIconBox, { backgroundColor: color + '20' }]}>
        {loading
          ? <ActivityIndicator size="small" color={color} />
          : <Text style={styles.actionIcon}>{icon}</Text>
        }
      </View>
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.bg },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound:   { fontSize: 16, color: COLORS.textMute },
  scroll:     { padding: 16 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn:     { padding: 4 },
  backIcon:    { fontSize: 22, color: COLORS.primary },
  headerTitle: { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text },
  headerSub:   { fontSize: 12, color: COLORS.textSub, marginTop: 1 },
  deleteBtn:   { padding: 8 },
  deleteIcon:  { fontSize: 20 },

  amountCard: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    backgroundColor: COLORS.secondary, borderRadius: RADIUS.lg,
    padding: 16, marginBottom: 12, ...SHADOW.sm,
  },
  amountLabel:  { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  amountValue:  { fontSize: 28, fontWeight: FONTS.heavy, color: COLORS.white },
  amountPaid:   { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  statusBadge:  { paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.full },
  statusText:   { fontSize: 12, fontWeight: FONTS.heavy, letterSpacing: 0.5 },
  balanceText:  { fontSize: 13, color: COLORS.accent, marginTop: 6, fontWeight: FONTS.semibold },

  actionRow:    { flexDirection: 'row', gap: 10, marginBottom: 12 },
  actionBtn:    { flex: 1, alignItems: 'center' },
  actionIconBox:{ width: 48, height: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  actionIcon:   { fontSize: 22 },
  actionLabel:  { fontSize: 11, fontWeight: FONTS.semibold },

  // Template strip
  tplStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
    ...SHADOW.sm,
  },
  tplStripDot:    { width: 12, height: 12, borderRadius: 6 },
  tplStripLabel:  { flex: 1, fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.text },
  tplStripChange: { fontSize: 13, color: COLORS.primary, fontWeight: FONTS.bold },

  supplyBadge: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 10, marginBottom: 12, alignItems: 'center' },
  supplyText:  { fontSize: 12, color: COLORS.primary, fontWeight: FONTS.semibold },

  sectionTitle: { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.textSub, marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },

  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 14, marginBottom: 12, ...SHADOW.sm },

  partyName:   { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 4 },
  partyDetail: { fontSize: 13, color: COLORS.textSub, marginTop: 2 },

  tableHeader:   { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  th:            { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase' },
  itemRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemName:      { fontSize: 14, fontWeight: FONTS.semibold, color: COLORS.text },
  itemSub:       { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  itemGst:       { fontSize: 11, color: COLORS.primary, marginTop: 1 },
  td:            { fontSize: 14, color: COLORS.text },

  taxRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  taxLabel:   { fontSize: 14, color: COLORS.text, fontWeight: FONTS.medium },
  taxValue:   { fontSize: 14, color: COLORS.text, fontWeight: FONTS.semibold },
  taxDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 6 },

  payRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  payRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  payMethod:    { fontSize: 14, fontWeight: FONTS.semibold, color: COLORS.text },
  paySub:       { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  payAmt:       { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.success },

  notesBox:  { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 14, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: COLORS.primary, ...SHADOW.sm },
  notesText: { fontSize: 13, color: COLORS.textSub, lineHeight: 20 },

  // ── Template picker modal ──────────────────────────────────────
  tplOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  tplSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingTop: 6, paddingBottom: 32,
  },
  tplSheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tplSheetTitle: { fontSize: 18, fontWeight: FONTS.heavy, color: COLORS.text },
  tplSheetSub:   { fontSize: 12, color: COLORS.textMute, marginTop: 2 },
  tplCloseBtn:   { padding: 4 },
  tplClose:      { fontSize: 20, color: COLORS.textMute },

  tplList: { paddingHorizontal: 20, paddingVertical: 16 },

  tplCard: {
    width: CARD_W,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOW.sm,
  },

  // Mini invoice preview inside card
  tplPreview:   { padding: 10 },
  tplHeaderBar: { flexDirection: 'row', justifyContent: 'space-between', borderRadius: 4, padding: 8, marginBottom: 8 },
  tplHeaderLeft:  { gap: 2 },
  tplHeaderRight: { gap: 2, alignItems: 'flex-end' },
  tplBody:      { gap: 4 },
  tplPartyRow:  { flexDirection: 'row', gap: 8, marginBottom: 6 },
  tplPartyCol:  { flex: 1, gap: 2 },
  tplTableHeader: { flexDirection: 'row', justifyContent: 'space-between', borderRadius: 3, paddingHorizontal: 6, paddingVertical: 5 },
  tplThLine:    { height: 5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.7)' },
  tplTableRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 2 },
  tplTdLine:    { height: 4, borderRadius: 2 },
  tplTotalRow:  { flexDirection: 'row', marginTop: 6 },
  tplTotalBox:  { width: 70, gap: 2 },
  tplLine:      { height: 5, borderRadius: 2, backgroundColor: '#CBD5E1' },

  tplFooter: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: COLORS.card,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  tplName:     { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.text },
  tplSubtitle: { fontSize: 11, color: COLORS.textMute, marginTop: 1 },
  tplCheck:    { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tplCheckText:{ fontSize: 13, color: COLORS.white, fontWeight: FONTS.bold },

  thermalBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: '#1F2937', borderRadius: RADIUS.sm,
    paddingHorizontal: 6, paddingVertical: 3,
  },
  thermalBadgeText: { fontSize: 9, color: COLORS.white, fontWeight: FONTS.bold },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 16 },
  dot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border },
  dotActive: { width: 18, borderRadius: 3 },

  tplActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20 },
  tplCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: RADIUS.lg,
    alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.border,
  },
  tplCancelText:  { fontSize: 15, fontWeight: FONTS.semibold, color: COLORS.textSub },
  tplConfirmBtn:  { flex: 2, paddingVertical: 13, borderRadius: RADIUS.lg, alignItems: 'center' },
  tplConfirmText: { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.white },

  // ── Payment modal ──────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, maxHeight: '85%', paddingBottom: 20 },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle:   { fontSize: 17, fontWeight: FONTS.bold, color: COLORS.text },
  modalClose:   { fontSize: 20, color: COLORS.textMute, padding: 4 },

  payInvInfo:    { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 14, marginBottom: 4 },
  payInvNum:     { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.primary },
  payInvParty:   { fontSize: 14, color: COLORS.text, marginTop: 2 },
  payInvBalance: { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.danger, marginTop: 4 },

  fieldLabel: {
    fontSize: 12, fontWeight: FONTS.semibold, color: COLORS.textSub,
    marginBottom: 6, marginTop: 14,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  input: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 10,
    fontSize: 14, color: COLORS.text,
  },
  methodRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  methodChip:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  methodChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  methodText:       { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  methodTextActive: { color: COLORS.primary, fontWeight: FONTS.bold },

  confirmBtn:     { backgroundColor: COLORS.success, borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  confirmBtnText: { color: COLORS.white, fontWeight: FONTS.bold, fontSize: 15 },
});