import Icon from '../../utils/Icon';
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, TextInput, ActivityIndicator, Share,
  Dimensions, Platform,
} from 'react-native';

// WebView polyfill for web
const WebView = Platform.OS === 'web'
  ? ({ source, style }) => {
      const iframeRef = React.useRef(null);
      const [h, setH] = React.useState(style?.height || 800);
      React.useEffect(() => {
        const el = iframeRef.current;
        if (!el) return;
        const onLoad = () => {
          try {
            const sh = el.contentDocument?.body?.scrollHeight;
            if (sh && sh > 100) setH(sh + 32);
          } catch (_) {}
        };
        el.addEventListener('load', onLoad);
        return () => el.removeEventListener('load', onLoad);
      }, [source?.html]);
      return React.createElement('iframe', {
        ref: iframeRef,
        src: source?.html ? `data:text/html,${encodeURIComponent(source.html)}` : source?.uri,
        style: { border: 'none', width: '100%', height: h, display: 'block' },
      });
    }
  : require('react-native-webview').WebView;

const Print = Platform.OS === 'web'
  ? {
      printAsync: async ({ html }) => {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;';
        document.body.appendChild(iframe);
        iframe.contentDocument.open();
        iframe.contentDocument.write(html);
        iframe.contentDocument.close();
        await new Promise(r => setTimeout(r, 600));
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 2000);
      },
    }
  : require('expo-print');

const Sharing = Platform.OS === 'web'
  ? {
      shareAsync: async (url) => {
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl; a.download = 'invoice.pdf';
          document.body.appendChild(a); a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(blobUrl);
        } catch (e) { alert('Failed to save. Use Print and Save as PDF.'); }
      },
    }
  : require('expo-sharing');

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getInvoiceDetail, recordPayment, deleteInvoice, getProfile } from '../../db';
import { formatINR, PAYMENT_METHODS, today } from '../../utils/gst';
import { TEMPLATES, buildHTML } from '../../utils/templates/index';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';

function useIsWide() {
  const [wide, setWide] = useState(
    Platform.OS === 'web' && Dimensions.get('window').width >= 900
  );
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const sub = Dimensions.addEventListener('change', ({ window }) => setWide(window.width >= 900));
    return () => sub?.remove();
  }, []);
  return wide;
}

const COLOR_PALETTE = [
  { hex: '#1E40AF', name: 'Navy'   },
  { hex: '#2563EB', name: 'Blue'   },
  { hex: '#0369A1', name: 'Sky'    },
  { hex: '#0F766E', name: 'Teal'   },
  { hex: '#15803D', name: 'Green'  },
  { hex: '#7C2D92', name: 'Purple' },
  { hex: '#B45309', name: 'Amber'  },
  { hex: '#C2410C', name: 'Orange' },
  { hex: '#B91C1C', name: 'Red'    },
  { hex: '#BE185D', name: 'Pink'   },
  { hex: '#374151', name: 'Slate'  },
  { hex: '#111827', name: 'Dark'   },
];

const STATUS_STYLE = {
  paid:    { bg: '#D1FAE5', text: '#065F46' },
  partial: { bg: '#FEF3C7', text: '#92400E' },
  unpaid:  { bg: '#FEE2E2', text: '#991B1B' },
  overdue: { bg: '#FECACA', text: '#7F1D1D' },
};

