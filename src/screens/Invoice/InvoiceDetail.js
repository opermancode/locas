import Icon from '../../utils/Icon';
import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, TextInput, ActivityIndicator, Share,
  Dimensions, Platform,
} from 'react-native';

// ── WebView polyfill ─────────────────────────────────────────────
const WebView = Platform.OS === 'web'
  ? ({ source, style }) => {
      const iframeRef = React.useRef(null);
      const [h, setH] = React.useState(style?.height || 900);
      // Use blob URL instead of encodeURIComponent — avoids encoding 15KB HTML string on every render
      const blobUrl = React.useMemo(() => {
        if (!source?.html) return null;
        const blob = new Blob([source.html], { type: 'text/html;charset=utf-8' });
        return URL.createObjectURL(blob);
      }, [source?.html]);
      React.useEffect(() => {
        return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
      }, [blobUrl]);
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
      }, [blobUrl]);
      return React.createElement('iframe', {
        ref: iframeRef,
        src: blobUrl || source?.uri,
        style: { border: 'none', width: '100%', height: h, display: 'block' },
      });
    }
  : require('react-native-webview').WebView;

// ── Print / Sharing polyfills ────────────────────────────────────
const Print = Platform.OS === 'web'
  ? {
      printAsync: async ({ html, invoiceNumber, date }) => {
        const safeName = `Tax_Invoice_${(invoiceNumber || '').replace(/[^a-zA-Z0-9-_]/g, '_')}_${(date || '').replace(/-/g, '_')}.pdf`;

        // ── Electron: use native printToPDF via IPC ──────────────
        if (typeof window !== 'undefined' && window.electronAPI?.savePDF) {
          const result = await window.electronAPI.savePDF(html, safeName);
          if (!result.success && result.reason !== 'canceled') {
            alert('PDF save failed: ' + (result.reason || 'Unknown error'));
          }
          return;
        }

        // ── Browser fallback: open print dialog ──────────────────
        const htmlWithTitle = html.replace(
          '<head>',
          `<head><title>${safeName}</title><script>window.onload=function(){window.focus();window.print();window.onafterprint=function(){window.close();};};<\/script>`
        );
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) {
          // Popup blocked — hidden iframe fallback
          const iframe = document.createElement('iframe');
          iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;';
          document.body.appendChild(iframe);
          iframe.contentDocument.open();
          iframe.contentDocument.write(html);
          iframe.contentDocument.close();
          await new Promise(r => setTimeout(r, 800));
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          setTimeout(() => document.body.removeChild(iframe), 3000);
          return;
        }
        printWindow.document.open();
        printWindow.document.write(htmlWithTitle);
        printWindow.document.close();
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
        } catch (e) { alert('Failed to save. Use Print → Save as PDF.'); }
      },
    }
  : require('expo-sharing');

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getInvoiceDetail, recordPayment, deleteInvoice, getProfile } from '../../db';
import { formatINR, PAYMENT_METHODS, today } from '../../utils/gst';
import { TEMPLATES, buildHTML } from '../../utils/templates/index';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';

// ── Is wide? ─────────────────────────────────────────────────────
function useIsWide() {
  const [wide, setWide] = useState(
    Platform.OS === 'web' && Dimensions.get('window').width >= 900
  );
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const sub = Dimensions.addEventListener('change', ({ window }) =>
      setWide(window.width >= 900)
    );
    return () => sub?.remove();
  }, []);
  return wide;
}

