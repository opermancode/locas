import { Feather } from '@expo/vector-icons';
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
          <Feather name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle}>{invoice.invoice_number}</Text>
          <Text style={styles.headerSub}>{invoice.date} · {invoice.party_name || 'Walk-in'}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusPillText, { color: statusStyle.text }]}>{statusKey.toUpperCase()}</Text>
        </View>
        <TouchableOpacity onPress={handleEdit} style={styles.editBtn}>
          <Feather name="edit-2" size={16} color={COLORS.textSub} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <Feather name="trash-2" size={16} color={COLORS.danger} />
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
              <><Text style={styles.balanceBannerBtnText}>Record Payment</Text><Feather name="arrow-right" size={13} color={COLORS.white} /></>
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
                        <Feather name="check" size={14} color={COLORS.white} />
                      </View>
                    )}
                    {tpl.id === 't5' && (
                      <View style={styles.thumbThermal}>
                        <Feather name="printer" size={20} color={COLORS.textSub} />
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
                    {accentColor === c.hex && <Feather name="check" size={14} color="#fff" />}
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
              <TouchableOpacity onPress={() => setPayModal(false)} style={{padding:4}}><Feather name="x" size={18} color={COLORS.textMute} /></TouchableOpacity>
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
        {loading ? <ActivityIndicator size="small" color={color} /> : <Feather name={icon} size={20} color={color} />}
      </View>
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.bg },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound:   { fontSize: 16, color: COLORS.textMute },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn:      { padding: 4 },
  backIcon:     { fontSize: 22, color: COLORS.primary },
  headerTitle:  { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text },
  headerSub:    { fontSize: 11, color: COLORS.textSub, marginTop: 1 },
  statusPill:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, marginRight: 6 },
  statusPillText:{ fontSize: 10, fontWeight: FONTS.heavy, letterSpacing: 0.5 },
  editBtn:      { padding: 8 },
  editIcon:     { fontSize: 20 },
  deleteBtn:    { padding: 8 },
  deleteIcon:   { fontSize: 20 },

  actionBar: { flexDirection: 'row', backgroundColor: COLORS.card, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 4 },
  actionBtn:    { flex: 1, alignItems: 'center' },
  actionIconBox:{ width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  actionIcon:   { fontSize: 20 },
  actionLabel:  { fontSize: 10, fontWeight: FONTS.semibold },

  balanceBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FEF3C7', marginHorizontal: 12, marginTop: 12, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: '#FDE68A' },
  balanceBannerLabel: { fontSize: 11, color: '#92400E', fontWeight: FONTS.medium },
  balanceBannerAmt:   { fontSize: 20, fontWeight: FONTS.heavy, color: '#92400E' },
  balanceBannerBtn:   { backgroundColor: '#F59E0B', paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md },
  balanceBannerBtnText:{ fontSize: 13, fontWeight: FONTS.bold, color: COLORS.white },

  // ── Template selector ──────────────────────────────────────────
  selectorSection: { backgroundColor: COLORS.card, marginTop: 12, marginHorizontal: 12, borderRadius: RADIUS.lg, ...SHADOW.sm, overflow: 'hidden' },
  selectorTitle:   { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10 },

  tplScroll: { paddingHorizontal: 14, paddingBottom: 12, gap: 10 },

  tplThumb: { width: 100, backgroundColor: COLORS.bg, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, overflow: 'hidden', ...SHADOW.sm },

  thumbPreview: { borderWidth: 0.5, borderColor: '#E5E7EB', backgroundColor: '#fff', margin: 6, borderRadius: RADIUS.sm, overflow: 'hidden', position: 'relative' },
  thumbHeader:  { flexDirection: 'row', justifyContent: 'space-between', padding: 5 },
  thumbMeta:    { flexDirection: 'row', borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#E5E7EB' },
  thumbMetaCell:{ flex: 1, padding: 3, borderRightWidth: 0.5, borderRightColor: '#E5E7EB' },
  thumbTH:      { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3, paddingVertical: 3 },
  thumbTR:      { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3, paddingVertical: 2 },
  thumbGrand:   { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 3, marginTop: 2 },
  thumbFooter:  { paddingHorizontal: 4, paddingVertical: 3 },

  thumbCheck: { position: 'absolute', top: 3, left: 3, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  thumbCheckText: { color: '#fff', fontSize: 9, fontWeight: FONTS.heavy },
  thumbThermal: { position: 'absolute', top: 3, right: 3 },
  thumbThermalText: { fontSize: 10 },

  thumbLabel: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 7, borderTopWidth: 1, borderTopColor: COLORS.border },
  thumbDot:   { width: 8, height: 8, borderRadius: 4 },
  thumbName:  { fontSize: 11, fontWeight: FONTS.semibold, color: COLORS.text, flex: 1 },

  tl: { borderRadius: 1, backgroundColor: '#CBD5E1' },

  // Color picker
  colorSection: { paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  colorTitle:   { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.4, paddingTop: 10, marginBottom: 10 },
  colorRow:     { gap: 8 },
  colorItem:    { alignItems: 'center', gap: 3 },
  colorDot:     { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorCheck:   { color: '#fff', fontSize: 12, fontWeight: FONTS.heavy },
  colorName:    { fontSize: 8, color: COLORS.textMute },

  // Active template bar
  activeTemplateBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 14, marginBottom: 12, backgroundColor: COLORS.bg, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 10, borderLeftWidth: 3 },
  activeTemplateDot:  { width: 8, height: 8, borderRadius: 4 },
  activeTemplateText: { flex: 1, fontSize: 12, fontWeight: FONTS.semibold, color: COLORS.text },
  exportNowBtn:  { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.md, minWidth: 90, alignItems: 'center' },
  exportNowText: { fontSize: 12, fontWeight: FONTS.bold, color: '#fff' },

  // WebView
  webViewWrap: { marginHorizontal: 12, marginTop: 4, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW.md, backgroundColor: '#fff' },
  previewLabel:{ fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.bg, borderBottomWidth: 1, borderBottomColor: COLORS.border },

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