import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, TextInput, ActivityIndicator, Share,
  FlatList, Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getInvoiceDetail, recordPayment, deleteInvoice, getProfile } from '../../db/db';
import { formatINR, PAYMENT_METHODS, today } from '../../utils/gst';
import { TEMPLATES, buildHTML } from '../../utils/templates/index';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W   = SCREEN_W * 0.52;
const CARD_GAP = 12;

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

// ── Mini preview for template picker ─────────────────────────────
function InvoiceMiniPreview({ accent }) {
  return (
    <View style={[mini.wrap]}>
      <View style={[mini.header, { backgroundColor: accent }]}>
        <View style={mini.hLeft}>
          <View style={[mini.line, { width: 52, backgroundColor: 'rgba(255,255,255,0.9)', height: 5 }]} />
          <View style={[mini.line, { width: 38, marginTop: 3 }]} />
          <View style={[mini.line, { width: 28, marginTop: 2 }]} />
        </View>
        <View style={mini.hRight}>
          <View style={[mini.line, { width: 44, backgroundColor: 'rgba(255,255,255,0.85)', height: 7, borderRadius: 1 }]} />
          <View style={[mini.line, { width: 28, marginTop: 3, alignSelf: 'flex-end' }]} />
          <View style={[mini.line, { width: 20, marginTop: 2, alignSelf: 'flex-end' }]} />
        </View>
      </View>
      <View style={mini.metaBar}>
        {[0,1,2,3].map(i => (
          <View key={i} style={[mini.metaCell, { backgroundColor: i%2===0 ? accent+'10':'#fff' }]}>
            <View style={[mini.line, { width: 16, height: 2, marginBottom: 2 }]} />
            <View style={[mini.line, { width: 22, height: 3, backgroundColor: '#374151' }]} />
          </View>
        ))}
      </View>
      <View style={mini.partyRow}>
        {[0,1].map(i => (
          <View key={i} style={[mini.partyCol, i===0 && { borderRightWidth: 0.5, borderRightColor: accent+'30' }]}>
            <View style={[mini.line, { width: 20, backgroundColor: accent, height: 2, marginBottom: 3 }]} />
            <View style={[mini.line, { width: 40, height: 4, backgroundColor: '#111' }]} />
            <View style={[mini.line, { width: 32, marginTop: 2 }]} />
          </View>
        ))}
      </View>
      <View style={[mini.tHead, { backgroundColor: accent }]}>
        {[28,14,16,16,16].map((w,i) => (
          <View key={i} style={[mini.line, { width: w, backgroundColor: 'rgba(255,255,255,0.75)', height: 3 }]} />
        ))}
      </View>
      {[0,1,2].map(i => (
        <View key={i} style={[mini.tRow, { backgroundColor: i%2===0 ? accent+'0C':'#fff' }]}>
          {[28,14,16,16,16].map((w,j) => (
            <View key={j} style={[mini.line, { width: w, height: 3, backgroundColor: j===4 ? accent+'70':'#CBD5E1' }]} />
          ))}
        </View>
      ))}
      <View style={mini.bottom}>
        <View style={{ flex: 1 }}>
          <View style={[mini.wBox, { borderColor: accent+'30' }]}>
            <View style={[mini.line, { width: 26, backgroundColor: accent, height: 2, marginBottom: 2 }]} />
            <View style={[mini.line, { width: 52 }]} />
          </View>
          <View style={[mini.upiBox, { borderColor: accent+'40' }]}>
            <View style={[mini.qr, { borderColor: accent+'60' }]}>
              <Text style={[mini.qrTxt, { color: accent }]}>QR</Text>
            </View>
          </View>
        </View>
        <View style={mini.totals}>
          {[0,1,2,3].map(i => (
            <View key={i} style={mini.tTotalRow}>
              <View style={[mini.line, { width: 22 }]} />
              <View style={[mini.line, { width: 18, backgroundColor: i===3 ? accent:'#CBD5E1' }]} />
            </View>
          ))}
          <View style={[mini.grand, { backgroundColor: accent }]}>
            <View style={[mini.line, { width: 20, backgroundColor: 'rgba(255,255,255,0.7)' }]} />
            <View style={[mini.line, { width: 18, backgroundColor: 'rgba(255,255,255,0.9)' }]} />
          </View>
        </View>
      </View>
      <View style={[mini.footer, { backgroundColor: accent }]}>
        <View style={[mini.line, { width: 42, backgroundColor: 'rgba(255,255,255,0.7)', height: 3 }]} />
        <View style={[mini.line, { width: 30, backgroundColor: 'rgba(255,255,255,0.45)', marginTop: 2 }]} />
      </View>
    </View>
  );
}

