import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, StatusBar, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getProfile, saveProfile } from '../../db/db';
import { INDIAN_STATES } from '../../utils/gst';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [form, setForm]     = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty]   = useState(false);
  const [stateModal, setStateModal]   = useState(false);
  const [stateSearch, setStateSearch] = useState('');

  const load = async () => {
    try {
      const p = await getProfile();
      setForm({ ...p });
      setDirty(false);
    } catch (e) {
      console.error(e);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) { Alert.alert('Error', 'Business name is required'); return; }
    setSaving(true);
    try {
      await saveProfile(form);
      setDirty(false);
      Alert.alert('✅ Saved', 'Business profile updated successfully');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const selectState = (s) => {
    set('state', s.name);
    set('state_code', s.code);
    setStateModal(false);
    setStateSearch('');
  };

  const filteredStates = INDIAN_STATES.filter(s =>
    s.name.toLowerCase().includes(stateSearch.toLowerCase()) ||
    s.code.includes(stateSearch)
  );

  if (!form) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity
          style={[styles.saveBtn, (!dirty || saving) && { opacity: 0.4 }]}
          onPress={handleSave}
          disabled={!dirty || saving}
        >
          {saving
            ? <ActivityIndicator size="small" color={COLORS.white} />
            : <Text style={styles.saveBtnText}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >

        {/* Business Info */}
        <SectionHeader icon="🏢" title="Business Details" />
        <View style={styles.card}>
          <Field label="Business Name *">
            <TextInput
              style={styles.input}
              value={form.name || ''}
              onChangeText={v => set('name', v)}
              placeholder="Your business name"
              placeholderTextColor={COLORS.textMute}
            />
          </Field>

          <Field label="Address">
            <TextInput
              style={[styles.input, styles.textarea]}
              value={form.address || ''}
              onChangeText={v => set('address', v)}
              placeholder="Full business address"
              placeholderTextColor={COLORS.textMute}
              multiline
              numberOfLines={3}
            />
          </Field>

          <Row>
            <Field label="Phone" flex={1}>
              <TextInput
                style={styles.input}
                value={form.phone || ''}
                onChangeText={v => set('phone', v)}
                placeholder="Mobile / landline"
                placeholderTextColor={COLORS.textMute}
                keyboardType="phone-pad"
              />
            </Field>
            <View style={{ width: 12 }} />
            <Field label="Email" flex={1}>
              <TextInput
                style={styles.input}
                value={form.email || ''}
                onChangeText={v => set('email', v)}
                placeholder="email@business.com"
                placeholderTextColor={COLORS.textMute}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </Field>
          </Row>

          <Field label="State">
            <TouchableOpacity
              style={[styles.input, styles.picker]}
              onPress={() => { setStateSearch(''); setStateModal(true); }}
            >
              <Text style={form.state ? styles.pickerText : styles.pickerPlaceholder}>
                {form.state ? `${form.state} (${form.state_code})` : 'Select state...'}
              </Text>
              <Text style={styles.pickerArrow}>▾</Text>
            </TouchableOpacity>
          </Field>
        </View>

        {/* Tax Info */}
        <SectionHeader icon="🏛️" title="GST & Tax" />
        <View style={styles.card}>
          <Field label="GSTIN">
            <TextInput
              style={styles.input}
              value={form.gstin || ''}
              onChangeText={v => set('gstin', v.toUpperCase())}
              placeholder="22AAAAA0000A1Z5"
              placeholderTextColor={COLORS.textMute}
              autoCapitalize="characters"
              maxLength={15}
            />
          </Field>

          <Row>
            <Field label="PAN" flex={1}>
              <TextInput
                style={styles.input}
                value={form.pan || ''}
                onChangeText={v => set('pan', v.toUpperCase())}
                placeholder="AAAAA0000A"
                placeholderTextColor={COLORS.textMute}
                autoCapitalize="characters"
                maxLength={10}
              />
            </Field>
            <View style={{ width: 12 }} />
            <Field label="State Code" flex={1}>
              <TextInput
                style={[styles.input, { backgroundColor: COLORS.bg }]}
                value={form.state_code || ''}
                editable={false}
                placeholder="Auto from state"
                placeholderTextColor={COLORS.textMute}
              />
            </Field>
          </Row>

          {/* GSTIN validator hint */}
          {form.gstin?.length > 0 && form.gstin.length !== 15 && (
            <View style={styles.hintBox}>
              <Text style={styles.hintText}>⚠️ GSTIN must be exactly 15 characters ({form.gstin.length}/15)</Text>
            </View>
          )}
          {form.gstin?.length === 15 && (
            <View style={[styles.hintBox, styles.hintSuccess]}>
              <Text style={[styles.hintText, { color: COLORS.success }]}>✅ GSTIN format looks good</Text>
            </View>
          )}
        </View>

        {/* Invoice Settings */}
        <SectionHeader icon="🧾" title="Invoice Settings" />
        <View style={styles.card}>
          <Field label="Invoice Prefix">
            <TextInput
              style={styles.input}
              value={form.invoice_prefix || 'INV'}
              onChangeText={v => set('invoice_prefix', v.toUpperCase())}
              placeholder="INV"
              placeholderTextColor={COLORS.textMute}
              autoCapitalize="characters"
              maxLength={6}
            />
          </Field>
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>Next invoice will look like</Text>
            <Text style={styles.previewValue}>
              {form.invoice_prefix || 'INV'}-0001, {form.invoice_prefix || 'INV'}-0002…
            </Text>
          </View>
        </View>

        {/* Bank Details */}
        <SectionHeader icon="🏦" title="Bank Details" />
        <View style={styles.card}>
          <Field label="Bank Name">
            <TextInput
              style={styles.input}
              value={form.bank_name || ''}
              onChangeText={v => set('bank_name', v)}
              placeholder="e.g. State Bank of India"
              placeholderTextColor={COLORS.textMute}
            />
          </Field>

          <Row>
            <Field label="Account Number" flex={1}>
              <TextInput
                style={styles.input}
                value={form.account_no || ''}
                onChangeText={v => set('account_no', v)}
                placeholder="Account number"
                placeholderTextColor={COLORS.textMute}
                keyboardType="numeric"
              />
            </Field>
            <View style={{ width: 12 }} />
            <Field label="IFSC Code" flex={1}>
              <TextInput
                style={styles.input}
                value={form.ifsc || ''}
                onChangeText={v => set('ifsc', v.toUpperCase())}
                placeholder="SBIN0001234"
                placeholderTextColor={COLORS.textMute}
                autoCapitalize="characters"
                maxLength={11}
              />
            </Field>
          </Row>

          <View style={styles.bankNote}>
            <Text style={styles.bankNoteText}>
              💡 Bank details appear on PDF invoices for customer payments
            </Text>
          </View>
        </View>

        {/* App Info */}
        <SectionHeader icon="ℹ️" title="About" />
        <View style={styles.card}>
          <InfoRow label="App"        value="Locas" />
          <InfoRow label="Version"    value="1.0.0" />
          <InfoRow label="GST"        value="CGST / SGST / IGST supported" />
          <InfoRow label="Storage"    value="Local SQLite (offline-first)" />
          <InfoRow label="PDF"        value="expo-print + expo-sharing" />
        </View>

        {/* Danger zone */}
        <SectionHeader icon="⚠️" title="Data" />
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.dangerRow}
            onPress={() => Alert.alert(
              'About Your Data',
              'All data is stored locally on your device in a SQLite database. No cloud sync. Uninstalling the app will delete all data.',
              [{ text: 'OK' }]
            )}
          >
            <Text style={styles.dangerLabel}>📱 Data Storage Info</Text>
            <Text style={styles.dangerArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Save button at bottom */}
        {dirty && (
          <TouchableOpacity
            style={[styles.bottomSaveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={styles.bottomSaveBtnText}>💾 Save Changes</Text>
            }
          </TouchableOpacity>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── State Picker Modal ─────────────────────────────── */}
      {stateModal && (
        <View style={styles.stateOverlay}>
          <View style={styles.stateSheet}>
            <View style={styles.stateHeader}>
              <Text style={styles.stateTitle}>Select State</Text>
              <TouchableOpacity onPress={() => setStateModal(false)}>
                <Text style={styles.stateClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.stateSearchBox}>
              <TextInput
                style={styles.stateSearchInput}
                value={stateSearch}
                onChangeText={setStateSearch}
                placeholder="Search state..."
                placeholderTextColor={COLORS.textMute}
                autoFocus
              />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {filteredStates.map(s => (
                <TouchableOpacity
                  key={s.code}
                  style={styles.stateItem}
                  onPress={() => selectState(s)}
                >
                  <Text style={styles.stateName}>{s.name}</Text>
                  <Text style={styles.stateCode}>{s.code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────

function SectionHeader({ icon, title }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionIcon}>{icon}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Field({ label, children, flex, style }) {
  return (
    <View style={[{ flex }, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Row({ children }) {
  return <View style={styles.row}>{children}</View>;
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:    { padding: 16 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn:     { padding: 4 },
  backIcon:    { fontSize: 22, color: COLORS.primary },
  headerTitle: { fontSize: 20, fontWeight: FONTS.heavy, color: COLORS.text },
  saveBtn:     { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.md },
  saveBtnText: { color: COLORS.white, fontWeight: FONTS.bold, fontSize: 14 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 16, marginBottom: 8,
  },
  sectionIcon:  { fontSize: 18 },
  sectionTitle: { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.5 },

  card: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: 14, marginBottom: 4, ...SHADOW.sm,
  },

  fieldLabel: {
    fontSize: 12, fontWeight: FONTS.semibold, color: COLORS.textSub,
    marginBottom: 6, marginTop: 12,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  input: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: COLORS.text,
  },
  textarea:    { minHeight: 72, textAlignVertical: 'top' },
  row:         { flexDirection: 'row', alignItems: 'flex-start' },

  picker:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerText:  { fontSize: 14, color: COLORS.text },
  pickerPlaceholder: { fontSize: 14, color: COLORS.textMute },
  pickerArrow: { fontSize: 14, color: COLORS.textMute },

  hintBox: {
    backgroundColor: '#FEF3C7', borderRadius: RADIUS.sm,
    padding: 10, marginTop: 8,
  },
  hintSuccess: { backgroundColor: '#D1FAE5' },
  hintText:    { fontSize: 12, color: '#92400E' },

  previewBox: {
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm,
    padding: 12, marginTop: 10,
  },
  previewLabel: { fontSize: 11, color: COLORS.primary, fontWeight: FONTS.semibold, marginBottom: 4 },
  previewValue: { fontSize: 15, color: COLORS.primary, fontWeight: FONTS.bold },

  bankNote: {
    backgroundColor: '#EFF6FF', borderRadius: RADIUS.sm,
    padding: 10, marginTop: 12,
  },
  bankNoteText: { fontSize: 12, color: '#1D4ED8', lineHeight: 18 },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  infoLabel: { fontSize: 14, color: COLORS.textSub, fontWeight: FONTS.medium },
  infoValue: { fontSize: 14, color: COLORS.text, fontWeight: FONTS.semibold, textAlign: 'right', flex: 1, marginLeft: 16 },

  dangerRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 12,
  },
  dangerLabel: { fontSize: 14, color: COLORS.text, fontWeight: FONTS.medium },
  dangerArrow: { fontSize: 16, color: COLORS.textMute },

  bottomSaveBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    paddingVertical: 15, alignItems: 'center',
    marginTop: 8, ...SHADOW.md,
    shadowColor: COLORS.primary, shadowOpacity: 0.35,
  },
  bottomSaveBtnText: { color: COLORS.white, fontWeight: FONTS.heavy, fontSize: 16 },

  // State modal
  stateOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  stateSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    maxHeight: '75%',
  },
  stateHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  stateTitle:     { fontSize: 17, fontWeight: FONTS.bold, color: COLORS.text },
  stateClose:     { fontSize: 20, color: COLORS.textMute, padding: 4 },
  stateSearchBox: { padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stateSearchInput: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 14, color: COLORS.text,
  },
  stateItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  stateName: { fontSize: 15, color: COLORS.text, fontWeight: FONTS.medium },
  stateCode: { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.bold },
});