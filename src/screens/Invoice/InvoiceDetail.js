import Icon from '../../utils/Icon';
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, TextInput, ActivityIndicator, Share,
  FlatList, Dimensions,
} from 'react-native';
import { Platform } from 'react-native';
// WebView is not available on web — use iframe instead
const WebView = Platform.OS === 'web'
  ? ({ source, style, onMessage }) => {
      const iframeRef = React.useRef(null);
      const [iframeHeight, setIframeHeight] = React.useState(style?.height || 900);
      React.useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        const handleLoad = () => {
          try {
            const h = iframe.contentDocument?.body?.scrollHeight;
            if (h && h > 100) setIframeHeight(h + 32);
          } catch (_) {}
        };
        iframe.addEventListener('load', handleLoad);
        return () => iframe.removeEventListener('load', handleLoad);
      }, [source?.html]);
      return React.createElement('iframe', {
        ref: iframeRef,
        src: source?.html ? `data:text/html,${encodeURIComponent(source.html)}` : source?.uri,
        style: { border: 'none', width: '100%', height: iframeHeight },
      });
    }
  : require('react-native-webview').WebView;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Platform as _Platform } from 'react-native';
const Print = _Platform.OS === 'web'
  ? {
      // Opens browser Print dialog → user can Save as PDF.
      // Injects the invoice HTML into a hidden iframe, waits for assets,
      // then triggers window.print() so the browser handles PDF generation.
      printToFileAsync: async ({ html }) => {
        // Return a sentinel so doPDF knows to call window.print() instead
        // of trying to fetch a real file URI.
        return { uri: '__web_print__', html };
      },
      printAsync: async ({ html }) => {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;';
        document.body.appendChild(iframe);
        iframe.contentDocument.open();
        iframe.contentDocument.write(html);
        iframe.contentDocument.close();
        await new Promise(resolve => setTimeout(resolve, 600));
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        // Remove after a short delay to allow print dialog to open
        setTimeout(() => document.body.removeChild(iframe), 2000);
      },
    }
  : require('expo-print');
const Sharing = _Platform.OS === 'web'
  ? {
      shareAsync: async (url, options) => {
        // If the Print polyfill returned our sentinel, use browser print dialog
        if (url === '__web_print__') return;
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          const fileName = options?.dialogTitle ? `${options.dialogTitle}.pdf` : 'invoice.pdf';
          link.setAttribute('download', fileName);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
          console.error('Download failed:', err);
          alert('Failed to save. Please use the Print button and save as PDF.');
        }
      },
    }
  : require('expo-sharing');
import { getInvoiceDetail, recordPayment, deleteInvoice, getProfile } from '../../db';
import { formatINR, PAYMENT_METHODS, today } from '../../utils/gst';
import { TEMPLATES, buildHTML } from '../../utils/templates/index';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';

