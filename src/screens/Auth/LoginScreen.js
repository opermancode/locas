import Icon from '../../utils/Icon';
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image, StatusBar,
} from 'react-native';
import { signIn } from '../../utils/firebase/firebaseAuth';
import { COLORS, RADIUS, FONTS, SHADOW } from '../../theme';

const BRAND = '#FF6B00';
const DARK  = '#1A1A2E';

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signIn(email.trim().toLowerCase(), password);
      // Auth state change in App.js will handle navigation automatically
    } catch (e) {
      switch (e.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError('Invalid email or password');
          break;
        case 'auth/user-disabled':
          setError('Your account has been disabled. Contact support.');
          break;
        case 'auth/too-many-requests':
          setError('Too many attempts. Please try again later.');
          break;
        case 'auth/network-request-failed':
          setError('No internet connection. Please check your network.');
          break;
        default:
          setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F4" />

      {/* Logo */}
      <View style={styles.logoWrap}>
        <View style={styles.logoBox}>
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.logoImg}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.brandName}>LOCAS</Text>
        <Text style={styles.brandSub}>Smart Billing for India</Text>
      </View>

      {/* Card */}
      <View style={styles.card}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        {error ? (
          <View style={styles.errorBox}>
            <View style={{flexDirection:"row",alignItems:"center",gap:6}}><Icon name="alert-circle" size={14} color="#991B1B" /><Text style={styles.errorText}>{error}</Text></View>
          </View>
        ) : null}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          placeholderTextColor={COLORS.textMute}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={COLORS.textMute}
          secureTextEntry
          editable={!loading}
          onSubmitEditing={handleLogin}
          returnKeyType="done"
        />

        <TouchableOpacity
          style={[styles.loginBtn, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.loginBtnText}>Sign In</Text>
          }
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>Contact your administrator to get access</Text>
    </KeyboardAvoidingView>
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

  logoWrap:    { alignItems: 'center', marginBottom: 8 },
  logoBox:     { width: 200, height: 60, alignItems: 'center', justifyContent: 'center' },
  logoImg:     { width: 180, height: 56 },
  brandName:   { fontSize: 11, color: COLORS.textMute, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 },
  brandSub:    { fontSize: 12, color: COLORS.textMute },
  title:       { fontSize: 24, fontWeight: FONTS.black, color: COLORS.text, marginBottom: 6 },
  subtitle:    { fontSize: 14, color: COLORS.textMute, marginBottom: 28, lineHeight: 20 },
  label:       { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 18 },
  errorBox:    { backgroundColor: COLORS.dangerLight, borderRadius: RADIUS.md, padding: 12, marginBottom: 16, flexDirection: 'row', gap: 8 },
  errorText:   { fontSize: 13, color: COLORS.danger, flex: 1 },
  footer:      { fontSize: 12, color: COLORS.textMute, textAlign: 'center', marginTop: 24 },

});