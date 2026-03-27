import Icon from '../../utils/Icon';
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
          <Icon name="arrow-left" size={20} color={COLORS.primary} />
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
              <Icon name="chevron-down" size={16} color={COLORS.textMute} />
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
            <View style={styles.hintWarn}><Icon name="alert-circle" size={12} color={COLORS.warning} /><Text style={styles.hintWarnText}> GSTIN must be 15 characters ({form.gstin.length}/15)</Text></View>
          )}
          {form.gstin?.length===15&&(
            <View style={styles.hintOk}><Icon name="check-circle" size={12} color={COLORS.success} /><Text style={styles.hintOkText}> GSTIN format looks good</Text></View>
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
              <Icon name="check-circle" size={16} color={COLORS.success} />
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
                <Icon name="check-circle" size={16} color={COLORS.success} />
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
                    : <><Icon name="cloud" size={14} color="#fff" /><Text style={styles.backupBtnText}> Sync Now</Text></>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.restoreBtn, restoring && {opacity:0.5}]}
                  onPress={handleRestore}
                  disabled={restoring}
                >
                  {restoring
                    ? <ActivityIndicator size="small" color={COLORS.primary}/>
                    : <><Icon name="refresh-ccw" size={14} color={COLORS.secondary} /><Text style={styles.restoreBtnText}> Restore</Text></>
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
                <><Icon name="link" size={14} color="#fff" /><Text style={styles.connectBtnText}> Connect Google Drive</Text></>
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
          <><Icon name="log-out" size={14} color={COLORS.danger} /><Text style={styles.signOutText}> Sign Out</Text></>
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
                <TouchableOpacity onPress={()=>setTimeModal(false)} style={{padding:4}}><Icon name='x' size={18} color={COLORS.textMute} /></TouchableOpacity>
              </View>
              {BACKUP_TIMES.map(t => (
                <TouchableOpacity key={t} style={styles.stateItem} onPress={()=>handleSaveBackupTime(t)}>
                  <Text style={[styles.stateName, backupTime===t&&{color:COLORS.primary,fontWeight:FONTS.bold}]}>{t}</Text>
                  {backupTime===t && <Icon name="check" size={16} color={COLORS.primary} />}
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
              <TouchableOpacity onPress={()=>setStateModal(false)} style={{padding:4}}><Icon name='x' size={18} color={COLORS.textMute} /></TouchableOpacity>
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

function SectionHeader({icon,title}){return(<View style={styles.sectionHeader}><Icon name={icon} size={14} color={COLORS.textSub} style={{marginRight:6}} /><Text style={styles.sectionTitle}>{title}</Text></View>);}
function Field({label,children,flex,style}){return(<View style={[{flex},style]}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>);}
function Row({children}){return<View style={styles.row}>{children}</View>;}
function InfoRow({label,value}){return(<View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>);}



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

  toggleRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  toggleLabel:     { flex: 1, fontSize: 14, fontWeight: FONTS.medium, color: COLORS.text },
  toggleSub:       { fontSize: 11, color: COLORS.textMute, marginTop: 1 },
  picker:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  pickerText:      { fontSize: 14, color: COLORS.text },
  pickerPlaceholder:{ fontSize: 14, color: COLORS.textMute },
  previewBox:      { backgroundColor: COLORS.bg, borderRadius: RADIUS.md, padding: 12, marginTop: 8 },
  previewLabel:    { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.4 },
  previewValue:    { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.primary, marginTop: 4 },
  timeChip:        { paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  timeChipText:    { fontSize: 14, color: COLORS.text, fontWeight: FONTS.medium },
  driveConnected:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.successLight, borderRadius: RADIUS.md, padding: 12, marginTop: 8 },
  driveDesc:       { flex: 1, fontSize: 13, color: COLORS.success, fontWeight: FONTS.medium },
  driveLastBackup: { fontSize: 11, color: COLORS.success, marginTop: 2, opacity: 0.7 },
  disconnectBtn:   { paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.sm, backgroundColor: 'rgba(220,38,38,0.1)' },
  backupTimeRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  backupActions:   { flexDirection: 'row', gap: 8, marginTop: 8 },
  bottomSave:      { backgroundColor: COLORS.primary, paddingVertical: 15, borderRadius: RADIUS.lg, alignItems: 'center', marginHorizontal: 16, marginTop: 8, marginBottom: 16 },
  bottomSaveText:  { color: '#fff', fontWeight: FONTS.black, fontSize: 15 },
  upiOkTitle:      { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.success },
  upiOkId:         { fontSize: 12, color: COLORS.success, marginTop: 1 },

});