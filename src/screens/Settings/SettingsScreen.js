import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, StatusBar, Switch,
  FlatList, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getProfile, saveProfile, exportAllData, importAllData } from '../../db';
import { signOut as firebaseSignOut, getCurrentUser } from '../../utils/firebase';
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
import { version } from '../../../app.json';

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
      if (token) {
        fetchUserEmail(token).then(async email => {
          await saveToken(token, email);
          setDriveEmail(email);
          Alert.alert('✅ Connected', `Google Drive linked to ${email}`);
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
      Alert.alert('✅ Saved', 'Business profile updated');
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
      Alert.alert('✅ Backup saved', 'Your data has been backed up to Google Drive');
    } catch (e) { Alert.alert('Backup failed', e.message); }
    finally { setSyncing(false); }
  };

  const handleRestore = async () => {
    const token = await getToken();
    if (!token) { Alert.alert('Not connected', 'Connect Google Drive first'); return; }
    Alert.alert(
      '⚠️ Restore Backup',
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
              Alert.alert('✅ Restored', 'Your data has been restored successfully');
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
          <Text style={styles.backIcon}>←</Text>
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
        <SectionHeader icon="🏢" title="Business Details" />
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
              <Text style={styles.pickerArrow}>▾</Text>
            </TouchableOpacity>
          </Field>
        </View>

        {/* ── GST & Tax ─────────────────────────────────── */}
        <SectionHeader icon="🏛️" title="GST & Tax" />
        <View style={styles.card}>
          <Field label="GSTIN">
            <TextInput style={styles.input} value={form.gstin||''} onChangeText={v=>set('gstin',v.toUpperCase())} placeholder="22AAAAA0000A1Z5" placeholderTextColor={COLORS.textMute} autoCapitalize="characters" maxLength={15} />
          </Field>
          {form.gstin?.length>0&&form.gstin.length!==15&&(
            <View style={styles.hintWarn}><Text style={styles.hintWarnText}>⚠️ GSTIN must be 15 characters ({form.gstin.length}/15)</Text></View>
          )}
          {form.gstin?.length===15&&(
            <View style={styles.hintOk}><Text style={styles.hintOkText}>✅ GSTIN format looks good</Text></View>
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
        <SectionHeader icon="🧾" title="Invoice Settings" />
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
        <SectionHeader icon="🏦" title="Bank Details" />
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
            <Text style={styles.infoBoxText}>💡 Bank details appear on PDF invoices for customer payments</Text>
          </View>
        </View>

        {/* ── UPI & QR ───────────────────────────────────── */}
        <SectionHeader icon="📲" title="UPI & QR Code" />
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
              <Text style={styles.upiOkIcon}>✅</Text>
              <View style={{flex:1}}>
                <Text style={styles.upiOkTitle}>QR will appear on invoices</Text>
                <Text style={styles.upiOkId}>{form.upi_id}</Text>
              </View>
            </View>
          ):null}

          {form.show_upi_qr&&!form.upi_id?(
            <View style={styles.upiWarn}>
              <Text style={styles.upiWarnText}>⚠️ Enter your UPI ID above to enable QR code</Text>
            </View>
          ):null}
        </View>

        {/* ── Backup & Restore ──────────────────────────── */}
        <SectionHeader icon="☁️" title="Backup & Restore" />
        <View style={styles.card}>
          {driveEmail ? (
            <>
              <View style={styles.driveConnected}>
                <Text style={styles.driveIcon}>✅</Text>
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
                    : <Text style={styles.backupBtnText}>☁️ Sync Now</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.restoreBtn, restoring && {opacity:0.5}]}
                  onPress={handleRestore}
                  disabled={restoring}
                >
                  {restoring
                    ? <ActivityIndicator size="small" color={COLORS.primary}/>
                    : <Text style={styles.restoreBtnText}>↩️ Restore</Text>
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
                <Text style={styles.connectBtnText}>🔗 Connect Google Drive</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ── About ─────────────────────────────────────── */}
        <SectionHeader icon="ℹ️" title="About" />
        <View style={styles.card}>
          <InfoRow label="App"      value="Locas" />
          <InfoRow label="Version"  value={version} />
          <InfoRow label="GST"      value="CGST / SGST / IGST" />
          <InfoRow label="Storage"  value="Local SQLite (offline)" />
          <InfoRow label="Account"  value={getCurrentUser()?.email || ''} />
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>🚪 Sign Out</Text>
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
                <TouchableOpacity onPress={()=>setTimeModal(false)}><Text style={styles.stateClose}>✕</Text></TouchableOpacity>
              </View>
              {BACKUP_TIMES.map(t => (
                <TouchableOpacity key={t} style={styles.stateItem} onPress={()=>handleSaveBackupTime(t)}>
                  <Text style={[styles.stateName, backupTime===t&&{color:COLORS.primary,fontWeight:FONTS.bold}]}>{t}</Text>
                  {backupTime===t && <Text style={{color:COLORS.primary}}>✓</Text>}
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
              <TouchableOpacity onPress={()=>setStateModal(false)}><Text style={styles.stateClose}>✕</Text></TouchableOpacity>
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

function SectionHeader({icon,title}){return(<View style={styles.sectionHeader}><Text style={styles.sectionIcon}>{icon}</Text><Text style={styles.sectionTitle}>{title}</Text></View>);}
function Field({label,children,flex,style}){return(<View style={[{flex},style]}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>);}
function Row({children}){return<View style={styles.row}>{children}</View>;}
function InfoRow({label,value}){return(<View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>);}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:COLORS.bg},
  center:{flex:1,alignItems:'center',justifyContent:'center'},
  scroll:{padding:16},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingVertical:14,backgroundColor:COLORS.card,borderBottomWidth:1,borderBottomColor:COLORS.border},
  backBtn:{padding:4},backIcon:{fontSize:22,color:COLORS.primary},
  headerTitle:{fontSize:20,fontWeight:FONTS.heavy,color:COLORS.text},
  saveBtn:{backgroundColor:COLORS.primary,paddingHorizontal:16,paddingVertical:8,borderRadius:RADIUS.md},
  saveBtnText:{color:COLORS.white,fontWeight:FONTS.bold,fontSize:14},
  sectionHeader:{flexDirection:'row',alignItems:'center',gap:8,marginTop:16,marginBottom:8},
  sectionIcon:{fontSize:18},
  sectionTitle:{fontSize:14,fontWeight:FONTS.bold,color:COLORS.textSub,textTransform:'uppercase',letterSpacing:.5},
  card:{backgroundColor:COLORS.card,borderRadius:RADIUS.lg,padding:14,marginBottom:4,...SHADOW.sm},
  fieldLabel:{fontSize:12,fontWeight:FONTS.semibold,color:COLORS.textSub,marginBottom:6,marginTop:12,textTransform:'uppercase',letterSpacing:.4},
  input:{backgroundColor:COLORS.bg,borderWidth:1,borderColor:COLORS.border,borderRadius:RADIUS.sm,paddingHorizontal:12,paddingVertical:10,fontSize:14,color:COLORS.text},
  textarea:{minHeight:72,textAlignVertical:'top'},
  row:{flexDirection:'row',alignItems:'flex-start'},
  picker:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  pickerText:{fontSize:14,color:COLORS.text},
  pickerPlaceholder:{fontSize:14,color:COLORS.textMute},
  pickerArrow:{fontSize:14,color:COLORS.textMute},
  hintWarn:{backgroundColor:'#FEF3C7',borderRadius:RADIUS.sm,padding:10,marginTop:8},
  hintWarnText:{fontSize:12,color:'#92400E'},
  hintOk:{backgroundColor:'#D1FAE5',borderRadius:RADIUS.sm,padding:10,marginTop:8},
  hintOkText:{fontSize:12,color:'#065F46'},
  previewBox:{backgroundColor:COLORS.primaryLight,borderRadius:RADIUS.sm,padding:12,marginTop:10},
  previewLabel:{fontSize:11,color:COLORS.primary,fontWeight:FONTS.semibold,marginBottom:4},
  previewValue:{fontSize:15,color:COLORS.primary,fontWeight:FONTS.bold},
  infoBox:{backgroundColor:'#EFF6FF',borderRadius:RADIUS.sm,padding:10,marginTop:12},
  infoBoxText:{fontSize:12,color:'#1D4ED8',lineHeight:18},
  toggleRow:{flexDirection:'row',alignItems:'center',paddingVertical:14,gap:12},
  toggleLabel:{fontSize:14,fontWeight:FONTS.semibold,color:COLORS.text},
  toggleSub:{fontSize:12,color:COLORS.textSub,marginTop:2},
  upiOk:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#D1FAE5',borderRadius:RADIUS.md,padding:12,marginTop:8},
  upiOkIcon:{fontSize:20},
  upiOkTitle:{fontSize:13,fontWeight:FONTS.bold,color:'#065F46'},
  upiOkId:{fontSize:12,color:'#065F46',marginTop:2},
  upiWarn:{backgroundColor:'#FEF3C7',borderRadius:RADIUS.md,padding:10,marginTop:8},
  upiWarnText:{fontSize:12,color:'#92400E',fontWeight:FONTS.medium},
  infoRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:8,borderBottomWidth:1,borderBottomColor:COLORS.border},
  infoLabel:{fontSize:14,color:COLORS.textSub,fontWeight:FONTS.medium},
  infoValue:{fontSize:14,color:COLORS.text,fontWeight:FONTS.semibold,textAlign:'right',flex:1,marginLeft:16},
  bottomSave:{backgroundColor:COLORS.primary,borderRadius:RADIUS.lg,paddingVertical:15,alignItems:'center',marginTop:8,...SHADOW.md,shadowColor:COLORS.primary,shadowOpacity:.35},
  bottomSaveText:{color:COLORS.white,fontWeight:FONTS.heavy,fontSize:16},
  stateOverlay:{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.5)',justifyContent:'flex-end'},
  stateSheet:{backgroundColor:COLORS.card,borderTopLeftRadius:RADIUS.xl,borderTopRightRadius:RADIUS.xl,maxHeight:'75%'},
  stateHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:16,borderBottomWidth:1,borderBottomColor:COLORS.border},
  stateTitle:{fontSize:17,fontWeight:FONTS.bold,color:COLORS.text},
  stateClose:{fontSize:20,color:COLORS.textMute,padding:4},
  stateSearchBox:{padding:12,borderBottomWidth:1,borderBottomColor:COLORS.border},
  stateSearchInput:{backgroundColor:COLORS.bg,borderWidth:1,borderColor:COLORS.border,borderRadius:RADIUS.sm,paddingHorizontal:12,paddingVertical:9,fontSize:14,color:COLORS.text},
  stateItem:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:14,borderBottomWidth:1,borderBottomColor:COLORS.border},
  // Backup styles
  driveConnected:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:10},
  driveIcon:{fontSize:22},
  driveEmail:{fontSize:14,fontWeight:FONTS.bold,color:COLORS.text},
  driveLastBackup:{fontSize:11,color:COLORS.textMute,marginTop:2},
  disconnectBtn:{fontSize:12,color:COLORS.danger,fontWeight:FONTS.semibold},
  backupTimeRow:{flexDirection:'row',alignItems:'center',paddingVertical:14,borderTopWidth:1,borderTopColor:COLORS.border,gap:12},
  timeChip:{backgroundColor:COLORS.primaryLight,paddingHorizontal:14,paddingVertical:8,borderRadius:RADIUS.md},
  timeChipText:{fontSize:14,fontWeight:FONTS.bold,color:COLORS.primary},
  backupActions:{flexDirection:'row',gap:10,marginTop:14},
  backupBtn:{flex:1,backgroundColor:COLORS.primary,borderRadius:RADIUS.md,paddingVertical:12,alignItems:'center'},
  backupBtnText:{color:COLORS.white,fontWeight:FONTS.bold,fontSize:14},
  restoreBtn:{flex:1,backgroundColor:COLORS.bg,borderRadius:RADIUS.md,paddingVertical:12,alignItems:'center',borderWidth:1,borderColor:COLORS.primary},
  restoreBtnText:{color:COLORS.primary,fontWeight:FONTS.bold,fontSize:14},
  driveDesc:{fontSize:13,color:COLORS.textSub,lineHeight:20,marginBottom:14},
  connectBtn:{backgroundColor:COLORS.primary,borderRadius:RADIUS.md,paddingVertical:13,alignItems:'center'},
  connectBtnText:{color:COLORS.white,fontWeight:FONTS.bold,fontSize:15},
  stateName:{fontSize:15,color:COLORS.text,fontWeight:FONTS.medium},
  signOutBtn:{backgroundColor:'#FEE2E2',borderRadius:RADIUS.lg,paddingVertical:14,alignItems:'center',marginTop:8,marginBottom:4},
  signOutText:{color:'#991B1B',fontWeight:FONTS.bold,fontSize:15},
  stateCode:{fontSize:13,color:COLORS.textSub,fontWeight:FONTS.bold},
});