const mini = StyleSheet.create({
  wrap:     { backgroundColor: '#fff', overflow: 'hidden' },
  header:   { padding: 7, flexDirection: 'row', justifyContent: 'space-between' },
  hLeft:    { flex: 1 },
  hRight:   { alignItems: 'flex-end' },
  metaBar:  { flexDirection: 'row', borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#E5E7EB' },
  metaCell: { flex: 1, padding: 3, borderRightWidth: 0.5, borderRightColor: '#E5E7EB' },
  partyRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  partyCol: { flex: 1, padding: 5 },
  tHead:    { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 4 },
  tRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 3 },
  bottom:   { flexDirection: 'row', padding: 4, gap: 4 },
  wBox:     { borderWidth: 0.5, borderRadius: 2, padding: 3, marginBottom: 3 },
  upiBox:   { borderWidth: 0.5, borderRadius: 2, padding: 4, alignItems: 'center' },
  qr:       { width: 20, height: 20, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', borderRadius: 2 },
  qrTxt:    { fontSize: 6, fontWeight: '700' },
  totals:   { width: 56 },
  tTotalRow:{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  grand:    { flexDirection: 'row', justifyContent: 'space-between', padding: 3, borderRadius: 1, marginTop: 2 },
  footer:   { padding: 5 },
  line:     { height: 3, borderRadius: 2, backgroundColor: '#CBD5E1' },
});

export default function InvoiceDetail({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { invoiceId } = route.params;

  const [invoice, setInvoice]     = useState(null);
  const [profile, setProfile]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [printing, setPrinting]   = useState(false);
  const [webViewH, setWebViewH]   = useState(800);

  // Template & color
  const [selectedTpl, setSelectedTpl] = useState('t1');
  const [accentColor, setAccentColor] = useState('#1E40AF');
  const [tplModal, setTplModal]       = useState(false);
  const [actionAfterPick, setActionAfterPick] = useState(null);
  const flatRef = useRef(null);

  // Payment
  const [payModal, setPayModal]   = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payRef, setPayRef]       = useState('');
  const [payDate, setPayDate]     = useState(today());
  const [payNote, setPayNote]     = useState('');
  const [paying, setPaying]       = useState(false);

  // ── Load ─────────────────────────────────────────────────────
  const load = async () => {
    try {
      const [inv, prof] = await Promise.all([
        getInvoiceDetail(invoiceId),
        getProfile(),
      ]);
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

  // ── Build invoice HTML for WebView ───────────────────────────
  const invoiceHTML = invoice && profile
    ? buildHTML(selectedTpl, invoice, profile, accentColor)
    : null;

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
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setPaying(false); }
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

  // ── Template picker ───────────────────────────────────────────
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
      const html = buildHTML(selectedTpl, invoice, profile, accentColor);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Invoice ${invoice.invoice_number}`,
        UTI: 'com.adobe.pdf',
      });
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setPrinting(false); }
  };

  const doPrint = async () => {
    setPrinting(true);
    try {
      const html = buildHTML(selectedTpl, invoice, profile, accentColor);
      await Print.printAsync({ html });
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setPrinting(false); }
  };

  // ── WhatsApp ──────────────────────────────────────────────────
  const handleWhatsApp = async () => {
    const isInter = invoice.supply_type === 'inter';
    const msg =
`🧾 *Invoice ${invoice.invoice_number}*
From: ${profile?.name || 'My Business'}
Date: ${invoice.date}${invoice.due_date ? `\nDue: ${invoice.due_date}` : ''}

*Items:*
${(invoice.items || []).map(i => `• ${i.name} × ${i.qty} = ${formatINR(i.total)}`).join('\n')}

Taxable: ${formatINR(invoice.taxable)}
${isInter ? `IGST: ${formatINR(invoice.igst)}` : `CGST: ${formatINR(invoice.cgst)}\nSGST: ${formatINR(invoice.sgst)}`}
*Total: ${formatINR(invoice.total)}*${invoice.paid > 0 ? `\nPaid: ${formatINR(invoice.paid)}\nBalance: ${formatINR(balance)}` : ''}

_Generated by your business_`;
    try { await Share.share({ message: msg }); }
    catch (e) { Alert.alert('Error', e.message); }
  };

  // ── Template card ─────────────────────────────────────────────
  const renderTemplateCard = ({ item }) => {
    const isSelected = selectedTpl === item.id;
    const cardAccent = isSelected ? accentColor : item.accent;
    return (
      <TouchableOpacity
        style={[styles.tplCard, isSelected && { borderColor: accentColor, borderWidth: 2 }]}
        onPress={() => { setSelectedTpl(item.id); setAccentColor(item.accent); }}
        activeOpacity={0.9}
      >
        {isSelected && (
          <View style={[styles.selBadge, { backgroundColor: accentColor }]}>
            <Text style={styles.selBadgeText}>✓ Selected</Text>
          </View>
        )}
        {item.id === 't5' && (
          <View style={styles.thermalBadge}>
            <Text style={styles.thermalText}>🖨️ Thermal</Text>
          </View>
        )}
        <InvoiceMiniPreview accent={cardAccent} />
        <View style={[styles.tplCardFooter, isSelected && { backgroundColor: accentColor + '12' }]}>
          <View style={[styles.accentDot, { backgroundColor: cardAccent }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.tplCardName, isSelected && { color: accentColor }]}>{item.name}</Text>
            <Text style={styles.tplCardSub}>{item.subtitle}</Text>
          </View>
        </View>
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

      {/* ── Header ─────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle}>{invoice.invoice_number}</Text>
          <Text style={styles.headerSub}>{invoice.date}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusPillText, { color: statusStyle.text }]}>
            {statusKey.toUpperCase()}
          </Text>
        </View>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteIcon}>🗑️</Text>
        </TouchableOpacity>
      </View>

      {/* ── Action bar ─────────────────────────────────────── */}
      <View style={styles.actionBar}>
        {balance > 0.01 && (
          <ActionBtn icon="💰" label="Payment"  color={COLORS.success}   onPress={openPayModal} />
        )}
        <ActionBtn icon="📄"  label="PDF"       color={COLORS.primary}   onPress={() => openTemplatePicker('pdf')}   loading={printing} />
        <ActionBtn icon="💬"  label="WhatsApp"  color="#25D366"          onPress={handleWhatsApp} />
        <ActionBtn icon="🖨️"  label="Print"     color={COLORS.secondary} onPress={() => openTemplatePicker('print')} loading={printing} />
        <ActionBtn icon="🎨"  label="Template"  color={accentColor}      onPress={() => setTplModal(true)} />
      </View>

      {/* ── Template strip ─────────────────────────────────── */}
      <TouchableOpacity style={styles.tplStrip} onPress={() => setTplModal(true)} activeOpacity={0.8}>
        <View style={[styles.tplStripDot, { backgroundColor: accentColor }]} />
        <Text style={styles.tplStripLabel}>{activeTpl.name} — {activeTpl.subtitle}</Text>
        <Text style={styles.tplStripArrow}>Change ▾</Text>
      </TouchableOpacity>

      {/* ── Invoice WebView preview ─────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Balance due banner */}
        {balance > 0.01 && (
          <TouchableOpacity
            style={styles.balanceBanner}
            onPress={openPayModal}
            activeOpacity={0.85}
          >
            <View>
              <Text style={styles.balanceBannerLabel}>Balance Due</Text>
              <Text style={styles.balanceBannerAmount}>{formatINR(balance)}</Text>
            </View>
            <View style={styles.balanceBannerBtn}>
              <Text style={styles.balanceBannerBtnText}>Record Payment →</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* The actual invoice rendered */}
        {invoiceHTML && (
          <View style={styles.webViewWrap}>
            <WebView
              source={{ html: invoiceHTML }}
              style={{ width: SCREEN_W - 24, height: webViewH }}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              onMessage={e => {
                // Receive height from injected JS
                const h = parseInt(e.nativeEvent.data, 10);
                if (h && h > 100) setWebViewH(h);
              }}
              injectedJavaScript={`
                setTimeout(() => {
                  const height = document.documentElement.scrollHeight || document.body.scrollHeight;
                  window.ReactNativeWebView.postMessage(String(height));
                }, 300);
                true;
              `}
              onShouldStartLoadWithRequest={() => true}
            />
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Template Picker Modal ──────────────────────────── */}
      <Modal visible={tplModal} transparent animationType="slide">
        <View style={styles.tplOverlay}>
          <View style={styles.tplSheet}>

            <View style={styles.tplSheetHeader}>
              <View>
                <Text style={styles.tplSheetTitle}>Invoice Template</Text>
                <Text style={styles.tplSheetSub}>Swipe to browse · tap to select</Text>
              </View>
              <TouchableOpacity onPress={() => setTplModal(false)}>
                <Text style={styles.tplClose}>✕</Text>
              </TouchableOpacity>
            </View>

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

            <View style={styles.dotsRow}>
              {TEMPLATES.map(t => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => {
                    setSelectedTpl(t.id);
                    setAccentColor(t.accent);
                    const idx = TEMPLATES.findIndex(tp => tp.id === t.id);
                    flatRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0 });
                  }}
                >
                  <View style={[
                    styles.dot,
                    selectedTpl === t.id && [styles.dotActive, { backgroundColor: accentColor }],
                  ]} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Color picker */}
            <View style={styles.colorSection}>
              <Text style={styles.colorTitle}>Accent Color</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorRow}>
                {COLOR_PALETTE.map(c => (
                  <TouchableOpacity key={c.hex} style={styles.colorItem} onPress={() => setAccentColor(c.hex)}>
                    <View style={[
                      styles.colorDot,
                      { backgroundColor: c.hex },
                      accentColor === c.hex && { borderColor: c.hex, borderWidth: 3, transform: [{ scale: 1.15 }] },
                    ]}>
                      {accentColor === c.hex && <Text style={styles.colorCheck}>✓</Text>}
                    </View>
                    <Text style={[styles.colorName, accentColor === c.hex && { color: c.hex, fontWeight: FONTS.bold }]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.tplActions}>
              <TouchableOpacity style={styles.tplCancelBtn} onPress={() => setTplModal(false)}>
                <Text style={styles.tplCancelText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tplConfirmBtn, { backgroundColor: accentColor }]}
                onPress={() => { setTplModal(false); doPDF(); }}
              >
                {printing
                  ? <ActivityIndicator color={COLORS.white} size="small" />
                  : <Text style={styles.tplConfirmText}>📄 Export PDF</Text>
                }
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
              <TextInput style={styles.input} value={payAmount} onChangeText={setPayAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={COLORS.textMute} />

              <FieldLabel>Date</FieldLabel>
              <TextInput style={styles.input} value={payDate} onChangeText={setPayDate} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMute} />

              <FieldLabel>Payment Method</FieldLabel>
              <View style={styles.methodRow}>
                {PAYMENT_METHODS.map(m => (
                  <TouchableOpacity key={m}
                    style={[styles.methodChip, payMethod === m && styles.methodChipActive]}
                    onPress={() => setPayMethod(m)}
                  >
                    <Text style={[styles.methodText, payMethod === m && styles.methodTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <FieldLabel>Reference (optional)</FieldLabel>
              <TextInput style={styles.input} value={payRef} onChangeText={setPayRef} placeholder="UTR / Cheque No." placeholderTextColor={COLORS.textMute} />

              <FieldLabel>Note (optional)</FieldLabel>
              <TextInput style={styles.input} value={payNote} onChangeText={setPayNote} placeholder="Any note..." placeholderTextColor={COLORS.textMute} />

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

// ─── Helpers ──────────────────────────────────────────────────────

function FieldLabel({ children }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
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
  container: { flex: 1, backgroundColor: COLORS.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound:  { fontSize: 16, color: COLORS.textMute },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn:      { padding: 4 },
  backIcon:     { fontSize: 22, color: COLORS.primary },
  headerTitle:  { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text },
  headerSub:    { fontSize: 12, color: COLORS.textSub, marginTop: 1 },
  statusPill:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, marginRight: 6 },
  statusPillText:{ fontSize: 11, fontWeight: FONTS.heavy, letterSpacing: 0.5 },
  deleteBtn:    { padding: 8 },
  deleteIcon:   { fontSize: 20 },

  // Action bar
  actionBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 4,
  },
  actionBtn:    { flex: 1, alignItems: 'center' },
  actionIconBox:{ width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  actionIcon:   { fontSize: 20 },
  actionLabel:  { fontSize: 10, fontWeight: FONTS.semibold },

  // Template strip
  tplStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  tplStripDot:   { width: 10, height: 10, borderRadius: 5 },
  tplStripLabel: { flex: 1, fontSize: 12, fontWeight: FONTS.semibold, color: 'rgba(255,255,255,0.85)' },
  tplStripArrow: { fontSize: 12, color: COLORS.accent, fontWeight: FONTS.bold },

  // Balance banner
  balanceBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    marginHorizontal: 12, marginTop: 12,
    borderRadius: RADIUS.lg, padding: 14,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  balanceBannerLabel:  { fontSize: 11, color: '#92400E', fontWeight: FONTS.medium },
  balanceBannerAmount: { fontSize: 20, fontWeight: FONTS.heavy, color: '#92400E' },
  balanceBannerBtn:    { backgroundColor: '#F59E0B', paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md },
  balanceBannerBtnText:{ fontSize: 13, fontWeight: FONTS.bold, color: COLORS.white },

  // WebView invoice
  webViewWrap: {
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOW.md,
    backgroundColor: '#fff',
  },

  // Template picker
  tplOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  tplSheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingBottom: 32, maxHeight: '88%',
  },
  tplSheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tplSheetTitle: { fontSize: 18, fontWeight: FONTS.heavy, color: COLORS.text },
  tplSheetSub:   { fontSize: 12, color: COLORS.textMute, marginTop: 2 },
  tplClose:      { fontSize: 20, color: COLORS.textMute, padding: 4 },
  tplList:       { paddingHorizontal: 16, paddingVertical: 14 },

  tplCard: {
    width: CARD_W, backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.border,
    overflow: 'hidden', ...SHADOW.md,
  },
  selBadge:     { position: 'absolute', top: 8, left: 8, zIndex: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  selBadgeText: { fontSize: 10, color: COLORS.white, fontWeight: FONTS.bold },
  thermalBadge: { position: 'absolute', top: 8, right: 8, zIndex: 11, backgroundColor: '#1F2937', borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 3 },
  thermalText:  { fontSize: 9, color: COLORS.white, fontWeight: FONTS.bold },
  tplCardFooter:{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border },
  accentDot:    { width: 10, height: 10, borderRadius: 5 },
  tplCardName:  { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.text },
  tplCardSub:   { fontSize: 10, color: COLORS.textMute, marginTop: 1 },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  dot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border },
  dotActive: { width: 22, borderRadius: 3 },

  colorSection: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border },
  colorTitle:   { fontSize: 12, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  colorRow:     { gap: 10, paddingBottom: 2 },
  colorItem:    { alignItems: 'center', gap: 4 },
  colorDot:     { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: 'transparent' },
  colorCheck:   { color: COLORS.white, fontSize: 13, fontWeight: FONTS.heavy },
  colorName:    { fontSize: 9, color: COLORS.textMute },

  tplActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border },
  tplCancelBtn:  { flex: 1, paddingVertical: 13, borderRadius: RADIUS.lg, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.border },
  tplCancelText: { fontSize: 15, fontWeight: FONTS.semibold, color: COLORS.textSub },
  tplConfirmBtn: { flex: 2, paddingVertical: 13, borderRadius: RADIUS.lg, alignItems: 'center' },
  tplConfirmText:{ fontSize: 15, fontWeight: FONTS.bold, color: COLORS.white },

  // Payment modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, maxHeight: '85%', paddingBottom: 20 },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle:   { fontSize: 17, fontWeight: FONTS.bold, color: COLORS.text },
  modalClose:   { fontSize: 20, color: COLORS.textMute, padding: 4 },

  payInvInfo:    { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 14, marginBottom: 4 },
  payInvNum:     { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.primary },
  payInvParty:   { fontSize: 14, color: COLORS.text, marginTop: 2 },
  payInvBalance: { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.danger, marginTop: 4 },

  fieldLabel: { fontSize: 12, fontWeight: FONTS.semibold, color: COLORS.textSub, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.4 },
  input:      { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 10, fontSize: 14, color: COLORS.text },

  methodRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  methodChip:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  methodChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  methodText:       { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  methodTextActive: { color: COLORS.primary, fontWeight: FONTS.bold },

  confirmBtn:     { backgroundColor: COLORS.success, borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  confirmBtnText: { color: COLORS.white, fontWeight: FONTS.bold, fontSize: 15 },
});
