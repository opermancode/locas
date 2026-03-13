import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, TextInput, ActivityIndicator, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getInvoiceDetail, recordPayment, deleteInvoice, getProfile } from '../../db/db';
import { formatINR, PAYMENT_METHODS, today, round } from '../../utils/gst';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';

const STATUS_STYLE = {
  paid:    { bg: '#D1FAE5', text: '#065F46' },
  partial: { bg: '#FEF3C7', text: '#92400E' },
  unpaid:  { bg: '#FEE2E2', text: '#991B1B' },
  overdue: { bg: '#FECACA', text: '#7F1D1D' },
};

export default function InvoiceDetail({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { invoiceId } = route.params;

  const [invoice, setInvoice]   = useState(null);
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [printing, setPrinting] = useState(false);

  // Payment modal
  const [payModal, setPayModal]   = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payRef, setPayRef]       = useState('');
  const [payDate, setPayDate]     = useState(today());
  const [payNote, setPayNote]     = useState('');
  const [paying, setPaying]       = useState(false);

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

  // ── Status helpers ────────────────────────────────────────────
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
    if (!amt || amt <= 0)        { Alert.alert('Error', 'Enter a valid amount'); return; }
    if (amt > balance + 0.01)    { Alert.alert('Error', `Max payable: ${formatINR(balance)}`); return; }
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
    Alert.alert('Delete Invoice', `Delete ${invoice.invoice_number}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteInvoice(invoiceId);
        navigation.goBack();
      }},
    ]);
  };

  // ── PDF HTML ──────────────────────────────────────────────────
  const buildHTML = () => {
    const inv  = invoice;
    const prof = profile || {};
    const isInter = inv.supply_type === 'inter';

    const itemRows = (inv.items || []).map(item => `
      <tr>
        <td>${item.name}${item.hsn ? `<br><small>HSN: ${item.hsn}</small>` : ''}</td>
        <td class="center">${item.qty} ${item.unit}</td>
        <td class="right">₹${item.rate.toFixed(2)}</td>
        <td class="right">${item.discount > 0 ? item.discount + '%' : '-'}</td>
        <td class="right">₹${item.taxable.toFixed(2)}</td>
        <td class="center">${item.gst_rate}%</td>
        ${isInter
          ? `<td class="right">₹${item.igst.toFixed(2)}</td>`
          : `<td class="right">₹${item.cgst.toFixed(2)}<br>₹${item.sgst.toFixed(2)}</td>`
        }
        <td class="right bold">₹${item.total.toFixed(2)}</td>
      </tr>
    `).join('');

    const paymentRows = (inv.payments || []).map(p => `
      <tr>
        <td>${p.date}</td>
        <td>${p.method}</td>
        <td>${p.reference || '-'}</td>
        <td class="right bold">₹${p.amount.toFixed(2)}</td>
      </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a2e; padding: 24px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; border-bottom:3px solid #FF6B00; padding-bottom:16px; }
  .brand { font-size:24px; font-weight:800; color:#FF6B00; }
  .brand-sub { font-size:11px; color:#666; margin-top:2px; }
  .inv-title { font-size:18px; font-weight:700; color:#FF6B00; text-align:right; }
  .inv-meta { text-align:right; font-size:11px; color:#555; margin-top:4px; line-height:1.6; }
  .parties { display:flex; justify-content:space-between; margin-bottom:16px; }
  .party-box { width:48%; }
  .party-label { font-size:10px; font-weight:700; color:#FF6B00; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
  .party-name { font-size:14px; font-weight:700; margin-bottom:3px; }
  .party-detail { font-size:11px; color:#555; line-height:1.6; }
  .gst-type { display:inline-block; background:#FFF0E6; color:#FF6B00; font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px; margin-top:4px; }
  table { width:100%; border-collapse:collapse; margin-bottom:12px; }
  thead tr { background:#FF6B00; color:white; }
  thead th { padding:8px; text-align:left; font-size:11px; font-weight:600; }
  tbody tr:nth-child(even) { background:#FFF8F5; }
  td { padding:7px 8px; border-bottom:1px solid #eee; font-size:11px; vertical-align:top; }
  .center { text-align:center; }
  .right  { text-align:right; }
  .bold   { font-weight:700; }
  .totals { display:flex; justify-content:flex-end; margin-bottom:16px; }
  .totals-box { width:260px; }
  .total-row { display:flex; justify-content:space-between; padding:4px 0; font-size:12px; border-bottom:1px solid #eee; }
  .total-grand { font-size:15px; font-weight:800; color:#FF6B00; border-top:2px solid #FF6B00; border-bottom:none; margin-top:4px; padding-top:6px; }
  .status-badge { display:inline-block; padding:3px 12px; border-radius:4px; font-size:11px; font-weight:700; }
  .paid    { background:#D1FAE5; color:#065F46; }
  .unpaid  { background:#FEE2E2; color:#991B1B; }
  .partial { background:#FEF3C7; color:#92400E; }
  .section-title { font-size:12px; font-weight:700; color:#FF6B00; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px; }
  .notes-box { background:#F9F9F9; border-left:3px solid #FF6B00; padding:10px 12px; margin-bottom:12px; font-size:11px; color:#444; }
  .bank-box { background:#F0F9FF; border:1px solid #BAE6FD; border-radius:6px; padding:10px; margin-bottom:12px; font-size:11px; color:#0369A1; }
  .footer { text-align:center; font-size:10px; color:#999; margin-top:20px; border-top:1px solid #eee; padding-top:10px; }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div>
    <div class="brand">${prof.name || 'My Business'}</div>
    <div class="brand-sub">${prof.address || ''}</div>
    <div class="brand-sub">${[prof.phone, prof.email].filter(Boolean).join('  |  ')}</div>
    ${prof.gstin ? `<div class="brand-sub">GSTIN: <strong>${prof.gstin}</strong></div>` : ''}
  </div>
  <div>
    <div class="inv-title">TAX INVOICE</div>
    <div class="inv-meta">
      <strong>${inv.invoice_number}</strong><br>
      Date: ${inv.date}<br>
      ${inv.due_date ? `Due: ${inv.due_date}<br>` : ''}
      <span class="status-badge ${inv.status}">${(inv.status || 'unpaid').toUpperCase()}</span>
    </div>
  </div>
</div>

<!-- Parties -->
<div class="parties">
  <div class="party-box">
    <div class="party-label">From</div>
    <div class="party-name">${prof.name || 'My Business'}</div>
    <div class="party-detail">
      ${prof.address || ''}<br>
      ${prof.gstin ? `GSTIN: ${prof.gstin}<br>` : ''}
      ${prof.state  ? `State: ${prof.state} (${prof.state_code || ''})` : ''}
    </div>
  </div>
  <div class="party-box">
    <div class="party-label">Bill To</div>
    <div class="party-name">${inv.party_name || 'Walk-in Customer'}</div>
    <div class="party-detail">
      ${inv.party_address || ''}<br>
      ${inv.party_gstin   ? `GSTIN: ${inv.party_gstin}<br>` : ''}
      ${inv.party_state   ? `State: ${inv.party_state} (${inv.party_state_code || ''})` : ''}
    </div>
    <div class="gst-type">${isInter ? '🔀 IGST — Inter-state' : '✅ CGST+SGST — Intra-state'}</div>
  </div>
</div>

<!-- Items Table -->
<table>
  <thead>
    <tr>
      <th style="width:28%">Item / HSN</th>
      <th class="center" style="width:10%">Qty</th>
      <th class="right"  style="width:10%">Rate</th>
      <th class="right"  style="width:8%">Disc</th>
      <th class="right"  style="width:12%">Taxable</th>
      <th class="center" style="width:8%">GST%</th>
      <th class="right"  style="width:12%">${isInter ? 'IGST' : 'CGST/SGST'}</th>
      <th class="right"  style="width:12%">Total</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>

<!-- Totals -->
<div class="totals">
  <div class="totals-box">
    <div class="total-row"><span>Subtotal</span><span>₹${inv.subtotal.toFixed(2)}</span></div>
    ${inv.discount > 0 ? `<div class="total-row"><span>Discount (${inv.discount}%)</span><span>-₹${(inv.subtotal - inv.taxable).toFixed(2)}</span></div>` : ''}
    <div class="total-row"><span>Taxable Amount</span><span>₹${inv.taxable.toFixed(2)}</span></div>
    ${isInter
      ? `<div class="total-row"><span>IGST</span><span>₹${inv.igst.toFixed(2)}</span></div>`
      : `<div class="total-row"><span>CGST</span><span>₹${inv.cgst.toFixed(2)}</span></div>
         <div class="total-row"><span>SGST</span><span>₹${inv.sgst.toFixed(2)}</span></div>`
    }
    <div class="total-row"><span>Total Tax</span><span>₹${inv.total_tax.toFixed(2)}</span></div>
    <div class="total-row total-grand"><span>GRAND TOTAL</span><span>₹${inv.total.toFixed(2)}</span></div>
    ${inv.paid > 0 ? `<div class="total-row"><span>Paid</span><span>₹${inv.paid.toFixed(2)}</span></div>` : ''}
    ${balance > 0  ? `<div class="total-row bold"><span>Balance Due</span><span>₹${balance.toFixed(2)}</span></div>` : ''}
  </div>
</div>

${inv.payments && inv.payments.length > 0 ? `
<div class="section-title">Payment History</div>
<table>
  <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th class="right">Amount</th></tr></thead>
  <tbody>${paymentRows}</tbody>
</table>` : ''}

${prof.bank_name || prof.account_no ? `
<div class="bank-box">
  <strong>Bank Details</strong><br>
  ${prof.bank_name   ? `Bank: ${prof.bank_name}<br>` : ''}
  ${prof.account_no  ? `A/C: ${prof.account_no}<br>` : ''}
  ${prof.ifsc        ? `IFSC: ${prof.ifsc}` : ''}
</div>` : ''}

${inv.notes ? `
<div class="section-title">Notes</div>
<div class="notes-box">${inv.notes}</div>` : ''}

${inv.terms ? `
<div class="section-title">Terms &amp; Conditions</div>
<div class="notes-box">${inv.terms}</div>` : ''}

<div class="footer">
  This is a computer-generated invoice. | Generated by Locas
</div>
</body>
</html>`;
  };

  // ── Share PDF ─────────────────────────────────────────────────
  const handleSharePDF = async () => {
    setPrinting(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: buildHTML(), base64: false });
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

  // ── Print ─────────────────────────────────────────────────────
  const handlePrint = async () => {
    setPrinting(true);
    try {
      await Print.printAsync({ html: buildHTML() });
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setPrinting(false);
    }
  };

  // ── WhatsApp ──────────────────────────────────────────────────
  const handleWhatsApp = async () => {
    const inv  = invoice;
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

  const statusKey = getStatus();
  const statusStyle = STATUS_STYLE[statusKey] || STATUS_STYLE.unpaid;

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

        {/* Status + Amount */}
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

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          {balance > 0.01 && (
            <ActionBtn icon="💰" label="Payment" color={COLORS.success} onPress={openPayModal} />
          )}
          <ActionBtn icon="📄" label="PDF" color={COLORS.primary} onPress={handleSharePDF} loading={printing} />
          <ActionBtn icon="💬" label="WhatsApp" color="#25D366" onPress={handleWhatsApp} />
          <ActionBtn icon="🖨️" label="Print" color={COLORS.secondary} onPress={handlePrint} loading={printing} />
        </View>

        {/* Supply Type */}
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
              {invoice.party_gstin   ? <Text style={styles.partyDetail}>GST: {invoice.party_gstin}</Text> : null}
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

        {/* Tax Breakdown */}
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
          <TaxRow label="Total Tax"  value={formatINR(invoice.total_tax)} />
          <TaxRow label="Grand Total" value={formatINR(invoice.total)} grand />
          {invoice.paid > 0 && <TaxRow label="Paid" value={formatINR(invoice.paid)} />}
          {balance > 0.01 && <TaxRow label="Balance Due" value={formatINR(balance)} danger />}
        </View>

        {/* Payment History */}
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

        {/* Notes */}
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

      {/* ── Payment Modal ─────────────────────────────────── */}
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

              {/* Invoice summary */}
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
                    <Text style={[styles.methodText, payMethod === m && styles.methodTextActive]}>
                      {m}
                    </Text>
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
  backBtn:    { padding: 4 },
  backIcon:   { fontSize: 22, color: COLORS.primary },
  headerTitle:{ fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text },
  headerSub:  { fontSize: 12, color: COLORS.textSub, marginTop: 1 },
  deleteBtn:  { padding: 8 },
  deleteIcon: { fontSize: 20 },

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

  supplyBadge:  { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 10, marginBottom: 12, alignItems: 'center' },
  supplyText:   { fontSize: 12, color: COLORS.primary, fontWeight: FONTS.semibold },

  sectionTitle: { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.textSub, marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },

  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 14, marginBottom: 12, ...SHADOW.sm },
  partyName:   { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 4 },
  partyDetail: { fontSize: 13, color: COLORS.textSub, marginTop: 2 },

  tableHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  th:          { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase' },
  itemRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  itemRowBorder:{ borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemName:    { fontSize: 14, fontWeight: FONTS.semibold, color: COLORS.text },
  itemSub:     { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  itemGst:     { fontSize: 11, color: COLORS.primary, marginTop: 1 },
  td:          { fontSize: 14, color: COLORS.text },

  taxRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  taxLabel:    { fontSize: 14, color: COLORS.text, fontWeight: FONTS.medium },
  taxValue:    { fontSize: 14, color: COLORS.text, fontWeight: FONTS.semibold },
  taxDivider:  { height: 1, backgroundColor: COLORS.border, marginVertical: 6 },

  payRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  payRowBorder:{ borderBottomWidth: 1, borderBottomColor: COLORS.border },
  payMethod:   { fontSize: 14, fontWeight: FONTS.semibold, color: COLORS.text },
  paySub:      { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  payAmt:      { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.success },

  notesBox:    { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 14, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: COLORS.primary, ...SHADOW.sm },
  notesText:   { fontSize: 13, color: COLORS.textSub, lineHeight: 20 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, maxHeight: '85%', paddingBottom: 20 },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle:   { fontSize: 17, fontWeight: FONTS.bold, color: COLORS.text },
  modalClose:   { fontSize: 20, color: COLORS.textMute, padding: 4 },

  payInvInfo:   { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 14, marginBottom: 4 },
  payInvNum:    { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.primary },
  payInvParty:  { fontSize: 14, color: COLORS.text, marginTop: 2 },
  payInvBalance:{ fontSize: 13, fontWeight: FONTS.bold, color: COLORS.danger, marginTop: 4 },

  fieldLabel:   { fontSize: 12, fontWeight: FONTS.semibold, color: COLORS.textSub, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.4 },
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