import { Feather } from '@expo/vector-icons';
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, StatusBar, Switch,
  FlatList, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getProfile, saveProfile, exportAllData, importAllData } from '../../db';
import { signOut as firebaseSignOut, getCurrentUser } from '../../utils/firebase/firebaseAuth';
import { Platform } from 'react-native';

// Google Drive is mobile-only — lazy load to prevent web crash
const isNative = Platform.OS !== 'web';
const {
  useGoogleAuth: _useGoogleAuth,
  saveToken, getToken, getUserEmail, fetchUserEmail,
  uploadBackup, downloadBackup,
  signOut: gdriveSignOut,
  getBackupTime, setBackupTime, getLastBackupTime,
} = isNative ? require('../../utils/googleDrive') : {
  useGoogleAuth: () => ({ request: null, response: null, promptAsync: () => {} }),
  saveToken: async () => {}, getToken: async () => null,
  getUserEmail: async () => null, fetchUserEmail: async () => '',
  uploadBackup: async () => {}, downloadBackup: async () => null,
  signOut: async () => {},
  getBackupTime: async () => '00:00', setBackupTime: async () => {},
  getLastBackupTime: async () => null,
};
function useGoogleAuth() { return _useGoogleAuth(); }
import { INDIAN_STATES } from '../../utils/gst';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';
// Use require() for app.json — named ESM imports from JSON can fail in some
// webpack/Electron builds that don't enable JSON module assertions.
const { expo: { version } } = require('../../../app.json');

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [form, setForm]       = useState(null);
  const [saving, setSaving]   = useState(false);
  const [dirty, setDirty]     = useState(false);
  const [stateModal, setStateModal]   = useState(false);
  const [stateSearch, setStateSearch] = useState('');

  // Backup state
  const [driveEmail, setDriveEmail]     = useState(null);
  const [lastBackup, setLastBackup]     = useState(null);
  const [backupTime, setBackupTimeVal]  = useState('00:00');
  const [syncing, setSyncing]           = useState(false);
  const [restoring, setRestoring]       = useState(false);
  const [timeModal, setTimeModal]       = useState(false);
  const { request, response, promptAsync } = useGoogleAuth();

  const load = async () => {
    try {
      const p = await getProfile();
      setForm({ ...p, show_upi_qr: !!p.show_upi_qr });
      setDirty(false);
    } catch (e) { console.error(e); }
  };

  const loadBackupInfo = async () => {
    const email = await getUserEmail();
    const last  = await getLastBackupTime();
    const time  = await getBackupTime();
    setDriveEmail(email);
    setLastBackup(last);
    setBackupTimeVal(time || '00:00');
  };

  useFocusEffect(useCallback(() => { load(); loadBackupInfo(); }, []));

  // Handle Google OAuth response
  useEffect(() => {
    if (response?.type === 'success') {
      const token = response.authentication?.accessToken || response.params?.access_token;
      // expires_in comes back as a string in implicit flow params
      const expiresIn = parseInt(response.authentication?.expiresIn || response.params?.expires_in || '3600', 10);
      if (token) {
        fetchUserEmail(token).then(async email => {
          await saveToken(token, email, expiresIn);
          setDriveEmail(email);
          Alert.alert('Connected', `Google Drive linked to ${email}`);
        }).catch(() => Alert.alert('Error', 'Could not fetch Google account info'));
      }
    }
  }, [response]);

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
      Alert.alert('Saved', 'Business profile updated');
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const selectState = (s) => {
    set('state', s.name);
    set('state_code', s.code);
    setStateModal(false);
    setStateSearch('');
  };

  const filteredStates = INDIAN_STATES.filter(s =>
    s.name.toLowerCase().includes(stateSearch.toLowerCase()) || s.code.includes(stateSearch)
  );

  const handleSync = async () => {
    const token = await getToken();
    if (!token) { Alert.alert('Not connected', 'Connect Google Drive first'); return; }
    setSyncing(true);
    try {
      const json = await exportAllData();
      await uploadBackup(token, json);
      const last = await getLastBackupTime();
      setLastBackup(last);
      Alert.alert('Backup saved', 'Your data has been backed up to Google Drive');
    } catch (e) { Alert.alert('Backup failed', e.message); }
    finally { setSyncing(false); }
  };

  const handleRestore = async () => {
    const token = await getToken();
    if (!token) { Alert.alert('Not connected', 'Connect Google Drive first'); return; }
    Alert.alert(
      'Restore Backup',
      'This will replace ALL current data with your Google Drive backup. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore', style: 'destructive',
          onPress: async () => {
            setRestoring(true);
            try {
              const json = await downloadBackup(token);
              if (!json) { Alert.alert('No backup found', 'No backup file found in your Google Drive'); return; }
              await importAllData(json);
              Alert.alert('Restored', 'Your data has been restored successfully');
            } catch (e) { Alert.alert('Restore failed', e.message); }
            finally { setRestoring(false); }
          }
        }
      ]
    );
  };

  const handleDisconnect = () => {
    Alert.alert('Disconnect Google Drive', 'Stop backing up to Google Drive?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: async () => {
        await gdriveSignOut(); setDriveEmail(null); setLastBackup(null);
      }},
    ]);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => firebaseSignOut() },
    ]);
  };

  const handleSaveBackupTime = async (time) => {
    await setBackupTime(time);
    setBackupTimeVal(time);
    setTimeModal(false);
  };

  const formatLastBackup = (iso) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const BACKUP_TIMES = ['00:00','06:00','08:00','10:00','12:00','18:00','20:00','22:00'];

  if (!form) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity
          style={[styles.saveBtn, (!dirty || saving) && { opacity: 0.4 }]}
          onPress={handleSave}
          disabled={!dirty || saving}
        >
          {saving ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>

        {/* ── Business Info ─────────────────────────────── */}
        <SectionHeader icon="briefcase" title="Business Details" />
        <View style={styles.card}>
          <Field label="Business Name *">
            <TextInput style={styles.input} value={form.name||''} onChangeText={v=>set('name',v)} placeholder="Your business name" placeholderTextColor={COLORS.textMute} />
          </Field>
          <Field label="Address">
            <TextInput style={[styles.input,styles.textarea]} value={form.address||''} onChangeText={v=>set('address',v)} placeholder="Full business address" placeholderTextColor={COLORS.textMute} multiline numberOfLines={3} />
          </Field>
          <Row>
            <Field label="Phone" flex={1}>
              <TextInput style={styles.input} value={form.phone||''} onChangeText={v=>set('phone',v)} placeholder="Mobile / landline" placeholderTextColor={COLORS.textMute} keyboardType="phone-pad" />
            </Field>
            <View style={{width:12}}/>
            <Field label="Email" flex={1}>
              <TextInput style={styles.input} value={form.email||''} onChangeText={v=>set('email',v)} placeholder="email@business.com" placeholderTextColor={COLORS.textMute} keyboardType="email-address" autoCapitalize="none" />
            </Field>
          </Row>
          <Field label="State">
            <TouchableOpacity style={[styles.input,styles.picker]} onPress={()=>{setStateSearch('');setStateModal(true);}}>
              <Text style={form.state?styles.pickerText:styles.pickerPlaceholder}>{form.state?`${form.state} (${form.state_code})`:'Select state...'}</Text>
              <Feather name="chevron-down" size={16} color={COLORS.textMute} />
            </TouchableOpacity>
          </Field>
        </View>

        {/* ── GST & Tax ─────────────────────────────────── */}
        <SectionHeader icon="percent" title="GST & Tax" />
        <View style={styles.card}>
          <Field label="GSTIN">
            <TextInput style={styles.input} value={form.gstin||''} onChangeText={v=>set('gstin',v.toUpperCase())} placeholder="22AAAAA0000A1Z5" placeholderTextColor={COLORS.textMute} autoCapitalize="characters" maxLength={15} />
          </Field>
          {form.gstin?.length>0&&form.gstin.length!==15&&(
            <View style={styles.hintWarn}><Feather name="alert-circle" size={12} color={COLORS.warning} /><Text style={styles.hintWarnText}> GSTIN must be 15 characters ({form.gstin.length}/15)</Text></View>
          )}
          {form.gstin?.length===15&&(
            <View style={styles.hintOk}><Feather name="check-circle" size={12} color={COLORS.success} /><Text style={styles.hintOkText}> GSTIN format looks good</Text></View>
          )}
          <Row>
            <Field label="PAN" flex={1}>
              <TextInput style={styles.input} value={form.pan||''} onChangeText={v=>set('pan',v.toUpperCase())} placeholder="AAAAA0000A" placeholderTextColor={COLORS.textMute} autoCapitalize="characters" maxLength={10} />
            </Field>
            <View style={{width:12}}/>
            <Field label="State Code" flex={1}>
              <TextInput style={[styles.input,{backgroundColor:COLORS.bg}]} value={form.state_code||''} editable={false} placeholder="Auto from state" placeholderTextColor={COLORS.textMute} />
            </Field>
          </Row>
        </View>

        {/* ── Invoice Settings ───────────────────────────── */}
        <SectionHeader icon="file-text" title="Invoice Settings" />
        <View style={styles.card}>
          <Field label="Invoice Prefix">
            <TextInput style={styles.input} value={form.invoice_prefix||'INV'} onChangeText={v=>set('invoice_prefix',v.toUpperCase())} placeholder="INV" placeholderTextColor={COLORS.textMute} autoCapitalize="characters" maxLength={6} />
          </Field>
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>Next invoice will look like</Text>
            <Text style={styles.previewValue}>{form.invoice_prefix||'INV'}-0001, {form.invoice_prefix||'INV'}-0002…</Text>
          </View>
        </View>

        {/* ── Bank Details ───────────────────────────────── */}
        <SectionHeader icon="credit-card" title="Bank Details" />
        <View style={styles.card}>
          <Field label="Bank Name">
            <TextInput style={styles.input} value={form.bank_name||''} onChangeText={v=>set('bank_name',v)} placeholder="e.g. State Bank of India" placeholderTextColor={COLORS.textMute} />
          </Field>
          <Row>
            <Field label="Account Number" flex={1}>
              <TextInput style={styles.input} value={form.account_no||''} onChangeText={v=>set('account_no',v)} placeholder="Account number" placeholderTextColor={COLORS.textMute} keyboardType="numeric" />
            </Field>
            <View style={{width:12}}/>
            <Field label="IFSC Code" flex={1}>
              <TextInput style={styles.input} value={form.ifsc||''} onChangeText={v=>set('ifsc',v.toUpperCase())} placeholder="SBIN0001234" placeholderTextColor={COLORS.textMute} autoCapitalize="characters" maxLength={11} />
            </Field>
          </Row>
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxText}>Bank details appear on PDF invoices for customer payments</Text>
          </View>
        </View>

        {/* ── UPI & QR ───────────────────────────────────── */}
        <SectionHeader icon="smartphone" title="UPI & QR Code" />
        <View style={styles.card}>
          <Field label="UPI ID">
            <TextInput
              style={styles.input}
              value={form.upi_id||''}
              onChangeText={v=>set('upi_id',v)}
              placeholder="e.g. 9876543210@paytm or name@okaxis"
              placeholderTextColor={COLORS.textMute}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </Field>

          <View style={styles.toggleRow}>
            <View style={{flex:1}}>
              <Text style={styles.toggleLabel}>Show QR Code on Invoice</Text>
              <Text style={styles.toggleSub}>Customers scan and pay directly from PDF</Text>
            </View>
            <Switch
              value={!!form.show_upi_qr}
              onValueChange={v=>set('show_upi_qr',v)}
              trackColor={{false:COLORS.border,true:COLORS.primary}}
              thumbColor={COLORS.white}
            />
          </View>

          {form.upi_id&&form.show_upi_qr?(
            <View style={styles.upiOk}>
              <Feather name="check-circle" size={16} color={COLORS.success} />
              <View style={{flex:1}}>
                <Text style={styles.upiOkTitle}>QR will appear on invoices</Text>
                <Text style={styles.upiOkId}>{form.upi_id}</Text>
              </View>
            </View>
          ):null}

          {form.show_upi_qr&&!form.upi_id?(
            <View style={styles.upiWarn}>
              <Text style={styles.upiWarnText}>Enter your UPI ID above to enable QR code</Text>
            </View>
          ):null}
        </View>

        {/* ── Backup & Restore ──────────────────────────── */}
        <SectionHeader icon="cloud" title="Backup & Restore" />
        <View style={styles.card}>
          {driveEmail ? (
            <>
              <View style={styles.driveConnected}>
                <Feather name="check-circle" size={16} color={COLORS.success} />
                <View style={{flex:1}}>
                  <Text style={styles.driveEmail}>{driveEmail}</Text>
                  <Text style={styles.driveLastBackup}>Last backup: {formatLastBackup(lastBackup)}</Text>
                </View>
                <TouchableOpacity onPress={handleDisconnect}>
                  <Text style={styles.disconnectBtn}>Disconnect</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.backupTimeRow}>
                <View style={{flex:1}}>
                  <Text style={styles.toggleLabel}>Daily Backup Time</Text>
                  <Text style={styles.toggleSub}>Auto backup runs once per day</Text>
                </View>
                <TouchableOpacity style={styles.timeChip} onPress={()=>setTimeModal(true)}>
                  <Text style={styles.timeChipText}>{backupTime}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.backupActions}>
                <TouchableOpacity
                  style={[styles.backupBtn, syncing && {opacity:0.5}]}
                  onPress={handleSync}
                  disabled={syncing}
                >
                  {syncing
                    ? <ActivityIndicator size="small" color={COLORS.white}/>
                    : <><Feather name="cloud" size={14} color="#fff" /><Text style={styles.backupBtnText}> Sync Now</Text></>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.restoreBtn, restoring && {opacity:0.5}]}
                  onPress={handleRestore}
                  disabled={restoring}
                >
                  {restoring
                    ? <ActivityIndicator size="small" color={COLORS.primary}/>
                    : <><Feather name="refresh-ccw" size={14} color={COLORS.secondary} /><Text style={styles.restoreBtnText}> Restore</Text></>
                  }
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.driveDesc}>
                Connect Google Drive to automatically backup your data daily. Restore anytime after reinstalling the app.
              </Text>
              <TouchableOpacity
                style={styles.connectBtn}
                onPress={() => promptAsync()}
                disabled={!request}
              >
                <><Feather name="link" size={14} color="#fff" /><Text style={styles.connectBtnText}> Connect Google Drive</Text></>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ── About ─────────────────────────────────────── */}
        <SectionHeader icon="info" title="About" />
        <View style={styles.card}>
          <InfoRow label="App"      value="Locas" />
          <InfoRow label="Version"  value={version} />
          <InfoRow label="GST"      value="CGST / SGST / IGST" />
          <InfoRow label="Storage"  value="Local SQLite (offline)" />
          <InfoRow label="Account"  value={getCurrentUser()?.email || ''} />
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <><Feather name="log-out" size={14} color={COLORS.danger} /><Text style={styles.signOutText}> Sign Out</Text></>
        </TouchableOpacity>

        {/* Bottom save button */}
        {dirty&&(
          <TouchableOpacity style={[styles.bottomSave,saving&&{opacity:.5}]} onPress={handleSave} disabled={saving}>
            {saving?<ActivityIndicator color={COLORS.white}/>:<Text style={styles.bottomSaveText}>💾 Save Changes</Text>}
          </TouchableOpacity>
        )}

        <View style={{height:80}}/>
      </ScrollView>

      {/* Backup time picker */}
      {timeModal && (
        <Modal transparent animationType="slide" onRequestClose={()=>setTimeModal(false)}>
          <View style={styles.stateOverlay}>
            <View style={styles.stateSheet}>
              <View style={styles.stateHeader}>
                <Text style={styles.stateTitle}>Select Backup Time</Text>
                <TouchableOpacity onPress={()=>setTimeModal(false)}><Feather name='x' size={18} color={COLORS.textMute} />se}>✕</Text></TouchableOpacity>
              </View>
              {BACKUP_TIMES.map(t => (
                <TouchableOpacity key={t} style={styles.stateItem} onPress={()=>handleSaveBackupTime(t)}>
                  <Text style={[styles.stateName, backupTime===t&&{color:COLORS.primary,fontWeight:FONTS.bold}]}>{t}</Text>
                  {backupTime===t && <Feather name="check" size={16} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>
      )}

      {/* State picker */}
      {stateModal&&(
        <View style={styles.stateOverlay}>
          <View style={styles.stateSheet}>
            <View style={styles.stateHeader}>
              <Text style={styles.stateTitle}>Select State</Text>
              <TouchableOpacity onPress={()=>setStateModal(false)}><Feather name='x' size={18} color={COLORS.textMute} />ose}>✕</Text></TouchableOpacity>
            </View>
            <View style={styles.stateSearchBox}>
              <TextInput style={styles.stateSearchInput} value={stateSearch} onChangeText={setStateSearch} placeholder="Search state..." placeholderTextColor={COLORS.textMute} autoFocus />
            </View>
            <FlatList
              data={filteredStates}
              keyExtractor={s=>s.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({item})=>(
                <TouchableOpacity style={styles.stateItem} onPress={()=>selectState(item)}>
                  <Text style={styles.stateName}>{item.name}</Text>
                  <Text style={styles.stateCode}>{item.code}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      )}
    </View>
  );
}

function SectionHeader({icon,title}){return(<View style={styles.sectionHeader}><Feather name={icon} size={14} color={COLORS.textSub} style={{marginRight:6}} /><Text style={styles.sectionTitle}>{title}</Text></View>);}
function Field({label,children,flex,style}){return(<View style={[{flex},style]}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>);}
function Row({children}){return<View style={styles.row}>{children}</View>;}
function InfoRow({label,value}){return(<View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>);}


const styles = StyleSheet.create({
  // ── Layout ───────────────────────────────────────────────────────
  container: { flex: 1, backgroundColor: COLORS.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:    { padding: 16, paddingBottom: 40 },

  // ── Header ───────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerLeft:  { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: FONTS.black, color: COLORS.text },
  headerSub:   { fontSize: 11, color: COLORS.textMute, marginTop: 1 },
  backBtn:     { padding: 6, marginRight: 8 },
  backIcon:    { fontSize: 20, color: COLORS.primary },
  addBtn:      { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md, ...SHADOW.brand },
  addBtnText:  { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
  newBtn:      { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md, ...SHADOW.brand },
  newBtnText:  { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },

  // ── Metrics bar ──────────────────────────────────────────────────
  metricsBar:  { flexDirection: 'row', backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  statChip:    { flex: 1, alignItems: 'center', paddingVertical: 10 },
  statValue:   { fontSize: 15, fontWeight: FONTS.black },
  statLabel:   { fontSize: 10, color: COLORS.textMute, marginTop: 2 },
  statsDivider:{ width: 1, backgroundColor: COLORS.border, marginVertical: 8 },

  // ── Search bar ───────────────────────────────────────────────────
  searchWrap: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 0 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  searchIcon:  { fontSize: 17, color: COLORS.textMute, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 10 },
  clearSearch: { fontSize: 13, color: COLORS.textMute, padding: 4 },

  // ── Filter chips ─────────────────────────────────────────────────
  filterRow:       { paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filterChip:      { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive:{ backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  filterText:      { fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.medium },
  filterTextActive:{ color: '#fff', fontWeight: FONTS.bold },
  catChip:         { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  catChipActive:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catChipText:     { fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.medium },
  catChipTextActive:{ color: '#fff', fontWeight: FONTS.bold },

  // ── List ─────────────────────────────────────────────────────────
  list: { padding: 12, paddingBottom: 90 },

  // ── Cards (parties, items, expenses) ─────────────────────────────
  partyCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
    ...SHADOW.xs, overflow: 'hidden',
  },
  itemCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
    ...SHADOW.xs, overflow: 'hidden',
  },
  expCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
    ...SHADOW.xs, overflow: 'hidden',
  },
  cardRow:   { flexDirection: 'row', alignItems: 'center', padding: 13 },
  cardLeft:  { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  cardRight: { alignItems: 'flex-end', gap: 5 },
  cardInfo:  { flex: 1 },
  cardName:  { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 3 },
  cardSub:   { fontSize: 12, color: COLORS.textSub },

  // Avatar
  avatar:     { width: 42, height: 42, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: FONTS.heavy, color: '#fff' },

  // Badges / tags
  typeBadge:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm, backgroundColor: COLORS.primaryLight },
  typeBadgeSupplier:{ backgroundColor: COLORS.infoLight },
  typeText:         { fontSize: 10, fontWeight: FONTS.bold, color: COLORS.primary },
  typeTextSupplier: { color: COLORS.info },
  balance:          { fontSize: 12, fontWeight: FONTS.heavy, color: COLORS.success },

  // Low stock warning
  lowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, paddingVertical: 7, backgroundColor: COLORS.warningBg, borderTopWidth: 1, borderTopColor: '#FDE68A' },
  lowText:{ fontSize: 11, color: COLORS.warning, fontWeight: FONTS.semibold },

  stockRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingBottom: 10 },
  stockLabel: { fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.medium },
  minStock:   { fontSize: 11, color: COLORS.textMute },

  // Category icon badge
  catIconBox: { width: 38, height: 38, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  catIcon:    { fontSize: 18 },

  // Action buttons on cards
  cardActions: { flexDirection: 'row', gap: 4 },
  editBtn:     { padding: 6, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgDeep },
  editIcon:    { fontSize: 14 },
  delBtn:      { padding: 6, borderRadius: RADIUS.sm, backgroundColor: COLORS.dangerLight },
  delIcon:     { fontSize: 14 },

  // ── Bottom sheet modal ───────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl,
    maxHeight: '92%', ...SHADOW.lg,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.borderDark, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle:  { fontSize: 17, fontWeight: FONTS.black, color: COLORS.text },
  modalClose:  { fontSize: 18, color: COLORS.textMute, padding: 4 },
  modalBody:   { padding: 20 },
  modalFooter: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
  modalSave:   { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.lg, alignItems: 'center', ...SHADOW.brand },
  modalSaveText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 15 },

  // ── Form fields ──────────────────────────────────────────────────
  fieldLabel: { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, marginTop: 14 },
  fieldInput: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: 13, paddingVertical: 11,
    fontSize: 14, color: COLORS.text,
  },
  pickerRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerChip:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg },
  pickerChipActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pickerChipText:    { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  pickerChipTextActive: { color: '#fff', fontWeight: FONTS.bold },

  // ── Reports specific ─────────────────────────────────────────────
  presetRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  presetChip:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  presetChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  presetText:       { fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.medium },
  presetTextActive: { color: '#fff', fontWeight: FONTS.bold },
  reportCard:       { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 14, marginBottom: 12, ...SHADOW.sm, borderWidth: 1, borderColor: COLORS.border },
  reportTitle:      { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  reportRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  reportLabel:      { fontSize: 13, color: COLORS.textSub },
  reportValue:      { fontSize: 13, fontWeight: FONTS.heavy, color: COLORS.text },
  plCard:           { backgroundColor: COLORS.secondary, borderRadius: RADIUS.lg, padding: 16, marginBottom: 14, ...SHADOW.md },
  plTitle:          { fontSize: 12, fontWeight: FONTS.bold, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  plRow:            { flexDirection: 'row' },
  plItem:           { flex: 1, alignItems: 'center' },
  plValue:          { fontSize: 14, fontWeight: FONTS.heavy, marginBottom: 3 },
  plLabel:          { fontSize: 10, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },
  exportBtn:        { backgroundColor: COLORS.secondary, paddingVertical: 12, borderRadius: RADIUS.lg, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  exportBtnText:    { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },

  // ── Settings specific ────────────────────────────────────────────
  settingsSection: { marginBottom: 8 },
  settingsLabel:   { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  settingsCard:    { backgroundColor: COLORS.card, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border },
  settingsRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  settingsRowLast: { borderBottomWidth: 0 },
  settingsRowLabel:{ flex: 1, fontSize: 14, fontWeight: FONTS.medium, color: COLORS.text },
  settingsRowValue:{ fontSize: 13, color: COLORS.textMute },
  settingsInput:   { flex: 1, fontSize: 14, color: COLORS.text, textAlign: 'right' },
  saveBar:         { backgroundColor: COLORS.card, padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  saveBtn:         { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.lg, alignItems: 'center', ...SHADOW.brand },
  saveBtnText:     { color: '#fff', fontWeight: FONTS.bold, fontSize: 15 },
  dangerBtn:       { borderWidth: 1, borderColor: COLORS.dangerLight, paddingVertical: 13, borderRadius: RADIUS.lg, alignItems: 'center', marginTop: 8 },
  dangerBtnText:   { color: COLORS.danger, fontWeight: FONTS.bold, fontSize: 14 },

  // ── Party Detail ─────────────────────────────────────────────────
  heroDetail: {
    backgroundColor: COLORS.secondary, paddingTop: 12, paddingBottom: 20,
    paddingHorizontal: 20, alignItems: 'center',
  },
  detailAvatar:     { width: 60, height: 60, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  detailAvatarText: { fontSize: 26, fontWeight: FONTS.black, color: '#fff' },
  detailName:       { fontSize: 19, fontWeight: FONTS.black, color: '#fff', marginBottom: 4 },
  detailSub:        { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  kpiStrip:         { flexDirection: 'row', backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  kpiChip:          { flex: 1, alignItems: 'center', paddingVertical: 10 },
  kpiValue:         { fontSize: 14, fontWeight: FONTS.heavy, marginBottom: 2 },
  kpiLabel:         { fontSize: 10, color: COLORS.textMute },
  kpiDivider:       { width: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  sectionTitle:     { fontSize: 12, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  invRow: {
    backgroundColor: COLORS.card, marginHorizontal: 12, marginBottom: 8,
    borderRadius: RADIUS.lg, padding: 13, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.xs,
  },
  invRowTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  invNum:      { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 3 },
  invDate:     { fontSize: 11, color: COLORS.textMute },
  invTotal:    { fontSize: 15, fontWeight: FONTS.heavy, color: COLORS.text, marginBottom: 4 },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.xs },
  statusText:  { fontSize: 9, fontWeight: FONTS.black, letterSpacing: 0.5 },
  balRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, marginTop: 6, borderTopWidth: 1, borderTopColor: COLORS.border },
  balLabel:    { fontSize: 11, color: COLORS.danger },
  balValue:    { fontSize: 11, fontWeight: FONTS.heavy, color: COLORS.danger },

  // ── Auth / Login ─────────────────────────────────────────────────
  loginContainer: { flex: 1, backgroundColor: '#FFF8F4', alignItems: 'center', justifyContent: 'center', padding: 24 },
  loginLogoWrap:  { alignItems: 'center', marginBottom: 36 },
  loginLogoBox:   { width: 80, height: 80, borderRadius: RADIUS.xl, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 14, ...SHADOW.brand },
  loginLogoImg:   { width: 56, height: 56 },
  loginBrand:     { fontSize: 26, fontWeight: FONTS.black, color: COLORS.text, letterSpacing: 8 },
  loginTagline:   { fontSize: 12, color: COLORS.textMute, letterSpacing: 1, marginTop: 4 },
  loginCard:      { width: '100%', backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: 24, ...SHADOW.md },
  loginTitle:     { fontSize: 20, fontWeight: FONTS.black, color: COLORS.text, marginBottom: 4 },
  loginSubtitle:  { fontSize: 13, color: COLORS.textMute, marginBottom: 20 },
  loginLabel:     { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, marginTop: 14 },
  loginInput:     { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.text },
  loginBtn:       { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginTop: 22, ...SHADOW.brand },
  loginBtnText:   { color: '#fff', fontWeight: FONTS.black, fontSize: 15, letterSpacing: 0.3 },
  loginError:     { backgroundColor: COLORS.dangerLight, borderRadius: RADIUS.sm, padding: 12, marginBottom: 14 },
  loginErrorText: { fontSize: 13, color: '#991B1B' },
  loginFooter:    { fontSize: 12, color: COLORS.textMute, marginTop: 22, textAlign: 'center' },

  // ── Empty state ──────────────────────────────────────────────────
  empty:        { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIconWrap:{ width: 72, height: 72, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyIcon:    { fontSize: 32 },
  emptyTitle:   { fontSize: 17, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 7, textAlign: 'center' },
  emptySub:     { fontSize: 13, color: COLORS.textMute, textAlign: 'center', lineHeight: 19, marginBottom: 22 },
  emptyBtn:     { backgroundColor: COLORS.primary, paddingHorizontal: 22, paddingVertical: 11, borderRadius: RADIUS.lg, ...SHADOW.brand },
  emptyBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
});