export default function InvoiceDetail({ navigation, route }) {
  const insets  = useSafeAreaInsets();
  const isWide  = useIsWide();
  const { invoiceId } = route.params;

  const [invoice, setInvoice]       = useState(null);
  const [profile, setProfile]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [printing, setPrinting]     = useState(false);
  const [selectedTpl, setSelectedTpl] = useState('t1');
  const [accentColor, setAccentColor] = useState('#1E40AF');

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
      const [inv, prof] = await Promise.all([getInvoiceDetail(invoiceId), getProfile()]);
      setInvoice(inv);
      setProfile(prof);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const getStatus = () => {
    if (!invoice) return 'unpaid';
    if (invoice.status === 'paid') return 'paid';
    if (invoice.due_date && invoice.due_date < today() && invoice.status !== 'paid') return 'overdue';
    return invoice.status || 'unpaid';
  };

  const balance = invoice ? (invoice.total || 0) - (invoice.paid || 0) : 0;

  const invoiceHTML = invoice && profile ? buildHTML(selectedTpl, invoice, profile, accentColor) : null;

  const openPayModal = () => {
    setPayAmount(balance.toFixed(2)); setPayMethod('Cash');
    setPayRef(''); setPayDate(today()); setPayNote(''); setPayModal(true);
  };

  const handlePayment = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0)     { Alert.alert('Error', 'Enter a valid amount'); return; }
    if (amt > balance + 0.01) { Alert.alert('Error', `Max: ${formatINR(balance)}`); return; }
    setPaying(true);
    try {
      await recordPayment(invoiceId, amt, payMethod, payRef, payDate, payNote);
      setPayModal(false); load();
      Alert.alert('Payment Recorded', `${formatINR(amt)} via ${payMethod}`);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setPaying(false); }
  };

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      if (!window.confirm(`Delete ${invoice.invoice_number}? This cannot be undone.`)) return;
      deleteInvoice(invoiceId).then(() => navigation.goBack());
      return;
    }
    Alert.alert('Delete Invoice', `Delete ${invoice.invoice_number}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteInvoice(invoiceId); navigation.goBack();
      }},
    ]);
  };

  const doPDF = async () => {
    setPrinting(true);
    try {
      const html = buildHTML(selectedTpl, invoice, profile, accentColor);
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const { uri } = await require('expo-print').printToFileAsync({ html, base64: false });
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Invoice_${invoice.invoice_number}`, UTI: 'com.adobe.pdf' });
      }
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setPrinting(false); }
  };

  const handleWhatsApp = async () => {
    const isInter = invoice.supply_type === 'inter';
    const msg = `*Invoice ${invoice.invoice_number}*\nFrom: ${profile?.name || 'My Business'}\nDate: ${invoice.date}${invoice.due_date ? `\nDue: ${invoice.due_date}` : ''}\n\n*Items:*\n${(invoice.items || []).map(i => `${i.name} x${i.qty} = ${formatINR(i.total)}`).join('\n')}\n\nTaxable: ${formatINR(invoice.taxable)}\n${isInter ? `IGST: ${formatINR(invoice.igst)}` : `CGST: ${formatINR(invoice.cgst)}\nSGST: ${formatINR(invoice.sgst)}`}\n*Total: ${formatINR(invoice.total)}*${invoice.paid > 0 ? `\nPaid: ${formatINR(invoice.paid)}\nBalance: ${formatINR(balance)}` : ''}`;
    try { await Share.share({ message: msg }); }
    catch (e) { Alert.alert('Error', e.message); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  if (!invoice) return <View style={styles.center}><Text style={{ color: COLORS.textMute }}>Invoice not found</Text></View>;

  const statusKey   = getStatus();
  const statusStyle = STATUS_STYLE[statusKey] || STATUS_STYLE.unpaid;
  const activeTpl   = TEMPLATES.find(t => t.id === selectedTpl) || TEMPLATES[0];
  const isInter     = invoice.supply_type === 'inter';

  // ── LEFT PANEL: invoice data ──────────────────────────────────
  const LeftPanel = (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

      {/* ── Money strip ── */}
      <View style={styles.moneyStrip}>
        <View style={styles.moneyCell}>
          <Text style={styles.moneyLabel}>Total</Text>
          <Text style={styles.moneyVal}>{formatINR(invoice.total)}</Text>
        </View>
        <View style={styles.moneySep} />
        <View style={styles.moneyCell}>
          <Text style={styles.moneyLabel}>Paid</Text>
          <Text style={[styles.moneyVal, { color: COLORS.success }]}>{formatINR(invoice.paid || 0)}</Text>
        </View>
        <View style={styles.moneySep} />
        <View style={styles.moneyCell}>
          <Text style={styles.moneyLabel}>Balance</Text>
          <Text style={[styles.moneyVal, balance > 0 ? { color: COLORS.danger } : { color: COLORS.success }]}>
            {formatINR(balance)}
          </Text>
        </View>
      </View>

      {/* ── Record payment CTA ── */}
      {balance > 0.01 && (
        <TouchableOpacity style={styles.payBanner} onPress={openPayModal} activeOpacity={0.85}>
          <View>
            <Text style={styles.payBannerLabel}>Balance Due</Text>
            <Text style={styles.payBannerAmt}>{formatINR(balance)}</Text>
          </View>
          <View style={styles.payBannerBtn}>
            <Text style={styles.payBannerBtnText}>Record Payment</Text>
            <Icon name="arrow-right" size={14} color="#fff" />
          </View>
        </TouchableOpacity>
      )}

      {/* ── Bill to / dates ── */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>Bill To</Text>
        <Text style={styles.partyName}>{invoice.party_name || 'Walk-in Customer'}</Text>
        {invoice.party_gstin ? <Text style={styles.partySub}>GSTIN: {invoice.party_gstin}</Text> : null}
        {invoice.party_address ? <Text style={styles.partySub}>{invoice.party_address}</Text> : null}
        <View style={styles.dateRow}>
          <View style={styles.dateCell}>
            <Text style={styles.dateLbl}>Invoice Date</Text>
            <Text style={styles.dateVal}>{invoice.date}</Text>
          </View>
          {invoice.due_date ? (
            <View style={styles.dateCell}>
              <Text style={styles.dateLbl}>Due Date</Text>
              <Text style={[styles.dateVal, statusKey === 'overdue' && { color: COLORS.danger }]}>
                {invoice.due_date}
              </Text>
            </View>
          ) : null}
          <View style={styles.dateCell}>
            <Text style={styles.dateLbl}>Supply</Text>
            <Text style={styles.dateVal}>{isInter ? 'Inter-state' : 'Intra-state'}</Text>
          </View>
        </View>
      </View>

      {/* ── Line items ── */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>Items ({invoice.items?.length || 0})</Text>
        {(invoice.items || []).map((item, i) => (
          <View key={i} style={[styles.itemRow, i < (invoice.items.length - 1) && styles.itemRowBorder]}>
            <View style={[styles.itemDot, { backgroundColor: accentColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>
                {item.qty} {item.unit} × {formatINR(item.rate)}
                {item.hsn ? ` · HSN ${item.hsn}` : ''}
                {` · GST ${item.gst_rate}%`}
              </Text>
              {item.discount > 0 && <Text style={styles.itemDiscount}>Discount: {formatINR(item.discount)}</Text>}
            </View>
            <Text style={styles.itemTotal}>{formatINR(item.total)}</Text>
          </View>
        ))}
      </View>

      {/* ── Tax summary ── */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>Tax Summary</Text>
        <View style={styles.taxRow}>
          <Text style={styles.taxLbl}>Subtotal</Text>
          <Text style={styles.taxVal}>{formatINR(invoice.subtotal || invoice.taxable)}</Text>
        </View>
        {invoice.discount > 0 && (
          <View style={styles.taxRow}>
            <Text style={styles.taxLbl}>Discount</Text>
            <Text style={[styles.taxVal, { color: COLORS.success }]}>−{formatINR(invoice.discount)}</Text>
          </View>
        )}
        <View style={styles.taxRow}>
          <Text style={styles.taxLbl}>Taxable Amount</Text>
          <Text style={styles.taxVal}>{formatINR(invoice.taxable)}</Text>
        </View>
        {isInter ? (
          <View style={styles.taxRow}>
            <Text style={styles.taxLbl}>IGST</Text>
            <Text style={styles.taxVal}>{formatINR(invoice.igst)}</Text>
          </View>
        ) : (
          <>
            <View style={styles.taxRow}>
              <Text style={styles.taxLbl}>CGST</Text>
              <Text style={styles.taxVal}>{formatINR(invoice.cgst)}</Text>
            </View>
            <View style={styles.taxRow}>
              <Text style={styles.taxLbl}>SGST</Text>
              <Text style={styles.taxVal}>{formatINR(invoice.sgst)}</Text>
            </View>
          </>
        )}
        <View style={styles.taxTotalRow}>
          <Text style={styles.taxTotalLbl}>Invoice Total</Text>
          <Text style={styles.taxTotalVal}>{formatINR(invoice.total)}</Text>
        </View>
      </View>

      {/* ── Payment history ── */}
      {(invoice.payments || []).length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Payment History ({invoice.payments.length})</Text>
          {invoice.payments.map((p, i) => (
            <View key={i} style={[styles.payRow, i < invoice.payments.length - 1 && styles.payRowBorder]}>
              <View style={styles.payIcon}>
                <Icon name="check-circle" size={15} color={COLORS.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.payMethod}>{p.method}{p.reference ? ` · ${p.reference}` : ''}</Text>
                <Text style={styles.payDate}>{p.date}{p.note ? ` · ${p.note}` : ''}</Text>
              </View>
              <Text style={styles.payAmt}>{formatINR(p.amount)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Notes / Terms ── */}
      {(invoice.notes || invoice.terms) ? (
        <View style={styles.card}>
          {invoice.notes ? (
            <>
              <Text style={styles.cardSectionTitle}>Notes</Text>
              <Text style={styles.notesText}>{invoice.notes}</Text>
            </>
          ) : null}
          {invoice.terms ? (
            <>
              <Text style={[styles.cardSectionTitle, { marginTop: invoice.notes ? 12 : 0 }]}>Terms</Text>
              <Text style={styles.notesText}>{invoice.terms}</Text>
            </>
          ) : null}
        </View>
      ) : null}

      {/* ── Action buttons (mobile only — on wide they're in the right panel) ── */}
      {!isWide && (
        <View style={styles.mobileActions}>
          <TouchableOpacity style={[styles.mobileActBtn, { backgroundColor: accentColor }]} onPress={doPDF} disabled={printing}>
            {printing
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Icon name="download" size={15} color="#fff" /><Text style={styles.mobileActTxt}>Export PDF</Text></>
            }
          </TouchableOpacity>
          <TouchableOpacity style={styles.mobileActBtnSecondary} onPress={handleWhatsApp}>
            <Icon name="message-circle" size={15} color={COLORS.textSub} />
            <Text style={styles.mobileActTxtSecondary}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mobileActBtnSecondary} onPress={doPDF}>
            <Icon name="printer" size={15} color={COLORS.textSub} />
            <Text style={styles.mobileActTxtSecondary}>Print</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  // ── RIGHT PANEL: template + preview (wide only) ───────────────
  const RightPanel = (
    <View style={styles.rightPanel}>
      {/* Action buttons */}
      <View style={styles.rightActions}>
        <TouchableOpacity
          style={[styles.rightActBtn, { backgroundColor: accentColor, flex: 2 }]}
          onPress={doPDF}
          disabled={printing}
        >
          {printing
            ? <ActivityIndicator size="small" color="#fff" />
            : <><Icon name="download" size={14} color="#fff" /><Text style={styles.rightActTxt}>Export PDF</Text></>
          }
        </TouchableOpacity>
        <TouchableOpacity style={[styles.rightActBtn, styles.rightActBtnSec]} onPress={handleWhatsApp}>
          <Icon name="message-circle" size={14} color={COLORS.textSub} />
          <Text style={styles.rightActTxtSec}>WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.rightActBtn, styles.rightActBtnSec]} onPress={doPDF}>
          <Icon name="printer" size={14} color={COLORS.textSub} />
          <Text style={styles.rightActTxtSec}>Print</Text>
        </TouchableOpacity>
      </View>

      {/* Template picker — compact */}
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        <Text style={styles.rightSectionTitle}>Template</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tplScroll}
        >
          {TEMPLATES.map(tpl => {
            const isSelected = selectedTpl === tpl.id;
            const c = isSelected ? accentColor : tpl.accent;
            return (
              <TouchableOpacity
                key={tpl.id}
                style={[styles.tplThumb, isSelected && { borderColor: accentColor, borderWidth: 2 }]}
                onPress={() => { setSelectedTpl(tpl.id); setAccentColor(tpl.accent); }}
                activeOpacity={0.85}
              >
                {/* Mini preview */}
                <View style={[styles.thumbPreview, { borderColor: c + '40' }]}>
                  <View style={[styles.thumbHeader, { backgroundColor: c }]}>
                    <View style={[styles.tl, { width: 24, backgroundColor: 'rgba(255,255,255,.9)', height: 3 }]} />
                    <View style={[styles.tl, { width: 18, backgroundColor: 'rgba(255,255,255,.7)', height: 3 }]} />
                  </View>
                  {[0,1,2].map(i => (
                    <View key={i} style={[styles.thumbTR, { backgroundColor: i%2===0 ? c+'0C':'#fff' }]}>
                      {[14,8,12].map((w,j) => <View key={j} style={[styles.tl, { width: w, height: 2, backgroundColor: j===2?c+'70':'#CBD5E1' }]} />)}
                    </View>
                  ))}
                  <View style={[styles.thumbGrand, { backgroundColor: c }]}>
                    <View style={[styles.tl, { width: 14, backgroundColor: 'rgba(255,255,255,.7)', height: 2 }]} />
                    <View style={[styles.tl, { width: 12, backgroundColor: 'rgba(255,255,255,.9)', height: 2 }]} />
                  </View>
                  {isSelected && (
                    <View style={[styles.thumbCheck, { backgroundColor: accentColor }]}>
                      <Icon name="check" size={10} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={[styles.thumbName, isSelected && { color: accentColor }]} numberOfLines={1}>
                  {tpl.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Color picker — compact dots */}
        <Text style={styles.rightSectionTitle}>Color</Text>
        <View style={styles.colorGrid}>
          {COLOR_PALETTE.map(c => (
            <TouchableOpacity key={c.hex} onPress={() => setAccentColor(c.hex)} style={styles.colorItem}>
              <View style={[
                styles.colorDot,
                { backgroundColor: c.hex },
                accentColor === c.hex && styles.colorDotActive,
              ]}>
                {accentColor === c.hex && <Icon name="check" size={11} color="#fff" />}
              </View>
              <Text style={[styles.colorName, accentColor === c.hex && { color: c.hex }]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Live preview */}
        <Text style={styles.rightSectionTitle}>Preview</Text>
        {invoiceHTML && (
          <View style={styles.previewWrap}>
            <WebView
              source={{ html: invoiceHTML }}
              style={{ width: '100%', height: 600 }}
              scrollEnabled
            />
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle}>{invoice.invoice_number}</Text>
          <Text style={styles.headerSub}>{invoice.date} · {invoice.party_name || 'Walk-in'}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusPillText, { color: statusStyle.text }]}>
            {statusKey.toUpperCase()}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateInvoice', { invoice })}
          style={styles.iconBtn}
        >
          <Icon name="edit-2" size={16} color={COLORS.textSub} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={[styles.iconBtn, styles.iconBtnDanger]}>
          <Icon name="trash-2" size={16} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      {/* ── Body: side-by-side on wide, stacked on narrow ── */}
      {isWide ? (
        <View style={styles.wideBody}>
          <View style={styles.leftPanel}>
            {LeftPanel}
          </View>
          {RightPanel}
        </View>
      ) : (
        LeftPanel
      )}

      {/* ── Payment Modal ── */}
      <Modal visible={payModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Payment</Text>
              <TouchableOpacity onPress={() => setPayModal(false)} style={{ padding: 4 }}>
                <Icon name="x" size={18} color={COLORS.textMute} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              <View style={styles.payInvInfo}>
                <Text style={styles.payInvNum}>{invoice.invoice_number}</Text>
                <Text style={styles.payInvParty}>{invoice.party_name || 'Walk-in'}</Text>
                <Text style={styles.payInvBalance}>Balance due: {formatINR(balance)}</Text>
              </View>
              <FL>Amount (₹)*</FL>
              <TextInput
                style={styles.input}
                value={payAmount}
                onChangeText={setPayAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={COLORS.textMute}
              />
              <FL>Date</FL>
              <TextInput
                style={styles.input}
                value={payDate}
                onChangeText={setPayDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMute}
              />
              <FL>Payment Method</FL>
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
              <FL>Reference (optional)</FL>
              <TextInput
                style={styles.input}
                value={payRef}
                onChangeText={setPayRef}
                placeholder="UTR / Cheque No."
                placeholderTextColor={COLORS.textMute}
              />
              <FL>Note (optional)</FL>
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
                  : <Text style={styles.confirmBtnText}>Confirm Payment</Text>
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

function FL({ children }) {
  return (
    <Text style={{
      fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textSub,
      textTransform: 'uppercase', letterSpacing: 0.6,
      marginBottom: 7, marginTop: 18,
    }}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.bg },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn:        { padding: 4, marginRight: 2 },
  headerTitle:    { fontSize: 17, fontWeight: FONTS.black, color: COLORS.text },
  headerSub:      { fontSize: 12, color: COLORS.textMute, marginTop: 1 },
  statusPill:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, marginRight: 8 },
  statusPillText: { fontSize: 10, fontWeight: FONTS.black, letterSpacing: 0.5 },
  iconBtn:        { padding: 8, borderRadius: RADIUS.sm, backgroundColor: COLORS.bg, marginLeft: 6 },
  iconBtnDanger:  { backgroundColor: COLORS.dangerLight },

  // Wide layout
  wideBody:   { flex: 1, flexDirection: 'row' },
  leftPanel:  { flex: 1, borderRightWidth: 1, borderRightColor: COLORS.border },
  rightPanel: {
    width: 340,
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    paddingTop: 14,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
  },

  // Money strip
  moneyStrip: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  moneyCell:  { flex: 1, alignItems: 'center', paddingVertical: 14 },
  moneySep:   { width: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  moneyLabel: { fontSize: 10, fontWeight: FONTS.medium, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  moneyVal:   { fontSize: 17, fontWeight: FONTS.black, color: COLORS.text },

  // Pay banner
  payBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    marginHorizontal: 14, marginTop: 12,
    borderRadius: RADIUS.lg, padding: 14,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  payBannerLabel:   { fontSize: 11, color: '#92400E', fontWeight: FONTS.medium },
  payBannerAmt:     { fontSize: 22, fontWeight: FONTS.black, color: '#92400E' },
  payBannerBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F59E0B', paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.md },
  payBannerBtnText: { fontSize: 13, fontWeight: FONTS.bold, color: '#fff' },

  // Cards
  card: {
    backgroundColor: COLORS.card,
    marginHorizontal: 14, marginTop: 10,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 14,
  },
  cardSectionTitle: {
    fontSize: 10, fontWeight: FONTS.bold, color: COLORS.textMute,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10,
  },

  // Bill-to
  partyName: { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 3 },
  partySub:  { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  dateRow:   { flexDirection: 'row', gap: 14, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  dateCell:  { flex: 1 },
  dateLbl:   { fontSize: 10, fontWeight: FONTS.medium, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  dateVal:   { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.text },

  // Items
  itemRow:       { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 9, gap: 10 },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemDot:       { width: 6, height: 6, borderRadius: 3, marginTop: 6, flexShrink: 0 },
  itemName:      { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.text },
  itemMeta:      { fontSize: 11, color: COLORS.textSub, marginTop: 2 },
  itemDiscount:  { fontSize: 11, color: COLORS.success, marginTop: 1 },
  itemTotal:     { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.text, flexShrink: 0 },

  // Tax
  taxRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  taxLbl:      { fontSize: 13, color: COLORS.textSub },
  taxVal:      { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.text },
  taxTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, marginTop: 4, borderTopWidth: 2, borderTopColor: COLORS.border },
  taxTotalLbl: { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text },
  taxTotalVal: { fontSize: 18, fontWeight: FONTS.black, color: COLORS.text },

  // Payment history
  payRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  payRowBorder:  { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  payIcon:       { width: 30, height: 30, borderRadius: RADIUS.sm, backgroundColor: COLORS.successBg, alignItems: 'center', justifyContent: 'center' },
  payMethod:     { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.text },
  payDate:       { fontSize: 11, color: COLORS.textSub, marginTop: 1 },
  payAmt:        { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.success },

  // Notes
  notesText: { fontSize: 13, color: COLORS.textSub, lineHeight: 20 },

  // Mobile actions
  mobileActions: {
    flexDirection: 'row', gap: 10,
    marginHorizontal: 14, marginTop: 14,
  },
  mobileActBtn:          { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: RADIUS.md },
  mobileActTxt:          { fontSize: 13, fontWeight: FONTS.bold, color: '#fff' },
  mobileActBtnSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  mobileActTxtSecondary: { fontSize: 12, fontWeight: FONTS.semibold, color: COLORS.textSub },

  // Right panel
  rightSectionTitle: {
    fontSize: 10, fontWeight: FONTS.bold, color: COLORS.textMute,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 10, marginTop: 16,
  },
  rightActions: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  rightActBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10, borderRadius: RADIUS.md,
  },
  rightActTxt:    { fontSize: 12, fontWeight: FONTS.bold, color: '#fff' },
  rightActBtnSec: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  rightActTxtSec: { fontSize: 11, fontWeight: FONTS.semibold, color: COLORS.textSub },

  // Template picker
  tplScroll: { gap: 8, paddingBottom: 4 },
  tplThumb: {
    width: 72,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5, borderColor: COLORS.border,
    overflow: 'hidden',
    padding: 4,
  },
  thumbPreview:  { backgroundColor: '#fff', borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  thumbHeader:   { flexDirection: 'row', justifyContent: 'space-between', padding: 4 },
  thumbTR:       { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3, paddingVertical: 2 },
  thumbGrand:    { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3, paddingVertical: 2 },
  thumbCheck:    { position: 'absolute', top: 2, left: 2, width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  thumbName:     { fontSize: 10, fontWeight: FONTS.semibold, color: COLORS.textSub, textAlign: 'center' },
  tl:            { borderRadius: 1, backgroundColor: '#CBD5E1' },

  // Color grid
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  colorItem:    { alignItems: 'center', gap: 3, width: 42 },
  colorDot:     { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorDotActive:{ borderColor: COLORS.text, transform: [{ scale: 1.1 }] },
  colorName:    { fontSize: 9, color: COLORS.textMute, textAlign: 'center' },

  // Preview
  previewWrap: {
    borderRadius: RADIUS.md, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: '#fff',
  },

  // Payment modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl,
    maxHeight: '92%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderDark, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: FONTS.black, color: COLORS.text },
  input: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: COLORS.text,
  },
  methodRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  methodChip:    { paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.md, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  methodChipActive:  { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  methodText:        { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  methodTextActive:  { color: COLORS.primary, fontWeight: FONTS.bold },
  confirmBtn:        { backgroundColor: COLORS.success, borderRadius: RADIUS.lg, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  confirmBtnText:    { color: '#fff', fontWeight: FONTS.black, fontSize: 15 },
  payInvInfo:        { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 14, marginBottom: 8 },
  payInvNum:         { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.primary, marginBottom: 3 },
  payInvParty:       { fontSize: 13, color: COLORS.text },
  payInvBalance:     { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.danger, marginTop: 4 },
});