const { width: SW } = Dimensions.get('window');

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
  const insets = useSafeAreaInsets();
  const { invoiceId } = route.params;

  const [invoice, setInvoice]   = useState(null);
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [printing, setPrinting] = useState(false);
  const [webViewH, setWebViewH] = useState(900);

  const [selectedTpl, setSelectedTpl] = useState('t1');
  const [accentColor, setAccentColor] = useState('#1E40AF');

  // Payment
  const [payModal, setPayModal]   = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payRef, setPayRef]       = useState('');
  const [payDate, setPayDate]     = useState(today());
  const [payNote, setPayNote]     = useState('');
  const [paying, setPaying]       = useState(false);

  const tplScrollRef = useRef(null);

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

  const invoiceHTML = invoice && profile
    ? buildHTML(selectedTpl, invoice, profile, accentColor)
    : null;

  // ── Payment ───────────────────────────────────────────────────
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

  const handleEdit = () => {
    navigation.navigate('CreateInvoice', { invoice });
  };

  const handleDelete = () => {
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
      if (_Platform.OS === 'web') {
        // On web: open the browser print dialog — user saves as PDF
        await Print.printAsync({ html });
      } else {
        // On native: generate a real PDF file and share it
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Invoice_${invoice.invoice_number}`,
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setPrinting(false);
    }
  };

  const doPrint = async () => {
    setPrinting(true);
    try {
      const html = buildHTML(selectedTpl, invoice, profile, accentColor);
      await Print.printAsync({ html });
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setPrinting(false); }
  };

  const handleWhatsApp = async () => {
    const isInter = invoice.supply_type === 'inter';
    const msg =
`*Invoice ${invoice.invoice_number}*
From: ${profile?.name || 'My Business'}
Date: ${invoice.date}${invoice.due_date ? `\nDue: ${invoice.due_date}` : ''}

*Items:*
${(invoice.items || []).map(i => `${i.name} x${i.qty} = ${formatINR(i.total)}`).join('\n')}

Taxable: ${formatINR(invoice.taxable)}
${isInter ? `IGST: ${formatINR(invoice.igst)}` : `CGST: ${formatINR(invoice.cgst)}\nSGST: ${formatINR(invoice.sgst)}`}
*Total: ${formatINR(invoice.total)}*${invoice.paid > 0 ? `\nPaid: ${formatINR(invoice.paid)}\nBalance: ${formatINR(balance)}` : ''}`;
    try { await Share.share({ message: msg }); }
    catch (e) { Alert.alert('Error', e.message); }
  };

  const selectTemplate = (tpl) => {
    setSelectedTpl(tpl.id);
    setAccentColor(tpl.accent);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  if (!invoice) return <View style={styles.center}><Text style={styles.notFound}>Invoice not found</Text></View>;

  const statusKey   = getStatus();
  const statusStyle = STATUS_STYLE[statusKey] || STATUS_STYLE.unpaid;
  const activeTpl   = TEMPLATES.find(t => t.id === selectedTpl) || TEMPLATES[0];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Header ─────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle}>{invoice.invoice_number}</Text>
          <Text style={styles.headerSub}>{invoice.date} · {invoice.party_name || 'Walk-in'}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusPillText, { color: statusStyle.text }]}>{statusKey.toUpperCase()}</Text>
        </View>
        <TouchableOpacity onPress={handleEdit} style={styles.editBtn}>
          <Icon name="edit-2" size={16} color={COLORS.textSub} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <Icon name="trash-2" size={16} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

        {/* ── Action bar ─────────────────────────────────── */}
        <View style={styles.actionBar}>
          {balance > 0.01 && <ActionBtn icon="dollar-sign" label="Payment"  color={COLORS.success}   onPress={openPayModal} />}
          <ActionBtn icon="download" label="PDF"      color={COLORS.primary}   onPress={doPDF}   loading={printing} />
          <ActionBtn icon="message-circle" label="WhatsApp" color="#25D366"          onPress={handleWhatsApp} />
          <ActionBtn icon="printer" label="Print"    color={COLORS.secondary} onPress={doPrint} loading={printing} />
        </View>

        {/* ── Balance banner ──────────────────────────────── */}
        {balance > 0.01 && (
          <TouchableOpacity style={styles.balanceBanner} onPress={openPayModal} activeOpacity={0.85}>
            <View>
              <Text style={styles.balanceBannerLabel}>Balance Due</Text>
              <Text style={styles.balanceBannerAmt}>{formatINR(balance)}</Text>
            </View>
            <View style={styles.balanceBannerBtn}>
              <><Text style={styles.balanceBannerBtnText}>Record Payment</Text><Icon name="arrow-right" size={13} color={COLORS.white} /></>
            </View>
          </TouchableOpacity>
        )}

        {/* ══════════════════════════════════════════════════
            TEMPLATE SELECTOR — always visible, swipeable
        ══════════════════════════════════════════════════ */}
        <View style={styles.selectorSection}>
          <Text style={styles.selectorTitle}>Invoice Template</Text>

          {/* Horizontally scrollable template cards */}
          <ScrollView
            ref={tplScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tplScroll}
            snapToInterval={100 + 10}
            decelerationRate="fast"
          >
            {TEMPLATES.map(tpl => {
              const isSelected = selectedTpl === tpl.id;
              const c = isSelected ? accentColor : tpl.accent;
              return (
                <TouchableOpacity
                  key={tpl.id}
                  style={[styles.tplThumb, isSelected && { borderColor: accentColor, borderWidth: 2.5 }]}
                  onPress={() => selectTemplate(tpl)}
                  activeOpacity={0.85}
                >
                  {/* Mini invoice preview */}
                  <View style={[styles.thumbPreview, { borderColor: c + '40' }]}>
                    {/* Header band */}
                    <View style={[styles.thumbHeader, { backgroundColor: c }]}>
                      <View style={{ flex: 1 }}>
                        <View style={[styles.tl, { width: 32, backgroundColor: 'rgba(255,255,255,.9)', height: 4 }]} />
                        <View style={[styles.tl, { width: 22, marginTop: 2 }]} />
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <View style={[styles.tl, { width: 26, backgroundColor: 'rgba(255,255,255,.85)', height: 5, borderRadius: 1 }]} />
                        <View style={[styles.tl, { width: 18, marginTop: 2 }]} />
                      </View>
                    </View>
                    {/* Meta strip */}
                    <View style={styles.thumbMeta}>
                      {[0,1,2].map(i => (
                        <View key={i} style={[styles.thumbMetaCell, { backgroundColor: i%2===0 ? c+'12':'#fff' }]}>
                          <View style={[styles.tl, { width: 10, height: 2 }]} />
                          <View style={[styles.tl, { width: 14, height: 3, backgroundColor: '#374151', marginTop: 1 }]} />
                        </View>
                      ))}
                    </View>
                    {/* Table */}
                    <View style={[styles.thumbTH, { backgroundColor: c }]}>
                      {[16,10,14].map((w,i) => <View key={i} style={[styles.tl, { width: w, backgroundColor: 'rgba(255,255,255,.7)', height: 2 }]} />)}
                    </View>
                    {[0,1,2].map(i => (
                      <View key={i} style={[styles.thumbTR, { backgroundColor: i%2===0 ? c+'0C':'#fff' }]}>
                        {[16,10,14].map((w,j) => <View key={j} style={[styles.tl, { width: w, height: 2, backgroundColor: j===2?c+'70':'#CBD5E1' }]} />)}
                      </View>
                    ))}
                    {/* Total bar */}
                    <View style={[styles.thumbGrand, { backgroundColor: c }]}>
                      <View style={[styles.tl, { width: 18, backgroundColor: 'rgba(255,255,255,.7)', height: 3 }]} />
                      <View style={[styles.tl, { width: 16, backgroundColor: 'rgba(255,255,255,.9)', height: 3 }]} />
                    </View>
                    {/* Footer */}
                    <View style={[styles.thumbFooter, { backgroundColor: c }]}>
                      <View style={[styles.tl, { width: 28, backgroundColor: 'rgba(255,255,255,.6)', height: 2 }]} />
                    </View>
                    {/* Selected check */}
                    {isSelected && (
                      <View style={[styles.thumbCheck, { backgroundColor: accentColor }]}>
                        <Icon name="check" size={14} color={COLORS.white} />
                      </View>
                    )}
                    {tpl.id === 't5' && (
                      <View style={styles.thumbThermal}>
                        <Icon name="printer" size={20} color={COLORS.textSub} />
                      </View>
                    )}
                  </View>
                  {/* Label */}
                  <View style={[styles.thumbLabel, isSelected && { backgroundColor: accentColor + '18' }]}>
                    <View style={[styles.thumbDot, { backgroundColor: c }]} />
                    <Text style={[styles.thumbName, isSelected && { color: accentColor }]} numberOfLines={1}>{tpl.name}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Color picker */}
          <View style={styles.colorSection}>
            <Text style={styles.colorTitle}>Color</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorRow}>
              {COLOR_PALETTE.map(c => (
                <TouchableOpacity key={c.hex} style={styles.colorItem} onPress={() => setAccentColor(c.hex)}>
                  <View style={[
                    styles.colorDot,
                    { backgroundColor: c.hex },
                    accentColor === c.hex && { borderColor: COLORS.text, borderWidth: 2.5, transform: [{ scale: 1.15 }] },
                  ]}>
                    {accentColor === c.hex && <Icon name="check" size={14} color="#fff" />}
                  </View>
                  <Text style={[styles.colorName, accentColor === c.hex && { color: c.hex, fontWeight: FONTS.bold }]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Current selection label */}
          <View style={[styles.activeTemplateBar, { borderLeftColor: accentColor }]}>
            <View style={[styles.activeTemplateDot, { backgroundColor: accentColor }]} />
            <Text style={styles.activeTemplateText}>{activeTpl.name} · {activeTpl.subtitle}</Text>
            <TouchableOpacity 
              onPress={doPDF} // Make sure this calls doPDF
              disabled={printing} 
              style={[styles.exportNowBtn, { backgroundColor: accentColor }]}
            >
              {printing
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.exportNowText}>Export PDF</Text>
              }
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Live invoice preview ─────────────────────────── */}
        {invoiceHTML && (
          <View style={styles.webViewWrap}>
            <Text style={styles.previewLabel}>Preview</Text>
            <WebView
              source={{ html: invoiceHTML }}
              style={{ width: SW - 24, height: webViewH }}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              onMessage={e => {
                const h = parseInt(e.nativeEvent.data, 10);
                if (h && h > 100) setWebViewH(h + 20);
              }}
              injectedJavaScript={`
                setTimeout(() => {
                  const h = document.documentElement.scrollHeight || document.body.scrollHeight;
                  window.ReactNativeWebView.postMessage(String(h));
                }, 400);
                true;
              `}
            />
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Payment Modal ──────────────────────────────────── */}
      <Modal visible={payModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Payment</Text>
              <TouchableOpacity onPress={() => setPayModal(false)} style={{padding:4}}><Icon name="x" size={18} color={COLORS.textMute} /></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              <View style={styles.payInvInfo}>
                <Text style={styles.payInvNum}>{invoice.invoice_number}</Text>
                <Text style={styles.payInvParty}>{invoice.party_name || 'Walk-in'}</Text>
                <Text style={styles.payInvBalance}>Balance due: {formatINR(balance)}</Text>
              </View>
              <FL>Amount (₹)*</FL>
              <TextInput style={styles.input} value={payAmount} onChangeText={setPayAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={COLORS.textMute} />
              <FL>Date</FL>
              <TextInput style={styles.input} value={payDate} onChangeText={setPayDate} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMute} />
              <FL>Payment Method</FL>
              <View style={styles.methodRow}>
                {PAYMENT_METHODS.map(m => (
                  <TouchableOpacity key={m} style={[styles.methodChip, payMethod===m && styles.methodChipActive]} onPress={() => setPayMethod(m)}>
                    <Text style={[styles.methodText, payMethod===m && styles.methodTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <FL>Reference (optional)</FL>
              <TextInput style={styles.input} value={payRef} onChangeText={setPayRef} placeholder="UTR / Cheque No." placeholderTextColor={COLORS.textMute} />
              <FL>Note (optional)</FL>
              <TextInput style={styles.input} value={payNote} onChangeText={setPayNote} placeholder="Any note..." placeholderTextColor={COLORS.textMute} />
              <TouchableOpacity style={[styles.confirmBtn, paying && { opacity: 0.5 }]} onPress={handlePayment} disabled={paying}>
                {paying ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.confirmBtnText}>Confirm Payment</Text>}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FL({ children }) { return <Text style={styles.fieldLabel}>{children}</Text>; }
function ActionBtn({ icon, label, color, onPress, loading }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} disabled={loading} activeOpacity={0.8}>
      <View style={[styles.actionIconBox, { backgroundColor: color + '20' }]}>
        {loading ? <ActivityIndicator size="small" color={color} /> : <Icon name={icon} size={20} color={color} />}
      </View>
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}


const styles = StyleSheet.create({
  // Layout
  container:  { flex: 1, backgroundColor: COLORS.bg },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:     { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  // Page header — white bar with title + action
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerLeft:  { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: FONTS.black, color: COLORS.text, letterSpacing: -0.3 },
  headerSub:   { fontSize: 12, color: COLORS.textMute, marginTop: 2 },
  headerBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: RADIUS.md, flexDirection: 'row',
    alignItems: 'center', gap: 6,
  },
  headerBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
  addBtn:      { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: RADIUS.md },
  addBtnText:  { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
  newBtn:      { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: RADIUS.md },
  newBtnText:  { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
  backBtn:     { marginRight: 12, padding: 4 },
  saveBtn:     { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: RADIUS.md },
  saveBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },

  // Metric strip — 3 KPIs in a white bar below header
  metricsBar:  { flexDirection: 'row', backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  statsStrip:  { flexDirection: 'row', backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  metricCell:  { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statChip:    { flex: 1, alignItems: 'center', paddingVertical: 12 },
  metricVal:   { fontSize: 16, fontWeight: FONTS.black },
  statValue:   { fontSize: 16, fontWeight: FONTS.black },
  metricLbl:   { fontSize: 10, color: COLORS.textMute, marginTop: 2, fontWeight: FONTS.medium, textTransform: 'uppercase', letterSpacing: 0.4 },
  statLabel:   { fontSize: 10, color: COLORS.textMute, marginTop: 2, fontWeight: FONTS.medium, textTransform: 'uppercase', letterSpacing: 0.4 },
  metricSep:   { width: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  div:         { width: 1, backgroundColor: COLORS.border, marginVertical: 10 },

  // Search bar
  searchWrap:  { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 0 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    margin: 16, marginBottom: 0,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.border,
    height: 44,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    margin: 16, marginBottom: 0,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.border,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 0 },
  clearBtn:    { padding: 4 },

  // Filter chips
  filterRow:       { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:            { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  chipOn:          { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  chipText:        { fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.medium },
  chipTextOn:      { color: '#fff', fontWeight: FONTS.bold },
  filterChip:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive:{ backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  filterText:      { fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.medium },
  filterTextActive:{ color: '#fff', fontWeight: FONTS.bold },
  catChip:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  catChipActive:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catChipText:     { fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.medium },
  catChipTextActive:{ color: '#fff', fontWeight: FONTS.bold },

  // List
  list: { padding: 16, paddingBottom: 100 },

  // Cards
  card: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  partyCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  itemCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  expCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  invoiceCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
    borderLeftWidth: 4,
  },
  cardMain:   { padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardBody:   { padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardRow:    { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardLeft:   { flex: 1, marginRight: 12 },
  cardRight:  { alignItems: 'flex-end', gap: 4 },
  cardInfo:   { flex: 1 },

  // Card content
  cardName:  { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 3 },
  itemName:  { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 3, flex: 1 },
  partyName: { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 3 },
  cardSub:   { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  itemSub:   { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  partySub:  { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  cardMeta:  { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  nameRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  subRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 4 },

  // Invoice specific
  invoiceNo:   { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 3 },
  invoiceDate: { fontSize: 12, color: COLORS.textMute },
  total:       { fontSize: 17, fontWeight: FONTS.black, color: COLORS.text },
  salePrice:   { fontSize: 16, fontWeight: FONTS.black, color: COLORS.text },
  purchasePrice:{ fontSize: 11, color: COLORS.textMute },
  party:       { fontSize: 13, color: COLORS.textSub, marginBottom: 4 },
  date:        { fontSize: 11, color: COLORS.textMute },
  due:         { fontSize: 11, color: COLORS.warning, fontWeight: FONTS.medium },
  dueRed:      { color: COLORS.danger },
  badge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm },
  badgeText:   { fontSize: 10, fontWeight: FONTS.bold, letterSpacing: 0.3 },
  bal:         { fontSize: 12, fontWeight: FONTS.bold },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm },
  statusText:  { fontSize: 10, fontWeight: FONTS.bold, letterSpacing: 0.3 },

  // Parties specific
  avatar:     { width: 44, height: 44, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 18, fontWeight: FONTS.black, color: '#fff' },
  typeBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm, backgroundColor: COLORS.primaryLight },
  typeBadgeSupplier: { backgroundColor: COLORS.infoLight },
  typeText:   { fontSize: 10, fontWeight: FONTS.bold, color: COLORS.primary },
  typeTextSupplier: { color: COLORS.info },
  balance:    { fontSize: 13, fontWeight: FONTS.heavy, color: COLORS.success },

  // Inventory specific
  lowBadge:   { backgroundColor: COLORS.dangerLight, paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.sm },
  lowText:    { fontSize: 10, fontWeight: FONTS.bold, color: COLORS.danger },
  stockRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12, gap: 10 },
  stockLabel: { fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.medium, flex: 1 },
  minStock:   { fontSize: 11, color: COLORS.textMute },
  stockValue: { fontSize: 12, fontWeight: FONTS.bold, color: COLORS.textSub },

  // Expenses specific
  expAmount:  { fontSize: 16, fontWeight: FONTS.black, color: COLORS.danger },
  expMeta:    { fontSize: 11, color: COLORS.textMute, marginTop: 3 },
  catIcon:    { width: 38, height: 38, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  catLabel:   { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 3 },

  // Action buttons on cards
  cardActions:{ flexDirection: 'row', gap: 6, marginTop: 6 },
  editBtn:    { padding: 7, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgDeep },
  delBtn:     { padding: 7, borderRadius: RADIUS.sm, backgroundColor: COLORS.dangerLight },

  // Modal — bottom sheet
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl,
    maxHeight: '92%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderDark, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle:  { fontSize: 18, fontWeight: FONTS.black, color: COLORS.text },
  modalBody:   { padding: 20 },
  modalSave: {
    backgroundColor: COLORS.primary, paddingVertical: 15,
    borderRadius: RADIUS.lg, alignItems: 'center',
    marginHorizontal: 20, marginBottom: 20, marginTop: 8,
  },
  modalSaveText: { color: '#fff', fontWeight: FONTS.black, fontSize: 15 },

  // Form fields
  fieldLabel: {
    fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textSub,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 7, marginTop: 18,
  },
  fieldInput: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: COLORS.text,
  },
  input: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: COLORS.text,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  row:      { flexDirection: 'row', gap: 12 },
  pickerRow:{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  pickerChip:       { paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg },
  pickerChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pickerChipText:   { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  pickerChipTextActive: { color: '#fff', fontWeight: FONTS.bold },
  stateArrow:  { fontSize: 14, color: COLORS.textMute },
  statePickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12,
  },
  statePickerText: { fontSize: 14, color: COLORS.text },

  // Reports
  presetRow:        { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', gap: 8, flexWrap: 'wrap', backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  presetChip:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  presetChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  presetText:       { fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.medium },
  presetTextActive: { color: '#fff', fontWeight: FONTS.bold },
  reportSection: { marginBottom: 20 },
  sectionHeading: { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10, marginTop: 4 },
  reportCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginBottom: 2 },
  reportRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  reportRowLast: { borderBottomWidth: 0 },
  reportLabel:{ fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  reportValue:{ fontSize: 14, fontWeight: FONTS.heavy, color: COLORS.text },
  plCard:     { backgroundColor: COLORS.secondary, borderRadius: RADIUS.xl, padding: 20, marginBottom: 16 },
  plTitle:    { fontSize: 11, fontWeight: FONTS.bold, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 14 },
  plRow:      { flexDirection: 'row' },
  plItem:     { flex: 1, alignItems: 'center' },
  plValue:    { fontSize: 16, fontWeight: FONTS.black, marginBottom: 4 },
  plLabel:    { fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  gstRow:     { flexDirection: 'row', gap: 10, marginBottom: 2 },
  gstBox:     { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 14, alignItems: 'center', borderTopWidth: 3, borderWidth: 1, borderColor: COLORS.border },
  gstVal:     { fontSize: 15, fontWeight: FONTS.black, marginBottom: 4 },
  gstLbl:     { fontSize: 10, color: COLORS.textMute, textAlign: 'center' },
  exportBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.secondary, paddingVertical: 14, borderRadius: RADIUS.lg, marginTop: 8 },
  exportBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },

  // Settings
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  sectionTitle: { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.7 },
  settingsCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, marginHorizontal: 16, marginBottom: 4, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  settingsRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  settingsRowLast: { borderBottomWidth: 0 },
  settingsRowLabel: { flex: 1, fontSize: 14, fontWeight: FONTS.medium, color: COLORS.text },
  settingsRowValue: { fontSize: 13, color: COLORS.textMute },
  settingsInput:    { flex: 1, fontSize: 14, color: COLORS.text, textAlign: 'right' },
  card:     { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, marginHorizontal: 16, marginBottom: 4, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', padding: 16 },
  infoRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoLabel:{ fontSize: 13, color: COLORS.textSub },
  infoValue:{ fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.text },
  dangerBtn:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.dangerLight, paddingVertical: 13, borderRadius: RADIUS.lg, marginHorizontal: 16, marginTop: 4 },
  dangerBtnText: { color: COLORS.danger, fontWeight: FONTS.bold, fontSize: 14 },
  infoBox:    { backgroundColor: COLORS.infoLight, borderRadius: RADIUS.md, padding: 12, marginTop: 8 },
  infoBoxText:{ fontSize: 12, color: COLORS.info, lineHeight: 18 },
  hintWarn:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.warningBg, borderRadius: RADIUS.sm, padding: 10, marginTop: 6 },
  hintWarnText:{ fontSize: 12, color: COLORS.warning, flex: 1 },
  hintOk:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.successBg, borderRadius: RADIUS.sm, padding: 10, marginTop: 6 },
  hintOkText: { fontSize: 12, color: COLORS.success, flex: 1 },
  upiOk:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  upiWarn:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  upiWarnText:{ fontSize: 12, color: COLORS.textMute },
  driveRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: COLORS.successBg, borderRadius: RADIUS.md, marginTop: 8 },
  driveEmail: { flex: 1, fontSize: 13, color: COLORS.success, fontWeight: FONTS.semibold },
  backupTime: { fontSize: 13, color: COLORS.textSub },
  backupBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: RADIUS.md, marginTop: 8 },
  backupBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
  restoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.card, paddingVertical: 12, borderRadius: RADIUS.md, marginTop: 6, borderWidth: 1, borderColor: COLORS.border },
  restoreBtnText: { fontWeight: FONTS.bold, fontSize: 13, color: COLORS.text },
  connectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.secondary, paddingVertical: 12, borderRadius: RADIUS.md, marginTop: 8 },
  connectBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.dangerLight, paddingVertical: 13, borderRadius: RADIUS.lg, marginHorizontal: 16, marginVertical: 8 },
  signOutText:{ color: COLORS.danger, fontWeight: FONTS.bold, fontSize: 14 },
  pickerArrow:{ fontSize: 14, color: COLORS.textMute },

  // State picker modal
  stateOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  stateSheet:   { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl, maxHeight: '75%' },
  stateHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stateTitle:   { fontSize: 17, fontWeight: FONTS.black, color: COLORS.text },
  stateSearchBox:{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stateSearchInput:{ backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: COLORS.text },
  stateItem:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stateName:    { fontSize: 14, color: COLORS.text, fontWeight: FONTS.medium },
  stateCode:    { fontSize: 12, color: COLORS.textMute, backgroundColor: COLORS.bgDeep, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm },
  stateClose:   { fontSize: 20, color: COLORS.textMute },

  // Party detail
  heroDetail:   { backgroundColor: COLORS.secondary, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  detailAvatar: { width: 56, height: 56, borderRadius: RADIUS.full, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  detailAvatarText: { fontSize: 24, fontWeight: FONTS.black, color: '#fff' },
  detailName:   { fontSize: 20, fontWeight: FONTS.black, color: '#fff', marginBottom: 4 },
  detailSub:    { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  kpiStrip:     { flexDirection: 'row', backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  kpiChip:      { flex: 1, alignItems: 'center', paddingVertical: 12 },
  kpiValue:     { fontSize: 15, fontWeight: FONTS.black, marginBottom: 2 },
  kpiLabel:     { fontSize: 10, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.4 },
  kpiDivider:   { width: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  invRow:       { backgroundColor: COLORS.card, marginHorizontal: 16, marginBottom: 10, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  invRowTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 14 },
  invNum:       { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 3 },
  invDate:      { fontSize: 11, color: COLORS.textMute },
  invTotal:     { fontSize: 16, fontWeight: FONTS.black, color: COLORS.text, marginBottom: 5 },
  balRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.dangerBg, borderTopWidth: 1, borderTopColor: COLORS.dangerLight },
  balLabel:     { fontSize: 11, color: COLORS.danger, fontWeight: FONTS.semibold },
  balValue:     { fontSize: 12, fontWeight: FONTS.heavy, color: COLORS.danger },

  // Empty state
  empty:        { alignItems: 'center', paddingTop: 70, paddingHorizontal: 32 },
  emptyIconWrap:{ width: 80, height: 80, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyIcon:    { fontSize: 36 },
  emptyTitle:   { fontSize: 18, fontWeight: FONTS.black, color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  emptySub:     { fontSize: 13, color: COLORS.textMute, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn:     { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.lg },
  emptyBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 14 },

  // Login
  loginContainer: { flex: 1, backgroundColor: '#F8FAFF', alignItems: 'center', justifyContent: 'center', padding: 24 },
  loginLogoWrap:  { alignItems: 'center', marginBottom: 40 },
  loginLogoBox:   { width: 160, height: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  loginLogoImg:   { width: 140, height: 50 },
  loginBrand:     { fontSize: 13, color: COLORS.textMute, letterSpacing: 1 },
  loginTagline:   { fontSize: 12, color: COLORS.textMute, marginTop: 2 },
  loginCard:      { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: 28, borderWidth: 1, borderColor: COLORS.border },
  loginTitle:     { fontSize: 22, fontWeight: FONTS.black, color: COLORS.text, marginBottom: 6 },
  loginSubtitle:  { fontSize: 13, color: COLORS.textMute, marginBottom: 24 },
  loginLabel:     { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7, marginTop: 16 },
  loginInput:     { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: COLORS.text },
  loginBtn:       { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  loginBtnText:   { color: '#fff', fontWeight: FONTS.black, fontSize: 15 },
  loginError:     { backgroundColor: COLORS.dangerLight, borderRadius: RADIUS.md, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  loginErrorText: { fontSize: 13, color: COLORS.danger, flex: 1 },
  loginFooter:    { fontSize: 12, color: COLORS.textMute, marginTop: 20, textAlign: 'center' },

  // Payment modal (InvoiceDetail)
  payInvInfo:    { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 14, marginBottom: 8 },
  payInvNum:     { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.primary, marginBottom: 3 },
  payInvParty:   { fontSize: 13, color: COLORS.text },
  payInvBalance: { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.danger, marginTop: 4 },
  methodRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  methodChip:    { paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.md, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  methodChipActive:{ backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  methodText:    { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  methodTextActive:{ color: COLORS.primary, fontWeight: FONTS.bold },
  confirmBtn:    { backgroundColor: COLORS.success, borderRadius: RADIUS.lg, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  confirmBtnText:{ color: '#fff', fontWeight: FONTS.black, fontSize: 15 },

  // Section title in screens
  sectionLabel:   { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.7, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  loadingText:    { fontSize: 14, color: COLORS.textMute, marginTop: 12 },
  notFound:       { fontSize: 15, color: COLORS.textMute },
  successBg:      '#F0FDF4',

  // Action bar
  actionBar:    { flexDirection: 'row', backgroundColor: COLORS.card, paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 4 },
  actionBtn:    { flex: 1, alignItems: 'center' },
  actionIconBox:{ width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  actionLabel:  { fontSize: 10, fontWeight: FONTS.semibold },
  // Balance banner
  balanceBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FEF3C7', marginHorizontal: 14, marginTop: 14, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: '#FDE68A' },
  balanceBannerLabel:  { fontSize: 11, color: '#92400E', fontWeight: FONTS.medium },
  balanceBannerAmt:    { fontSize: 22, fontWeight: FONTS.black, color: '#92400E' },
  balanceBannerBtn:    { backgroundColor: '#F59E0B', paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.md },
  balanceBannerBtnText:{ fontSize: 13, fontWeight: FONTS.bold, color: '#fff' },
  // Status
  statusPill:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, marginRight: 6 },
  statusPillText:{ fontSize: 10, fontWeight: FONTS.black, letterSpacing: 0.5 },
  deleteBtn:     { padding: 8 },
  // Template selector
  selectorSection: { backgroundColor: COLORS.card, marginTop: 14, marginHorizontal: 14, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  selectorTitle:   { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 },
  tplScroll:       { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  tplThumb:        { width: 100, backgroundColor: COLORS.bg, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, overflow: 'hidden' },
  thumbPreview:    { borderWidth: 0.5, borderColor: '#E5E7EB', backgroundColor: '#fff', margin: 6, borderRadius: RADIUS.sm, overflow: 'hidden', position: 'relative' },
  thumbHeader:     { flexDirection: 'row', justifyContent: 'space-between', padding: 5 },
  thumbMeta:       { flexDirection: 'row', borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#E5E7EB' },
  thumbMetaCell:   { flex: 1, padding: 3, borderRightWidth: 0.5, borderRightColor: '#E5E7EB' },
  thumbTH:         { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3, paddingVertical: 3 },
  thumbTR:         { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3, paddingVertical: 2 },
  thumbGrand:      { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 3, marginTop: 2 },
  thumbFooter:     { paddingHorizontal: 4, paddingVertical: 3 },
  thumbCheck:      { position: 'absolute', top: 3, left: 3, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  thumbThermal:    { position: 'absolute', top: 3, right: 3 },
  thumbLabel:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  thumbDot:        { width: 8, height: 8, borderRadius: 4 },
  thumbName:       { fontSize: 11, fontWeight: FONTS.semibold, color: COLORS.text, flex: 1 },
  tl:              { borderRadius: 1, backgroundColor: '#CBD5E1' },
  // Color picker
  colorSection:    { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  colorTitle:      { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.4, paddingTop: 10, marginBottom: 10 },
  colorRow:        { gap: 8 },
  colorItem:       { alignItems: 'center', gap: 3 },
  colorDot:        { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorName:       { fontSize: 9, color: COLORS.textMute },
  // Active template bar
  activeTemplateBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 14, marginBottom: 14, backgroundColor: COLORS.bg, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 10, borderLeftWidth: 3 },
  activeTemplateDot: { width: 8, height: 8, borderRadius: 4 },
  activeTemplateText:{ flex: 1, fontSize: 12, fontWeight: FONTS.semibold, color: COLORS.text },
  exportNowBtn:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.md, minWidth: 90, alignItems: 'center' },
  exportNowText:   { fontSize: 12, fontWeight: FONTS.bold, color: '#fff' },
  // WebView
  webViewWrap:     { marginHorizontal: 14, marginTop: 6, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff' },
  previewLabel:    { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: COLORS.bg, borderBottomWidth: 1, borderBottomColor: COLORS.border },

});