// ── Draggable split divider ───────────────────────────────────────
// Returns leftFrac (0.25–0.75) and a ref to attach to the container div.
// The divider bar calls onDividerMouseDown to begin a drag.
function useDraggableSplit(initial = 0.5) {
  const [leftFrac, setLeftFrac] = useState(initial);
  const containerRef = useRef(null);

  const onDividerMouseDown = useCallback((e) => {
    if (Platform.OS !== 'web') return;
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = ev.clientX - rect.left;
      const frac = Math.min(0.72, Math.max(0.42, x / rect.width));
      setLeftFrac(frac);
    };
    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  return { leftFrac, containerRef, onDividerMouseDown };
}

// ── Constants ────────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════
export default function InvoiceDetail({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const isWide = useIsWide();
  const { leftFrac, containerRef, onDividerMouseDown } = useDraggableSplit(0.5);
  const { invoiceId } = route.params;

  const [invoice, setInvoice]         = useState(null);
  const [profile, setProfile]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [printing, setPrinting]       = useState(false);
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

  const balance    = invoice ? (invoice.total || 0) - (invoice.paid || 0) : 0;
  const invoiceHTML = useMemo(
    () => invoice && profile ? buildHTML(selectedTpl, invoice, profile, accentColor) : null,
    [invoice, profile, selectedTpl, accentColor]
  );

  const openPayModal = () => {
    setPayAmount(balance.toFixed(2));
    setPayMethod('Cash'); setPayRef('');
    setPayDate(today()); setPayNote('');
    setPayModal(true);
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
        await Print.printAsync({ html, invoiceNumber: invoice.invoice_number, date: invoice.date });
      } else {
        const { uri } = await require('expo-print').printToFileAsync({ html, base64: false });
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Invoice_${invoice.invoice_number}`,
          UTI: 'com.adobe.pdf',
        });
      }
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

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  if (!invoice) return <View style={s.center}><Text style={{ color: COLORS.textMute }}>Invoice not found</Text></View>;

  const statusKey   = getStatus();
  const statusStyle = STATUS_STYLE[statusKey] || STATUS_STYLE.unpaid;
  const activeTpl   = TEMPLATES.find(t => t.id === selectedTpl) || TEMPLATES[0];
  const isInter     = invoice.supply_type === 'inter';

  // ─────────────────────────────────────────────────────────────
  // LEFT PANEL — invoice data
  // ─────────────────────────────────────────────────────────────
  const LeftPanel = (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

      {/* Money strip */}
      <View style={s.moneyStrip}>
        <View style={s.moneyCell}>
          <Text style={s.moneyLbl}>Total</Text>
          <Text style={s.moneyVal}>{formatINR(invoice.total)}</Text>
        </View>
        <View style={s.moneySep} />
        <View style={s.moneyCell}>
          <Text style={s.moneyLbl}>Paid</Text>
          <Text style={[s.moneyVal, { color: COLORS.success }]}>{formatINR(invoice.paid || 0)}</Text>
        </View>
        <View style={s.moneySep} />
        <View style={s.moneyCell}>
          <Text style={s.moneyLbl}>Balance</Text>
          <Text style={[s.moneyVal, balance > 0 ? { color: COLORS.danger } : { color: COLORS.success }]}>
            {formatINR(balance)}
          </Text>
        </View>
      </View>

      {/* Pay banner */}
      {balance > 0.01 && (
        <TouchableOpacity style={s.payBanner} onPress={openPayModal} activeOpacity={0.85}>
          <View>
            <Text style={s.payBannerLbl}>Balance Due</Text>
            <Text style={s.payBannerAmt}>{formatINR(balance)}</Text>
          </View>
          <View style={s.payBannerBtn}>
            <Text style={s.payBannerBtnTxt}>Record Payment</Text>
            <Icon name="arrow-right" size={14} color="#fff" />
          </View>
        </TouchableOpacity>
      )}

      {/* Bill To */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Bill To</Text>
        <Text style={s.partyName}>{invoice.party_name || 'Walk-in Customer'}</Text>
        {invoice.party_gstin ? <Text style={s.partySub}>GSTIN: {invoice.party_gstin}</Text> : null}
        {invoice.party_address ? <Text style={s.partySub}>{invoice.party_address}</Text> : null}
        <View style={s.dateRow}>
          <View style={s.dateCell}>
            <Text style={s.dateLbl}>Invoice Date</Text>
            <Text style={s.dateVal}>{invoice.date}</Text>
          </View>
          {invoice.due_date ? (
            <View style={s.dateCell}>
              <Text style={s.dateLbl}>Due Date</Text>
              <Text style={[s.dateVal, statusKey === 'overdue' && { color: COLORS.danger }]}>
                {invoice.due_date}
              </Text>
            </View>
          ) : null}
          <View style={s.dateCell}>
            <Text style={s.dateLbl}>Supply</Text>
            <Text style={s.dateVal}>{isInter ? 'Inter-state' : 'Intra-state'}</Text>
          </View>
        </View>
      </View>

      {/* Items */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Items ({invoice.items?.length || 0})</Text>
        {(invoice.items || []).map((item, i) => (
          <View key={i} style={[s.itemRow, i < ((invoice.items?.length ?? 0) - 1) && s.itemRowBorder]}>
            <View style={[s.itemDot, { backgroundColor: accentColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.itemName}>{item.name}</Text>
              <Text style={s.itemMeta}>
                {item.qty} {item.unit} × {formatINR(item.rate)}
                {item.hsn ? ` · HSN ${item.hsn}` : ''}
                {` · GST ${item.gst_rate}%`}
              </Text>
              {item.discount > 0 && (
                <Text style={s.itemDiscount}>Discount: {formatINR(item.discount)}</Text>
              )}
            </View>
            <Text style={s.itemTotal}>{formatINR(item.total)}</Text>
          </View>
        ))}
      </View>

      {/* Tax summary */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Tax Summary</Text>
        <TaxRow label="Subtotal" value={formatINR(invoice.subtotal || invoice.taxable)} />
        {invoice.discount > 0 && (
          <TaxRow label="Discount" value={`−${formatINR(invoice.discount)}`} valueStyle={{ color: COLORS.success }} />
        )}
        <TaxRow label="Taxable Amount" value={formatINR(invoice.taxable)} />
        {isInter
          ? <TaxRow label="IGST" value={formatINR(invoice.igst)} />
          : <>
              <TaxRow label="CGST" value={formatINR(invoice.cgst)} />
              <TaxRow label="SGST" value={formatINR(invoice.sgst)} />
            </>
        }
        <View style={s.taxTotalRow}>
          <Text style={s.taxTotalLbl}>Invoice Total</Text>
          <Text style={s.taxTotalVal}>{formatINR(invoice.total)}</Text>
        </View>
      </View>

      {/* Payment history */}
      {(invoice.payments || []).length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Payment History ({invoice.payments.length})</Text>
          {invoice.payments.map((p, i) => (
            <View key={i} style={[s.payRow, i < invoice.payments.length - 1 && s.payRowBorder]}>
              <View style={s.payIcon}>
                <Icon name="check-circle" size={15} color={COLORS.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.payMethod}>{p.method}{p.reference ? ` · ${p.reference}` : ''}</Text>
                <Text style={s.payDate}>{p.date}{p.note ? ` · ${p.note}` : ''}</Text>
              </View>
              <Text style={s.payAmt}>{formatINR(p.amount)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Notes / Terms */}
      {(invoice.notes || invoice.terms) ? (
        <View style={s.card}>
          {invoice.notes ? (
            <>
              <Text style={s.cardTitle}>Notes</Text>
              <Text style={s.notesText}>{invoice.notes}</Text>
            </>
          ) : null}
          {invoice.terms ? (
            <>
              <Text style={[s.cardTitle, { marginTop: invoice.notes ? 12 : 0 }]}>Terms</Text>
              <Text style={s.notesText}>{invoice.terms}</Text>
            </>
          ) : null}
        </View>
      ) : null}

      {/* Mobile-only action buttons */}
      {!isWide && (
        <View style={s.mobileActions}>
          <TouchableOpacity
            style={[s.mobileActPrimary, { backgroundColor: accentColor }]}
            onPress={doPDF}
            disabled={printing}
          >
            {printing
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Icon name="download" size={15} color="#fff" /><Text style={s.mobileActPrimaryTxt}> Export PDF</Text></>
            }
          </TouchableOpacity>
          <TouchableOpacity style={s.mobileActSec} onPress={handleWhatsApp}>
            <Icon name="message-circle" size={15} color={COLORS.textSub} />
            <Text style={s.mobileActSecTxt}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.mobileActSec} onPress={doPDF}>
            <Icon name="printer" size={15} color={COLORS.textSub} />
            <Text style={s.mobileActSecTxt}>Print</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  // ─────────────────────────────────────────────────────────────
  // RIGHT PANEL — template picker + live preview
  // ─────────────────────────────────────────────────────────────
  const RightPanel = (
    <View style={s.rightOuter}>
      {/* Action row */}
      <View style={s.rightActions}>
        <TouchableOpacity
          style={[s.rightActPrimary, { backgroundColor: accentColor }]}
          onPress={doPDF}
          disabled={printing}
        >
          {printing
            ? <ActivityIndicator size="small" color="#fff" />
            : <><Icon name="download" size={14} color="#fff" /><Text style={s.rightActPrimaryTxt}> Export PDF</Text></>
          }
        </TouchableOpacity>
        <TouchableOpacity style={s.rightActSec} onPress={handleWhatsApp}>
          <Icon name="message-circle" size={14} color={COLORS.textSub} />
          <Text style={s.rightActSecTxt}>WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.rightActSec} onPress={doPDF}>
          <Icon name="printer" size={14} color={COLORS.textSub} />
          <Text style={s.rightActSecTxt}>Print</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

        {/* Template selector — clean text pills */}
        <Text style={s.rightSecTitle}>Template</Text>
        <View style={s.tplPillRow}>
          {TEMPLATES.map(tpl => {
            const isSel = selectedTpl === tpl.id;
            return (
              <TouchableOpacity
                key={tpl.id}
                style={[s.tplPill, isSel && { backgroundColor: accentColor, borderColor: accentColor }]}
                onPress={() => { setSelectedTpl(tpl.id); setAccentColor(tpl.accent); }}
                activeOpacity={0.8}
              >
                <Text style={[s.tplPillTxt, isSel && { color: '#fff' }]}>{tpl.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Color grid */}
        <Text style={s.rightSecTitle}>Color</Text>
        <View style={s.colorGrid}>
          {COLOR_PALETTE.map(c => (
            <TouchableOpacity key={c.hex} onPress={() => setAccentColor(c.hex)} style={s.colorItem}>
              <View style={[
                s.colorDot,
                { backgroundColor: c.hex },
                accentColor === c.hex && s.colorDotSel,
              ]}>
                {accentColor === c.hex && <Icon name="check" size={12} color="#fff" />}
              </View>
              <Text style={[s.colorName, accentColor === c.hex && { color: c.hex }]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Live preview — fills available space */}
        <Text style={s.rightSecTitle}>Preview</Text>
        {invoiceHTML && (
          <View style={s.previewWrap}>
            <WebView
              source={{ html: invoiceHTML }}
              style={{ width: '100%', height: 900 }}
              scrollEnabled
            />
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );

  // ─────────────────────────────────────────────────────────────
  // ROOT RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.headerTitle}>{invoice.invoice_number}</Text>
          <Text style={s.headerSub}>{invoice.date} · {invoice.party_name || 'Walk-in'}</Text>
        </View>
        <View style={[s.statusPill, { backgroundColor: statusStyle.bg }]}>
          <Text style={[s.statusPillTxt, { color: statusStyle.text }]}>
            {statusKey.toUpperCase()}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateInvoice', { invoice })}
          style={s.iconBtn}
        >
          <Icon name="edit-2" size={16} color={COLORS.textSub} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={[s.iconBtn, s.iconBtnDanger]}>
          <Icon name="trash-2" size={16} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      {/* Body */}
      {isWide ? (
        // ── Wide: left data panel + draggable divider + right preview panel
        Platform.OS === 'web'
          ? React.createElement('div', {
              ref: containerRef,
              style: {
                display: 'flex',
                flexDirection: 'row',
                flex: 1,
                overflow: 'hidden',
                height: '100%',
              },
            },
            // Left panel
            React.createElement('div', {
              style: {
                flex: `0 0 ${(leftFrac * 100).toFixed(2)}%`,
                overflow: 'auto',
                borderRight: 'none',
              },
            }, LeftPanel),

            // Draggable divider
            React.createElement('div', {
              onMouseDown: onDividerMouseDown,
              style: {
                width: 6,
                cursor: 'col-resize',
                background: 'transparent',
                position: 'relative',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
              },
            },
              // Visual line inside the handle
              React.createElement('div', {
                style: {
                  width: 2,
                  height: '100%',
                  background: COLORS.border,
                  borderRadius: 1,
                  pointerEvents: 'none',
                },
              }),
              // Grab handle dots
              React.createElement('div', {
                style: {
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  pointerEvents: 'none',
                },
              },
                ...[0,1,2].map(i =>
                  React.createElement('div', {
                    key: i,
                    style: {
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      background: COLORS.borderDark,
                    },
                  })
                )
              )
            ),

            // Right panel
            React.createElement('div', {
              style: {
                flex: `0 0 ${((1 - leftFrac) * 100).toFixed(2)}%`,
                overflow: 'auto',
                background: COLORS.card,
                borderLeft: `1px solid ${COLORS.border}`,
              },
            }, RightPanel)
          )
          // Native wide (iPad etc) — no drag, fixed 50/50
          : (
            <View style={s.wideBody}>
              <View style={s.leftHalf}>{LeftPanel}</View>
              <View style={s.dividerNative} />
              <View style={s.rightHalf}>{RightPanel}</View>
            </View>
          )
      ) : (
        // ── Narrow: stacked
        LeftPanel
      )}

      {/* Payment Modal */}
      <Modal visible={payModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Record Payment</Text>
              <TouchableOpacity onPress={() => setPayModal(false)} style={{ padding: 4 }}>
                <Icon name="x" size={18} color={COLORS.textMute} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              <View style={s.payInvInfo}>
                <Text style={s.payInvNum}>{invoice.invoice_number}</Text>
                <Text style={s.payInvParty}>{invoice.party_name || 'Walk-in'}</Text>
                <Text style={s.payInvBal}>Balance due: {formatINR(balance)}</Text>
              </View>
              <FL>Amount (₹)*</FL>
              <TextInput style={s.input} value={payAmount} onChangeText={setPayAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={COLORS.textMute} />
              <FL>Date</FL>
              <TextInput style={s.input} value={payDate} onChangeText={setPayDate} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMute} />
              <FL>Payment Method</FL>
              <View style={s.methodRow}>
                {PAYMENT_METHODS.map(m => (
                  <TouchableOpacity key={m} style={[s.methodChip, payMethod===m && s.methodChipActive]} onPress={() => setPayMethod(m)}>
                    <Text style={[s.methodTxt, payMethod===m && s.methodTxtActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <FL>Reference (optional)</FL>
              <TextInput style={s.input} value={payRef} onChangeText={setPayRef} placeholder="UTR / Cheque No." placeholderTextColor={COLORS.textMute} />
              <FL>Note (optional)</FL>
              <TextInput style={s.input} value={payNote} onChangeText={setPayNote} placeholder="Any note..." placeholderTextColor={COLORS.textMute} />
              <TouchableOpacity style={[s.confirmBtn, paying && { opacity: 0.5 }]} onPress={handlePayment} disabled={paying}>
                {paying ? <ActivityIndicator color={COLORS.white} /> : <Text style={s.confirmBtnTxt}>Confirm Payment</Text>}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Small helpers ────────────────────────────────────────────────
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

function TaxRow({ label, value, valueStyle }) {
  return (
    <View style={s.taxRow}>
      <Text style={s.taxLbl}>{label}</Text>
      <Text style={[s.taxVal, valueStyle]}>{value}</Text>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn:       { padding: 4, marginRight: 2 },
  headerTitle:   { fontSize: 17, fontWeight: FONTS.black, color: COLORS.text },
  headerSub:     { fontSize: 12, color: COLORS.textMute, marginTop: 1 },
  statusPill:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, marginRight: 8 },
  statusPillTxt: { fontSize: 10, fontWeight: FONTS.black, letterSpacing: 0.5 },
  iconBtn:       { padding: 8, borderRadius: RADIUS.sm, backgroundColor: COLORS.bg, marginLeft: 6 },
  iconBtnDanger: { backgroundColor: COLORS.dangerLight },

  // Wide layout (native fallback)
  wideBody:    { flex: 1, flexDirection: 'row' },
  leftHalf:    { flex: 1 },
  dividerNative:{ width: 1, backgroundColor: COLORS.border },
  rightHalf:   { flex: 1, backgroundColor: COLORS.card },

  // Money strip
  moneyStrip: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  moneyCell: { flex: 1, alignItems: 'center', paddingVertical: 14, minWidth: 0 },
  moneySep:  { width: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  moneyLbl:  { fontSize: 10, fontWeight: FONTS.medium, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  moneyVal:  { fontSize: 15, fontWeight: FONTS.black, color: COLORS.text, numberOfLines: 1 },

  // Pay banner
  payBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FEF3C7', margin: 12, marginBottom: 0,
    borderRadius: RADIUS.lg, padding: 12,
    borderWidth: 1, borderColor: '#FDE68A',
    flexWrap: 'nowrap',
  },
  payBannerLbl:    { fontSize: 10, color: '#92400E', fontWeight: FONTS.medium },
  payBannerAmt:    { fontSize: 16, fontWeight: FONTS.black, color: '#92400E' },
  payBannerBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F59E0B', paddingHorizontal: 10, paddingVertical: 8, borderRadius: RADIUS.md, flexShrink: 0 },
  payBannerBtnTxt: { fontSize: 12, fontWeight: FONTS.bold, color: '#fff' },

  // Cards
  card: {
    backgroundColor: COLORS.card, margin: 12, marginBottom: 0,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: 14,
  },
  cardTitle: {
    fontSize: 10, fontWeight: FONTS.bold, color: COLORS.textMute,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10,
  },

  // Bill To
  partyName: { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 3 },
  partySub:  { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  dateRow:   { flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  dateCell:  { flex: 1 },
  dateLbl:   { fontSize: 10, fontWeight: FONTS.medium, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  dateVal:   { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.text },

  // Items
  itemRow:       { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 9, gap: 10 },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemDot:       { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  itemName:      { fontSize: 14, fontWeight: FONTS.semibold, color: COLORS.text },
  itemMeta:      { fontSize: 11, color: COLORS.textSub, marginTop: 2 },
  itemDiscount:  { fontSize: 11, color: COLORS.success, marginTop: 1 },
  itemTotal:     { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text, flexShrink: 0 },

  // Tax
  taxRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  taxLbl:     { fontSize: 13, color: COLORS.textSub },
  taxVal:     { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.text },
  taxTotalRow:{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, marginTop: 4, borderTopWidth: 2, borderTopColor: COLORS.border },
  taxTotalLbl:{ fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text },
  taxTotalVal:{ fontSize: 19, fontWeight: FONTS.black, color: COLORS.text },

  // Payment history
  payRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  payRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  payIcon:      { width: 30, height: 30, borderRadius: RADIUS.sm, backgroundColor: COLORS.successBg, alignItems: 'center', justifyContent: 'center' },
  payMethod:    { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.text },
  payDate:      { fontSize: 11, color: COLORS.textSub, marginTop: 1 },
  payAmt:       { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.success },

  notesText: { fontSize: 13, color: COLORS.textSub, lineHeight: 20 },

  // Mobile actions
  mobileActions:    { flexDirection: 'row', gap: 10, margin: 12, marginBottom: 0 },
  mobileActPrimary: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: RADIUS.md },
  mobileActPrimaryTxt: { fontSize: 13, fontWeight: FONTS.bold, color: '#fff' },
  mobileActSec:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  mobileActSecTxt:  { fontSize: 12, fontWeight: FONTS.semibold, color: COLORS.textSub },

  // Right panel
  rightOuter:         { flex: 1, padding: 14 },
  rightActions:       { flexDirection: 'row', gap: 8, marginBottom: 4 },
  rightActPrimary:    { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: RADIUS.md },
  rightActPrimaryTxt: { fontSize: 13, fontWeight: FONTS.bold, color: '#fff' },
  rightActSec:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  rightActSecTxt:     { fontSize: 12, fontWeight: FONTS.semibold, color: COLORS.textSub },
  rightSecTitle:      { fontSize: 10, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10, marginTop: 16 },

  // Templates
  tplPillRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 4 },
  tplPill:      { paddingHorizontal: 13, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.card },
  tplPillTxt:   { fontSize: 12, fontWeight: FONTS.semibold, color: COLORS.textSub },
  tl:           { borderRadius: 1, backgroundColor: '#CBD5E1' },

  // Colors
  colorGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  colorItem:    { alignItems: 'center', gap: 3, width: 44 },
  colorDot:     { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorDotSel:  { borderColor: COLORS.text, transform: [{ scale: 1.12 }] },
  colorName:    { fontSize: 9, color: COLORS.textMute, textAlign: 'center' },

  // Preview
  previewWrap: { borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff' },

  // Payment modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl, maxHeight: '92%' },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderDark, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle:   { fontSize: 18, fontWeight: FONTS.black, color: COLORS.text },
  input:        { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.text },
  methodRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  methodChip:   { paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.md, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  methodChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  methodTxt:    { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  methodTxtActive:  { color: COLORS.primary, fontWeight: FONTS.bold },
  confirmBtn:   { backgroundColor: COLORS.success, borderRadius: RADIUS.lg, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  confirmBtnTxt:{ color: '#fff', fontWeight: FONTS.black, fontSize: 15 },
  payInvInfo:   { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 14, marginBottom: 8 },
  payInvNum:    { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.primary, marginBottom: 3 },
  payInvParty:  { fontSize: 13, color: COLORS.text },
  payInvBal:    { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.danger, marginTop: 4 },
});