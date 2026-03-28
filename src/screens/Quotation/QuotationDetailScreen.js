import Icon from '../../utils/Icon';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform, Dimensions, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getQuotationDetail, updateQuotationStatus, deleteQuotation,
  convertQuotationToInvoice, getProfile,
} from '../../db';
import { formatINR } from '../../utils/gst';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';

const STATUS_CONFIG = {
  draft:     { label: 'Draft',     color: COLORS.textMute, bg: COLORS.bg,           icon: 'edit-3' },
  sent:      { label: 'Sent',      color: COLORS.info,     bg: COLORS.infoLight,    icon: 'send' },
  converted: { label: 'Converted', color: COLORS.success,  bg: COLORS.successLight, icon: 'check-circle' },
};

export default function QuotationDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { id } = route.params;
  const isDesktop = Platform.OS === 'web' && Dimensions.get('window').width >= 768;

  const [quotation, setQuotation] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);

  const load = async () => {
    try {
      const [q, p] = await Promise.all([
        getQuotationDetail(id),
        getProfile(),
      ]);
      setQuotation(q);
      setProfile(p);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load quotation');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [id]));

  const isExpired = () => {
    if (!quotation?.valid_until) return false;
    return new Date(quotation.valid_until) < new Date();
  };

  const handleMarkSent = async () => {
    try {
      await updateQuotationStatus(id, 'sent');
      setQuotation({ ...quotation, status: 'sent' });
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const handleConvertToInvoice = () => {
    Alert.alert(
      'Convert to Invoice',
      'This will create a new invoice from this quotation. The quotation will be marked as converted.\n\nStock will be deducted and party balance will be updated.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Convert',
          style: 'default',
          onPress: async () => {
            setConverting(true);
            try {
              const invoiceId = await convertQuotationToInvoice(id);
              Alert.alert(
                'Success',
                'Invoice created successfully!',
                [
                  {
                    text: 'View Invoice',
                    onPress: () => navigation.replace('InvoiceDetail', { id: invoiceId }),
                  },
                  {
                    text: 'Stay Here',
                    onPress: () => load(), // Reload to show converted status
                  },
                ]
              );
            } catch (e) {
              Alert.alert('Error', e.message);
            } finally {
              setConverting(false);
            }
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    if (quotation.status === 'converted') {
      Alert.alert('Cannot Edit', 'This quotation has already been converted to an invoice.');
      return;
    }
    navigation.navigate('CreateQuotation', { quotation });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Quotation',
      'Are you sure you want to delete this quotation? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteQuotation(id);
              navigation.goBack();
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const handleShare = async () => {
    try {
      const text = `Quotation ${quotation.quote_number}\n` +
        `Customer: ${quotation.party_name || 'N/A'}\n` +
        `Date: ${quotation.date}\n` +
        `Valid Until: ${quotation.valid_until || 'N/A'}\n` +
        `Total: ${formatINR(quotation.total)}\n\n` +
        `Items:\n` +
        quotation.items.map(i => `• ${i.name} - ${i.qty} ${i.unit} × ${formatINR(i.rate)} = ${formatINR(i.total)}`).join('\n');
      
      await Share.share({ message: text });
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!quotation) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Quotation not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status = STATUS_CONFIG[quotation.status] || STATUS_CONFIG.draft;
  const expired = quotation.status === 'draft' && isExpired();
  const canConvert = quotation.status !== 'converted';

  return (
    <View style={[styles.container, { paddingTop: isDesktop ? 0 : insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{quotation.quote_number}</Text>
          <View style={[styles.statusBadge, { backgroundColor: expired ? COLORS.warningLight : status.bg }]}>
            <Icon name={status.icon} size={12} color={expired ? COLORS.warning : status.color} />
            <Text style={[styles.statusText, { color: expired ? COLORS.warning : status.color }]}>
              {expired ? 'Expired' : status.label}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleShare} style={styles.iconBtn}>
          <Icon name="share-2" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}>
          <Icon name="trash-2" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Convert to Invoice Banner */}
        {canConvert && (
          <TouchableOpacity
            style={styles.convertBanner}
            onPress={handleConvertToInvoice}
            disabled={converting}
          >
            {converting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="repeat" size={20} color="#fff" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.convertTitle}>Convert to Invoice</Text>
                  <Text style={styles.convertSub}>Create invoice with one tap</Text>
                </View>
                <Icon name="chevron-right" size={20} color="rgba(255,255,255,0.7)" />
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Converted Notice */}
        {quotation.status === 'converted' && (
          <View style={styles.convertedNotice}>
            <Icon name="check-circle" size={20} color={COLORS.success} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.convertedTitle}>Converted to Invoice</Text>
              <Text style={styles.convertedSub}>This quotation has been converted</Text>
            </View>
            {quotation.converted_invoice_id && (
              <TouchableOpacity
                style={styles.viewInvoiceBtn}
                onPress={() => navigation.navigate('InvoiceDetail', { id: quotation.converted_invoice_id })}
              >
                <Text style={styles.viewInvoiceBtnText}>View Invoice</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Customer Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer</Text>
          {quotation.party_name ? (
            <>
              <Text style={styles.partyName}>{quotation.party_name}</Text>
              {quotation.party_gstin && (
                <Text style={styles.partyDetail}>GSTIN: {quotation.party_gstin}</Text>
              )}
              {quotation.party_address && (
                <Text style={styles.partyDetail}>{quotation.party_address}</Text>
              )}
              {quotation.party_state && (
                <Text style={styles.partyDetail}>{quotation.party_state}</Text>
              )}
            </>
          ) : (
            <Text style={styles.noParty}>No customer selected</Text>
          )}
        </View>

        {/* Dates */}
        <View style={styles.card}>
          <View style={styles.dateRow}>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>Quote Date</Text>
              <Text style={styles.dateValue}>{quotation.date}</Text>
            </View>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>Valid Until</Text>
              <Text style={[styles.dateValue, expired && { color: COLORS.warning }]}>
                {quotation.valid_until || '-'}
                {expired && ' (Expired)'}
              </Text>
            </View>
          </View>
        </View>

        {/* Items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Items ({quotation.items?.length || 0})</Text>
          {quotation.items?.map((item, idx) => (
            <View key={idx} style={styles.lineItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {item.qty} {item.unit} × {formatINR(item.rate)}
                  {item.discount > 0 ? ` (-${item.discount}%)` : ''}
                  {item.hsn ? ` · HSN: ${item.hsn}` : ''}
                </Text>
                <Text style={styles.itemTax}>
                  GST {item.gst_rate}%
                  {quotation.supply_type === 'intra'
                    ? ` (CGST: ${formatINR(item.cgst)} + SGST: ${formatINR(item.sgst)})`
                    : ` (IGST: ${formatINR(item.igst)})`
                  }
                </Text>
              </View>
              <Text style={styles.itemTotal}>{formatINR(item.total)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatINR(quotation.subtotal)}</Text>
          </View>
          {quotation.discount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount ({quotation.discount}%)</Text>
              <Text style={[styles.totalValue, { color: COLORS.danger }]}>
                -{formatINR(quotation.subtotal - quotation.taxable)}
              </Text>
            </View>
          )}
          {quotation.supply_type === 'intra' ? (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>CGST</Text>
                <Text style={styles.totalValue}>{formatINR(quotation.cgst)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>SGST</Text>
                <Text style={styles.totalValue}>{formatINR(quotation.sgst)}</Text>
              </View>
            </>
          ) : (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>IGST</Text>
              <Text style={styles.totalValue}>{formatINR(quotation.igst)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{formatINR(quotation.total)}</Text>
          </View>
        </View>

        {/* Notes & Terms */}
        {(quotation.notes || quotation.terms) && (
          <View style={styles.card}>
            {quotation.notes && (
              <>
                <Text style={styles.cardTitle}>Notes</Text>
                <Text style={styles.notesText}>{quotation.notes}</Text>
              </>
            )}
            {quotation.terms && (
              <>
                <Text style={[styles.cardTitle, quotation.notes && { marginTop: 16 }]}>Terms</Text>
                <Text style={styles.notesText}>{quotation.terms}</Text>
              </>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Actions */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        {quotation.status === 'draft' && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleMarkSent}>
            <Icon name="send" size={16} color={COLORS.primary} />
            <Text style={styles.secondaryBtnText}>Mark as Sent</Text>
          </TouchableOpacity>
        )}
        {canConvert && (
          <TouchableOpacity style={styles.editBtn} onPress={handleEdit}>
            <Icon name="edit-2" size={16} color={COLORS.text} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: FONTS.bold, color: COLORS.text },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm,
    alignSelf: 'flex-start', marginTop: 4,
  },
  statusText: { fontSize: 11, fontWeight: FONTS.bold, textTransform: 'uppercase' },
  iconBtn: { padding: 8 },

  scroll: { padding: 16 },

  convertBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    padding: 16, marginBottom: 12,
  },
  convertTitle: { fontSize: 15, fontWeight: FONTS.bold, color: '#fff' },
  convertSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  convertedNotice: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.successLight, borderRadius: RADIUS.lg,
    padding: 16, marginBottom: 12,
  },
  convertedTitle: { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.success },
  convertedSub: { fontSize: 12, color: COLORS.success, opacity: 0.8, marginTop: 2 },
  viewInvoiceBtn: {
    backgroundColor: COLORS.success, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  viewInvoiceBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 12 },

  card: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  cardTitle: { fontSize: 12, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase', marginBottom: 10 },

  partyName: { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 4 },
  partyDetail: { fontSize: 13, color: COLORS.textSub, marginTop: 2 },
  noParty: { fontSize: 14, color: COLORS.textMute, fontStyle: 'italic' },

  dateRow: { flexDirection: 'row' },
  dateItem: { flex: 1 },
  dateLabel: { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase', marginBottom: 4 },
  dateValue: { fontSize: 14, fontWeight: FONTS.medium, color: COLORS.text },

  lineItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  itemName: { fontSize: 14, fontWeight: FONTS.medium, color: COLORS.text },
  itemMeta: { fontSize: 12, color: COLORS.textSub, marginTop: 3 },
  itemTax: { fontSize: 11, color: COLORS.textMute, marginTop: 3 },
  itemTotal: { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text },

  totalsCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  totalLabel: { fontSize: 13, color: COLORS.textSub },
  totalValue: { fontSize: 13, fontWeight: FONTS.medium, color: COLORS.text },
  grandTotal: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 8, paddingTop: 12 },
  grandTotalLabel: { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text },
  grandTotalValue: { fontSize: 20, fontWeight: FONTS.black, color: COLORS.primary },

  notesText: { fontSize: 13, color: COLORS.textSub, lineHeight: 20 },

  bottomBar: {
    flexDirection: 'row', gap: 12,
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  secondaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primaryLight, paddingVertical: 14, borderRadius: RADIUS.md,
  },
  secondaryBtnText: { color: COLORS.primary, fontWeight: FONTS.bold, fontSize: 14 },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.bg, paddingVertical: 14, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  editBtnText: { color: COLORS.text, fontWeight: FONTS.bold, fontSize: 14 },

  errorText: { fontSize: 16, color: COLORS.textMute, marginBottom: 16 },
  backLink: { padding: 12 },
  backLinkText: { fontSize: 14, color: COLORS.primary, fontWeight: FONTS.bold },
});
