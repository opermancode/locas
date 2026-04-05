import Icon from '../../utils/Icon';
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, StatusBar, Switch,
  FlatList, Modal, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getProfile, saveProfile, exportAllData, importAllData, getInvoices, getQuotations, getPurchaseOrders } from '../../db';
import { signOut as firebaseSignOut, getCurrentUser } from '../../utils/firebase/firebaseAuth';
import { exportDataFile, getDataStorageInfo, pickDataFile, importDataFile } from '../../utils/dataFileManager';
import { INDIAN_STATES } from '../../utils/gst';
import { COLORS, RADIUS, FONTS } from '../../theme';

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

const { expo: { version } } = require('../../../app.json');

// Padding helpers
const pad = (n, len = 4) => String(n).padStart(len, '0');

// Build a sample invoice number from prefix + counter + padding
function buildSampleNumber(prefix, startNum, numDigits) {
  const p = (prefix || 'INV').toUpperCase();
  const n = parseInt(startNum) || 1;
  const d = parseInt(numDigits) || 4;
  return `${p}-${pad(n, d)}`;
}

// SETTINGS TABS
const TABS = [
  { key: 'business',  label: 'Business',  icon: 'briefcase'   },
  { key: 'invoice',   label: 'Invoice',   icon: 'file-text'   },
  { key: 'gst',       label: 'GST & Tax', icon: 'percent'     },
  { key: 'bank',      label: 'Bank / UPI',icon: 'credit-card' },
  { key: 'data',      label: 'Data',      icon: 'database'    },
  { key: 'backup',    label: 'Backup',    icon: 'cloud'       },
  { key: 'about',     label: 'About',     icon: 'info'        },
];

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [form, setForm]           = useState(null);
  const [saving, setSaving]       = useState(false);
  const [dirty, setDirty]         = useState(false);
  const [activeTab, setActiveTab] = useState('business');
  const [stateModal, setStateModal]   = useState(false);
  const [stateSearch, setStateSearch] = useState('');

  // Invoice numbering
  const [numDigits, setNumDigits] = useState('4'); // padding digits

  // Backup
  const [driveEmail, setDriveEmail]   = useState(null);
  const [lastBackup, setLastBackup]   = useState(null);
  const [backupTime, setBackupTimeVal] = useState('00:00');
  const [syncing, setSyncing]         = useState(false);
  const [restoring, setRestoring]     = useState(false);
  const [timeModal, setTimeModal]     = useState(false);

  // Data export / delete
  const [exportingData, setExportingData] = useState(false);
  const [importingData, setImportingData] = useState(false);
  const [exportFrom, setExportFrom]       = useState('');
  const [exportTo, setExportTo]           = useState('');
  const [deleteFrom, setDeleteFrom]       = useState('');
  const [deleteTo, setDeleteTo]           = useState('');
  const [deletingData, setDeletingData]   = useState(false);

  const { request, response, promptAsync } = useGoogleAuth();

  const load = async () => {
    try {
      const p = await getProfile();
      setForm({ ...p, show_upi_qr: !!p.show_upi_qr });
      // Detect current padding from existing prefix
      setNumDigits(String(p.invoice_num_digits || 4));
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

  useEffect(() => {
    if (response?.type === 'success') {
      const token = response.authentication?.accessToken || response.params?.access_token;
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
      await saveProfile({ ...form, invoice_num_digits: parseInt(numDigits) || 4 });
      setDirty(false);
      Alert.alert('Saved ✓', 'Settings saved successfully');
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

  // ── Backup ─────────────────────────────────────────────────────
  const handleSync = async () => {
    const token = await getToken();
    if (!token) { Alert.alert('Not connected', 'Connect Google Drive first'); return; }
    setSyncing(true);
    try {
      const json = await exportAllData();
      await uploadBackup(token, json);
      const last = await getLastBackupTime();
      setLastBackup(last);
      Alert.alert('Backup saved ✓', 'Your data has been backed up to Google Drive');
    } catch (e) { Alert.alert('Backup failed', e.message); }
    finally { setSyncing(false); }
  };

  const handleRestore = async () => {
    const token = await getToken();
    if (!token) { Alert.alert('Not connected', 'Connect Google Drive first'); return; }
    const doRestore = async () => {
      setRestoring(true);
      try {
        const json = await downloadBackup(token);
        if (!json) { Alert.alert('No backup found', 'No backup file in your Google Drive'); return; }
        await importAllData(json);
        Alert.alert('Restored ✓', 'Your data has been restored');
      } catch (e) { Alert.alert('Restore failed', e.message); }
      finally { setRestoring(false); }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Restore Backup?\n\nThis will replace ALL current data with your Google Drive backup. This cannot be undone.')) {
        doRestore();
      }
    } else {
      Alert.alert('Restore Backup', 'This will replace ALL current data. Cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', style: 'destructive', onPress: doRestore },
      ]);
    }
  };

  const handleDisconnect = () => {
    const doIt = async () => { await gdriveSignOut(); setDriveEmail(null); setLastBackup(null); };
    if (Platform.OS === 'web') {
      if (window.confirm('Disconnect Google Drive? Auto backup will stop.')) doIt();
    } else {
      Alert.alert('Disconnect?', 'Stop backing up to Google Drive?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: doIt },
      ]);
    }
  };

  // ── Sign out ───────────────────────────────────────────────────
  const handleSignOut = () => {
    const doSignOut = () => firebaseSignOut();
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Sign Out?\n\nYou will be signed out of LOCAS. Make sure you have exported your data if needed.\n\nClick OK to sign out.'
      );
      if (confirmed) doSignOut();
    } else {
      Alert.alert(
        'Sign Out?',
        'You will be signed out of LOCAS. Make sure you have exported your data.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Out', style: 'destructive', onPress: doSignOut },
        ]
      );
    }
  };

  // ── Data export with date filter ───────────────────────────────
  const handleExportFiltered = async () => {
    setExportingData(true);
    try {
      const allData = JSON.parse(await exportAllData());
      let filtered = { ...allData };

      if (exportFrom || exportTo) {
        const from = exportFrom || '0000-00-00';
        const to   = exportTo   || '9999-99-99';
        filtered.invoices = (allData.invoices || []).filter(i => i.date >= from && i.date <= to);
        filtered.expenses = (allData.expenses || []).filter(e => e.date >= from && e.date <= to);
        filtered.quotations = (allData.quotations || []).filter(q => q.date >= from && q.date <= to);

        // Keep only line items for filtered invoices
        const invIds = new Set(filtered.invoices.map(i => i.id));
        filtered.invoice_items = (allData.invoice_items || []).filter(i => invIds.has(i.invoice_id));
        filtered.payments      = (allData.payments || []).filter(p => invIds.has(p.invoice_id));
      }

      const now = new Date();
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1, 2)}-${pad(now.getDate(), 2)}`;
      const suffix  = exportFrom ? `_${exportFrom}_to_${exportTo || 'now'}` : '';
      const filename = `LOCAS_Export${suffix}_${dateStr}.json`;
      const content  = JSON.stringify(filtered, null, 2);

      if (Platform.OS === 'web') {
        const blob = new Blob([content], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        window.alert(`Exported: ${filename}`);
      } else {
        Alert.alert('Exported', `Saved as ${filename}`);
      }
    } catch (e) {
      Alert.alert('Export failed', e.message);
    } finally {
      setExportingData(false);
    }
  };

  // ── Delete data by date range ──────────────────────────────────
  const handleDeleteByDateRange = async () => {
    if (!deleteFrom || !deleteTo) {
      Alert.alert('Error', 'Enter both From and To dates');
      return;
    }
    if (deleteFrom > deleteTo) {
      Alert.alert('Error', '"From" date must be before "To" date');
      return;
    }

    const doDelete = async () => {
      setDeletingData(true);
      try {
        // Export first, then delete
        const allData = JSON.parse(await exportAllData());
        const from = deleteFrom, to = deleteTo;

        const invToDelete   = (allData.invoices   || []).filter(i => i.date >= from && i.date <= to);
        const expToDelete   = (allData.expenses   || []).filter(e => e.date >= from && e.date <= to);
        const quoToDelete   = (allData.quotations || []).filter(q => q.date >= from && q.date <= to);
        const invIds        = new Set(invToDelete.map(i => i.id));

        // Import remaining data only
        const remaining = {
          ...allData,
          invoices:      (allData.invoices      || []).filter(i => !(i.date >= from && i.date <= to)),
          invoice_items: (allData.invoice_items || []).filter(i => !invIds.has(i.invoice_id)),
          payments:      (allData.payments      || []).filter(p => !invIds.has(p.invoice_id)),
          expenses:      (allData.expenses      || []).filter(e => !(e.date >= from && e.date <= to)),
          quotations:    (allData.quotations    || []).filter(q => !(q.date >= from && q.date <= to)),
        };

        await importAllData(JSON.stringify(remaining));

        const msg = `Deleted:\n• ${invToDelete.length} invoice(s)\n• ${expToDelete.length} expense(s)\n• ${quoToDelete.length} quotation(s)\n\nData from ${from} to ${to} has been removed.`;

        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Deleted ✓', msg);

        setDeleteFrom('');
        setDeleteTo('');
      } catch (e) {
        Alert.alert('Delete failed', e.message);
      } finally {
        setDeletingData(false);
      }
    };

    // Double confirm
    const countMsg = `Delete ALL data from ${deleteFrom} to ${deleteTo}?\n\nThis includes invoices, expenses, and quotations in that range.\n\nThis CANNOT be undone. Export first if needed.`;
    if (Platform.OS === 'web') {
      if (window.confirm(countMsg)) {
        if (window.confirm(`FINAL CONFIRM: Delete data from ${deleteFrom} to ${deleteTo}? Click OK to permanently delete.`)) {
          doDelete();
        }
      }
    } else {
      Alert.alert('⚠️ Delete Data', countMsg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          Alert.alert('Are you sure?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Yes, Delete', style: 'destructive', onPress: doDelete },
          ]);
        }},
      ]);
    }
  };

  // ── Import JSON backup ─────────────────────────────────────────
  const handleImportJSON = async () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Import Backup?\n\nThis will REPLACE all current data with the backup file contents. Export your current data first if needed.\n\nContinue?'
      );
      if (!confirmed) return;
    } else {
      await new Promise((resolve) => {
        Alert.alert(
          'Import Backup',
          'This will REPLACE all current data with the backup file. Export your current data first if needed.',
          [{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
           { text: 'Import', style: 'destructive', onPress: () => resolve(true) }]
        );
      });
    }
    setImportingData(true);
    try {
      if (Platform.OS === 'web') {
        // Web: file picker
        const result = await pickDataFile();
        if (!result.success) {
          if (result.error && result.error !== 'cancelled') window.alert('Import failed: ' + result.error);
          return;
        }
        await importDataFile(result.uri || result.path || '');
        window.alert('Import successful! Data has been restored. Relaunch the app to see updated data.');
      } else {
        const result = await pickDataFile();
        if (!result.success) {
          if (result.error && result.error !== 'cancelled') Alert.alert('Error', result.error);
          return;
        }
        await importDataFile(result.uri || result.path || '');
        Alert.alert('Import Successful', 'Data has been restored. Restart the app to see updated data.');
      }
    } catch (e) {
      console.error('Import error:', e);
      const msg = e.message || 'Import failed';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Import Failed', msg);
    } finally {
      setImportingData(false);
    }
  };

  const formatLastBackup = (iso) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const BACKUP_TIMES = ['00:00','06:00','08:00','10:00','12:00','18:00','20:00','22:00'];

  if (!form) return <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const prefix    = form.invoice_prefix || 'INV';
  const startNum  = form.invoice_counter != null ? form.invoice_counter + 1 : 1;
  const sampleNum = buildSampleNumber(prefix, startNum, numDigits);
  const nextNum   = buildSampleNumber(prefix, startNum + 1, numDigits);
  const user      = getCurrentUser();

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Settings</Text>
          {user?.email && <Text style={s.headerSub}>{user.email}</Text>}
        </View>
        {dirty && (
          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Icon name="check" size={14} color="#fff" /><Text style={s.saveBtnTxt}> Save</Text></>
            }
          </TouchableOpacity>
        )}
      </View>

      {/* ── Tab bar ── */}
      <View style={s.tabBarWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBar}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.tab, activeTab === t.key && s.tabActive]}
              onPress={() => setActiveTab(t.key)}
            >
              <Icon name={t.icon} size={13} color={activeTab === t.key ? COLORS.primary : COLORS.textMute} />
              <Text style={[s.tabTxt, activeTab === t.key && s.tabTxtActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={{flex:1}}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scroll}
      >

        {/* ════ BUSINESS ════ */}
        {activeTab === 'business' && (
          <>
            <SH icon="briefcase" title="Business Profile" />
            <Card>
              <FL label="Business Name *">
                <TextInput style={s.input} value={form.name||''} onChangeText={v=>set('name',v)} placeholder="Your business name" placeholderTextColor={COLORS.textMute} />
              </FL>
              <FL label="Address">
                <TextInput style={[s.input,{minHeight:72,textAlignVertical:'top'}]} value={form.address||''} onChangeText={v=>set('address',v)} placeholder="Full business address" placeholderTextColor={COLORS.textMute} multiline numberOfLines={3} />
              </FL>
              <View style={s.row}>
                <View style={{flex:1}}>
                  <FL label="Phone">
                    <TextInput style={s.input} value={form.phone||''} onChangeText={v=>set('phone',v)} placeholder="Mobile / landline" placeholderTextColor={COLORS.textMute} keyboardType="phone-pad" />
                  </FL>
                </View>
                <View style={{width:12}}/>
                <View style={{flex:1}}>
                  <FL label="Email">
                    <TextInput style={s.input} value={form.email||''} onChangeText={v=>set('email',v)} placeholder="email@business.com" placeholderTextColor={COLORS.textMute} keyboardType="email-address" autoCapitalize="none" />
                  </FL>
                </View>
              </View>
              <FL label="State">
                <TouchableOpacity style={[s.input,s.picker]} onPress={()=>{setStateSearch('');setStateModal(true);}}>
                  <Text style={form.state ? s.pickerTxt : s.pickerPlaceholder}>
                    {form.state ? `${form.state} (${form.state_code})` : 'Select state...'}
                  </Text>
                  <Icon name="chevron-down" size={15} color={COLORS.textMute} />
                </TouchableOpacity>
              </FL>
              <FL label="Website (optional)">
                <TextInput style={s.input} value={form.website||''} onChangeText={v=>set('website',v)} placeholder="https://yourbusiness.com" placeholderTextColor={COLORS.textMute} autoCapitalize="none" />
              </FL>
            </Card>
          </>
        )}

        {/* ════ INVOICE SETTINGS ════ */}
        {activeTab === 'invoice' && (
          <>
            <SH icon="file-text" title="Invoice Numbering" />
            <Card>
              {/* Prefix */}
              <FL label="Invoice Prefix">
                <TextInput
                  style={s.input}
                  value={form.invoice_prefix||'INV'}
                  onChangeText={v => { set('invoice_prefix', v.toUpperCase().replace(/[^A-Z0-9]/g,'')); }}
                  placeholder="INV"
                  placeholderTextColor={COLORS.textMute}
                  autoCapitalize="characters"
                  maxLength={8}
                />
              </FL>
              <Text style={s.hint}>Letters and numbers only. e.g. INV, BILL, 2025, OM</Text>

              {/* Number digits (padding) */}
              <FL label="Number of Digits">
                <View style={s.digitRow}>
                  {['3','4','5','6'].map(d => (
                    <TouchableOpacity
                      key={d}
                      style={[s.digitChip, numDigits===d && s.digitChipActive]}
                      onPress={() => { setNumDigits(d); setDirty(true); }}
                    >
                      <Text style={[s.digitChipTxt, numDigits===d && s.digitChipTxtActive]}>{d} digits</Text>
                      <Text style={[s.digitChipEx, numDigits===d && {color:COLORS.primary}]}>
                        ({pad(1, parseInt(d))})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </FL>
              <Text style={s.hint}>Controls how many zeros are padded. 4 digits = 0001, 5 digits = 00001</Text>

              {/* Start number */}
              <FL label="Start / Reset Counter From">
                <View style={s.row}>
                  <TextInput
                    style={[s.input, {flex:1}]}
                    value={String(form.invoice_counter||0)}
                    onChangeText={v => set('invoice_counter', parseInt(v)||0)}
                    placeholder="0"
                    placeholderTextColor={COLORS.textMute}
                    keyboardType="numeric"
                  />
                  <View style={{width:12}} />
                  <View style={{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:COLORS.dangerLight,borderRadius:RADIUS.md,padding:10}}>
                    <Text style={{fontSize:11,color:COLORS.danger,fontWeight:FONTS.bold}}>⚠ Changes counter</Text>
                    <Text style={{fontSize:10,color:COLORS.danger,marginTop:2}}>Save carefully</Text>
                  </View>
                </View>
              </FL>

              {/* Live preview */}
              <View style={s.previewBox}>
                <Text style={s.previewLabel}>Live Preview</Text>
                <View style={s.previewRow}>
                  <View style={s.previewItem}>
                    <Text style={s.previewCaption}>Next Invoice</Text>
                    <Text style={s.previewNum}>{sampleNum}</Text>
                  </View>
                  <Icon name="arrow-right" size={16} color={COLORS.textMute} />
                  <View style={s.previewItem}>
                    <Text style={s.previewCaption}>After that</Text>
                    <Text style={s.previewNum}>{nextNum}</Text>
                  </View>
                </View>
              </View>
            </Card>

            <SH icon="clipboard" title="Quotation Numbering" />
            <Card>
              <FL label="Quotation Prefix">
                <TextInput
                  style={s.input}
                  value={form.quote_prefix||'QUO'}
                  onChangeText={v => set('quote_prefix', v.toUpperCase().replace(/[^A-Z0-9]/g,''))}
                  placeholder="QUO"
                  placeholderTextColor={COLORS.textMute}
                  autoCapitalize="characters"
                  maxLength={8}
                />
              </FL>
              <View style={s.previewBox}>
                <Text style={s.previewLabel}>Preview</Text>
                <Text style={s.previewNum}>{(form.quote_prefix||'QUO')}-{pad((form.quote_counter||0)+1, parseInt(numDigits))}</Text>
              </View>
            </Card>

            <SH icon="settings" title="Invoice Defaults" />
            <Card>
              <ToggleRow
                label="Default Due Date"
                sub="Days after invoice date"
                right={
                  <View style={s.row}>
                    <TextInput
                      style={[s.input,{width:60,textAlign:'center',paddingVertical:8}]}
                      value={String(form.default_due_days||30)}
                      onChangeText={v => set('default_due_days', parseInt(v)||30)}
                      keyboardType="numeric"
                    />
                    <Text style={{fontSize:12,color:COLORS.textMute,marginLeft:6,alignSelf:'center'}}>days</Text>
                  </View>
                }
              />
              <ToggleRow
                label="Default Terms"
                sub="Pre-fill payment terms"
                right={null}
              />
              <TextInput
                style={[s.input,{minHeight:60,textAlignVertical:'top',margin:0}]}
                value={form.default_terms||'Payment due within 30 days.'}
                onChangeText={v=>set('default_terms',v)}
                multiline
                placeholderTextColor={COLORS.textMute}
              />
              <View style={{height:8}}/>
            </Card>
          </>
        )}

        {/* ════ GST & TAX ════ */}
        {activeTab === 'gst' && (
          <>
            <SH icon="percent" title="GST Details" />
            <Card>
              <FL label="GSTIN">
                <TextInput
                  style={s.input}
                  value={form.gstin||''}
                  onChangeText={v=>set('gstin',v.toUpperCase())}
                  placeholder="22AAAAA0000A1Z5"
                  placeholderTextColor={COLORS.textMute}
                  autoCapitalize="characters"
                  maxLength={15}
                />
              </FL>
              {form.gstin?.length > 0 && form.gstin.length !== 15 && (
                <View style={s.hintWarn}>
                  <Icon name="alert-circle" size={12} color={COLORS.warning} />
                  <Text style={s.hintWarnTxt}> GSTIN must be 15 characters ({form.gstin.length}/15)</Text>
                </View>
              )}
              {form.gstin?.length === 15 && (
                <View style={s.hintOk}>
                  <Icon name="check-circle" size={12} color={COLORS.success} />
                  <Text style={s.hintOkTxt}> GSTIN looks good</Text>
                </View>
              )}

              <View style={s.row}>
                <View style={{flex:1}}>
                  <FL label="PAN Number">
                    <TextInput style={s.input} value={form.pan||''} onChangeText={v=>set('pan',v.toUpperCase())} placeholder="AAAAA0000A" placeholderTextColor={COLORS.textMute} autoCapitalize="characters" maxLength={10} />
                  </FL>
                </View>
                <View style={{width:12}}/>
                <View style={{flex:1}}>
                  <FL label="State Code">
                    <TextInput style={[s.input,{backgroundColor:COLORS.bgDeep}]} value={form.state_code||''} editable={false} placeholder="Auto from state" placeholderTextColor={COLORS.textMute} />
                  </FL>
                </View>
              </View>

              <View style={s.infoBox}>
                <Icon name="info" size={13} color={COLORS.info} />
                <Text style={s.infoTxt}> GSTIN auto-detects intra/inter state supply when creating invoices. Your state code is set from the Business tab.</Text>
              </View>
            </Card>
          </>
        )}

        {/* ════ BANK / UPI ════ */}
        {activeTab === 'bank' && (
          <>
            <SH icon="credit-card" title="Bank Details" />
            <Card>
              <FL label="Bank Name">
                <TextInput style={s.input} value={form.bank_name||''} onChangeText={v=>set('bank_name',v)} placeholder="e.g. State Bank of India" placeholderTextColor={COLORS.textMute} />
              </FL>
              <View style={s.row}>
                <View style={{flex:1}}>
                  <FL label="Account Number">
                    <TextInput style={s.input} value={form.account_no||''} onChangeText={v=>set('account_no',v)} placeholder="Account number" placeholderTextColor={COLORS.textMute} keyboardType="numeric" />
                  </FL>
                </View>
                <View style={{width:12}}/>
                <View style={{flex:1}}>
                  <FL label="IFSC Code">
                    <TextInput style={s.input} value={form.ifsc||''} onChangeText={v=>set('ifsc',v.toUpperCase())} placeholder="SBIN0001234" placeholderTextColor={COLORS.textMute} autoCapitalize="characters" maxLength={11} />
                  </FL>
                </View>
              </View>
              <View style={s.infoBox}>
                <Icon name="info" size={13} color={COLORS.info} />
                <Text style={s.infoTxt}> Bank details appear on PDF invoices so customers can pay directly.</Text>
              </View>
            </Card>

            <SH icon="smartphone" title="UPI & QR Code" />
            <Card>
              <FL label="UPI ID">
                <TextInput
                  style={s.input}
                  value={form.upi_id||''}
                  onChangeText={v=>set('upi_id',v)}
                  placeholder="9876543210@paytm or name@okaxis"
                  placeholderTextColor={COLORS.textMute}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </FL>
              <ToggleRow
                label="Show QR Code on Invoice"
                sub="Customers scan and pay directly from PDF"
                right={
                  <Switch
                    value={!!form.show_upi_qr}
                    onValueChange={v=>set('show_upi_qr',v)}
                    trackColor={{false:COLORS.border,true:COLORS.primary}}
                    thumbColor="#fff"
                  />
                }
              />
              {form.upi_id && form.show_upi_qr && (
                <View style={s.hintOk}>
                  <Icon name="check-circle" size={13} color={COLORS.success} />
                  <Text style={s.hintOkTxt}> UPI QR will appear on invoices — {form.upi_id}</Text>
                </View>
              )}
              {form.show_upi_qr && !form.upi_id && (
                <View style={s.hintWarn}>
                  <Icon name="alert-triangle" size={13} color={COLORS.warning} />
                  <Text style={s.hintWarnTxt}> Enter your UPI ID above to enable QR code</Text>
                </View>
              )}
            </Card>
          </>
        )}

        {/* ════ DATA ════ */}
        {activeTab === 'data' && (
          <>
            {/* Export with date filter */}
            <SH icon="download" title="Export Data" />
            <Card>
              <Text style={s.cardDesc}>
                Export your data as a JSON file. Use date filters to export only a specific period. Leave blank to export everything.
              </Text>
              <View style={s.row}>
                <View style={{flex:1}}>
                  <FL label="From Date (optional)">
                    <TextInput style={s.input} value={exportFrom} onChangeText={setExportFrom} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMute} />
                  </FL>
                </View>
                <View style={{width:12}}/>
                <View style={{flex:1}}>
                  <FL label="To Date (optional)">
                    <TextInput style={s.input} value={exportTo} onChangeText={setExportTo} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMute} />
                  </FL>
                </View>
              </View>
              <TouchableOpacity
                style={[s.actionBtn, s.actionBtnPrimary, exportingData && {opacity:0.5}]}
                onPress={handleExportFiltered}
                disabled={exportingData}
              >
                {exportingData
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Icon name="download" size={14} color="#fff" /><Text style={s.actionBtnTxt}> Export JSON Backup</Text></>
                }
              </TouchableOpacity>
              <Text style={[s.hint, {marginTop:6}]}>File downloads to your Downloads folder. Use this to backup or transfer your data.</Text>
            </Card>

            <SH icon="upload" title="Import Data from JSON" />
            <Card>
              <Text style={s.cardDesc}>
                Restore data from a previously exported LOCAS JSON backup file. Use this when switching to a new device.
              </Text>
              <View style={s.infoBox}>
                <Icon name="info" size={13} color={COLORS.info} />
                <Text style={s.infoTxt}> This will replace ALL current data with the backup file contents. Export your current data first if needed.</Text>
              </View>
              <TouchableOpacity
                style={[s.actionBtn, s.actionBtnSecondary, importingData && {opacity:0.5}]}
                onPress={handleImportJSON}
                disabled={importingData}
              >
                {importingData
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Icon name="upload" size={14} color="#fff" /><Text style={s.actionBtnTxt}> Select JSON Backup File</Text></>
                }
              </TouchableOpacity>
              <Text style={[s.hint, {marginTop:6}]}>
                Tip: After importing on a new device, contact support to release your old device slot from the license.
              </Text>
            </Card>

            {/* Delete data by date range */}
            <SH icon="trash-2" title="Delete Data by Date Range" />
            <Card>
              <View style={s.dangerBanner}>
                <Icon name="alert-triangle" size={15} color="#92400E" />
                <Text style={s.dangerBannerTxt}>
                  Permanently deletes invoices, expenses, and quotations in the date range. <Text style={{fontWeight:FONTS.bold}}>Export first!</Text>
                </Text>
              </View>
              <View style={s.row}>
                <View style={{flex:1}}>
                  <FL label="Delete From">
                    <TextInput style={[s.input,{borderColor:COLORS.danger}]} value={deleteFrom} onChangeText={setDeleteFrom} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMute} />
                  </FL>
                </View>
                <View style={{width:12}}/>
                <View style={{flex:1}}>
                  <FL label="Delete To">
                    <TextInput style={[s.input,{borderColor:COLORS.danger}]} value={deleteTo} onChangeText={setDeleteTo} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMute} />
                  </FL>
                </View>
              </View>
              <TouchableOpacity
                style={[s.actionBtn, s.actionBtnDanger, deletingData && {opacity:0.5}]}
                onPress={handleDeleteByDateRange}
                disabled={deletingData || !deleteFrom || !deleteTo}
              >
                {deletingData
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Icon name="trash-2" size={14} color="#fff" /><Text style={s.actionBtnTxt}> Delete Data in Range</Text></>
                }
              </TouchableOpacity>
            </Card>

            {/* Data location info */}
            <SH icon="database" title="Storage Info" />
            <Card>
              <InfoRow label="Storage"  value="Browser IndexedDB" />
              <InfoRow label="Key"      value="locas" />
              <InfoRow label="Platform" value={Platform.OS} />
              <View style={s.infoBox}>
                <Icon name="info" size={13} color={COLORS.info} />
                <Text style={s.infoTxt}> Data is stored locally in your browser. It persists across sessions but is tied to this device/browser. Export regularly for safety.</Text>
              </View>
            </Card>
          </>
        )}

        {/* ════ BACKUP ════ */}
        {activeTab === 'backup' && (
          <>
            <SH icon="cloud" title="Google Drive Backup" />
            <Card>
              {driveEmail ? (
                <>
                  <View style={s.connectedRow}>
                    <View style={s.connectedDot} />
                    <View style={{flex:1}}>
                      <Text style={s.connectedEmail}>{driveEmail}</Text>
                      <Text style={s.connectedLast}>Last backup: {formatLastBackup(lastBackup)}</Text>
                    </View>
                    <TouchableOpacity style={s.disconnectBtn} onPress={handleDisconnect}>
                      <Text style={s.disconnectTxt}>Disconnect</Text>
                    </TouchableOpacity>
                  </View>

                  <ToggleRow
                    label="Daily Backup Time"
                    sub="Auto backup runs once per day"
                    right={
                      <TouchableOpacity style={s.timeChip} onPress={() => setTimeModal(true)}>
                        <Icon name="clock" size={13} color={COLORS.primary} />
                        <Text style={s.timeChipTxt}>{backupTime}</Text>
                      </TouchableOpacity>
                    }
                  />

                  <View style={s.backupBtns}>
                    <TouchableOpacity style={[s.actionBtn,s.actionBtnPrimary,{flex:1},syncing&&{opacity:0.5}]} onPress={handleSync} disabled={syncing}>
                      {syncing ? <ActivityIndicator size="small" color="#fff" /> : <><Icon name="upload-cloud" size={14} color="#fff" /><Text style={s.actionBtnTxt}> Backup Now</Text></>}
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.actionBtn,s.actionBtnOutline,{flex:1},restoring&&{opacity:0.5}]} onPress={handleRestore} disabled={restoring}>
                      {restoring ? <ActivityIndicator size="small" color={COLORS.primary} /> : <><Icon name="download-cloud" size={14} color={COLORS.primary} /><Text style={[s.actionBtnTxt,{color:COLORS.primary}]}> Restore</Text></>}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={s.cardDesc}>Connect Google Drive to automatically backup your data daily. Restore anytime after reinstalling.</Text>
                  <TouchableOpacity style={[s.actionBtn,s.actionBtnSecondary]} onPress={() => promptAsync()} disabled={!request}>
                    <Icon name="link" size={14} color="#fff" />
                    <Text style={s.actionBtnTxt}> Connect Google Drive</Text>
                  </TouchableOpacity>
                </>
              )}
            </Card>
          </>
        )}

        {/* ════ ABOUT ════ */}
        {activeTab === 'about' && (
          <>
            <SH icon="info" title="App Info" />
            <Card>
              <InfoRow label="App"      value="LOCAS Billing" />
              <InfoRow label="Version"  value={version} />
              <InfoRow label="GST"      value="CGST / SGST / IGST" />
              <InfoRow label="Storage"  value="Local IndexedDB" />
              <InfoRow label="Account"  value={user?.email || '—'} last />
            </Card>

            <SH icon="shield" title="Account" />
            <Card>
              <InfoRow label="Signed in as" value={user?.email || '—'} last />
            </Card>

            {/* Sign out */}
            <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
              <Icon name="log-out" size={16} color={COLORS.danger} />
              <View style={{flex:1, marginLeft:12}}>
                <Text style={s.signOutTitle}>Sign Out</Text>
                <Text style={s.signOutSub}>You will be asked to confirm</Text>
              </View>
              <Icon name="chevron-right" size={16} color={COLORS.danger} />
            </TouchableOpacity>
          </>
        )}

        {/* Floating save button when dirty */}
        {dirty && (
          <TouchableOpacity
            style={[s.floatSave, saving && {opacity:0.5}]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <><Icon name="save" size={16} color="#fff" /><Text style={s.floatSaveTxt}> Save Changes</Text></>
            }
          </TouchableOpacity>
        )}

        <View style={{height:80}} />
      </ScrollView>

      {/* State picker modal */}
      {stateModal && (
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Select State</Text>
              <TouchableOpacity onPress={() => setStateModal(false)} style={{padding:4}}>
                <Icon name="x" size={18} color={COLORS.textMute} />
              </TouchableOpacity>
            </View>
            <View style={s.sheetSearch}>
              <Icon name="search" size={15} color={COLORS.textMute} />
              <TextInput style={s.sheetSearchInput} value={stateSearch} onChangeText={setStateSearch} placeholder="Search state..." placeholderTextColor={COLORS.textMute} autoFocus />
            </View>
            <FlatList
              data={filteredStates}
              keyExtractor={s => s.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({item}) => (
                <TouchableOpacity style={s.sheetItem} onPress={() => selectState(item)}>
                  <Text style={s.sheetItemName}>{item.name}</Text>
                  <Text style={s.sheetItemCode}>{item.code}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      )}

      {/* Backup time modal */}
      {timeModal && (
        <Modal transparent animationType="slide" onRequestClose={() => setTimeModal(false)}>
          <View style={s.overlay}>
            <View style={s.sheet}>
              <View style={s.sheetHeader}>
                <Text style={s.sheetTitle}>Daily Backup Time</Text>
                <TouchableOpacity onPress={() => setTimeModal(false)} style={{padding:4}}>
                  <Icon name="x" size={18} color={COLORS.textMute} />
                </TouchableOpacity>
              </View>
              {BACKUP_TIMES.map(t => (
                <TouchableOpacity key={t} style={s.sheetItem} onPress={async () => {
                  await setBackupTime(t);
                  setBackupTimeVal(t);
                  setTimeModal(false);
                }}>
                  <Text style={[s.sheetItemName, backupTime===t&&{color:COLORS.primary,fontWeight:FONTS.bold}]}>{t}</Text>
                  {backupTime===t && <Icon name="check" size={15} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────
function SH({ icon, title }) {
  return (
    <View style={s.sectionHead}>
      <View style={s.sectionIcon}><Icon name={icon} size={14} color={COLORS.primary} /></View>
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}
function Card({ children }) {
  return <View style={s.card}>{children}</View>;
}
function FL({ label, children }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}
function ToggleRow({ label, sub, right }) {
  return (
    <View style={s.toggleRow}>
      <View style={{flex:1}}>
        <Text style={s.toggleLabel}>{label}</Text>
        {sub && <Text style={s.toggleSub}>{sub}</Text>}
      </View>
      {right}
    </View>
  );
}
function InfoRow({ label, value, last }) {
  return (
    <View style={[s.infoRow, !last && s.infoRowBorder]}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.bg },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:     { padding: 14, paddingBottom: 40 },

  // Header
  header:      { flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:13, backgroundColor:COLORS.card, borderBottomWidth:1, borderBottomColor:COLORS.border },
  backBtn:     { padding:4, marginRight:10 },
  headerTitle: { fontSize:19, fontWeight:FONTS.black, color:COLORS.text },
  headerSub:   { fontSize:10, color:COLORS.textMute, marginTop:1 },
  saveBtn:     { flexDirection:'row', alignItems:'center', backgroundColor:COLORS.primary, paddingHorizontal:14, paddingVertical:9, borderRadius:RADIUS.md },
  saveBtnTxt:  { color:'#fff', fontWeight:FONTS.bold, fontSize:13 },

  // Tab bar
  tabBarWrap:  { backgroundColor:COLORS.card, borderBottomWidth:1, borderBottomColor:COLORS.border },
  tabBar:      { paddingHorizontal:12, paddingVertical:0, gap:0 },
  tab:         { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:14, paddingVertical:11, borderBottomWidth:2.5, borderBottomColor:'transparent' },
  tabActive:   { borderBottomColor:COLORS.primary },
  tabTxt:      { fontSize:12, fontWeight:FONTS.medium, color:COLORS.textMute },
  tabTxtActive:{ color:COLORS.primary, fontWeight:FONTS.bold },

  // Section head
  sectionHead:  { flexDirection:'row', alignItems:'center', gap:8, marginTop:18, marginBottom:8 },
  sectionIcon:  { width:26, height:26, borderRadius:8, backgroundColor:COLORS.primaryLight, alignItems:'center', justifyContent:'center' },
  sectionTitle: { fontSize:13, fontWeight:FONTS.bold, color:COLORS.text, textTransform:'uppercase', letterSpacing:0.5 },

  // Card
  card: { backgroundColor:COLORS.card, borderRadius:RADIUS.lg, borderWidth:1, borderColor:COLORS.border, padding:16, marginBottom:8 },
  cardDesc: { fontSize:13, color:COLORS.textSub, lineHeight:19, marginBottom:12 },

  // Fields
  fieldWrap:  { marginBottom:12 },
  fieldLabel: { fontSize:11, fontWeight:FONTS.bold, color:COLORS.textSub, textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 },
  input:      { backgroundColor:COLORS.bg, borderWidth:1, borderColor:COLORS.border, borderRadius:RADIUS.md, paddingHorizontal:12, paddingVertical:11, fontSize:14, color:COLORS.text },
  picker:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  pickerTxt:  { fontSize:14, color:COLORS.text, flex:1 },
  pickerPlaceholder: { fontSize:14, color:COLORS.textMute, flex:1 },
  row:        { flexDirection:'row', alignItems:'flex-start' },
  hint:       { fontSize:11, color:COLORS.textMute, marginTop:4, lineHeight:16 },

  // Invoice digits
  digitRow:      { flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:4 },
  digitChip:     { paddingHorizontal:14, paddingVertical:9, borderRadius:RADIUS.md, backgroundColor:COLORS.bg, borderWidth:1, borderColor:COLORS.border, alignItems:'center' },
  digitChipActive:{ backgroundColor:COLORS.primaryLight, borderColor:COLORS.primary },
  digitChipTxt:  { fontSize:12, fontWeight:FONTS.semibold, color:COLORS.textSub },
  digitChipTxtActive: { color:COLORS.primary, fontWeight:FONTS.bold },
  digitChipEx:   { fontSize:10, color:COLORS.textMute, marginTop:2 },

  // Invoice preview
  previewBox:    { backgroundColor:'#F8FAFF', borderRadius:RADIUS.md, padding:14, borderWidth:1, borderColor:COLORS.primaryLight, marginTop:4 },
  previewLabel:  { fontSize:10, fontWeight:FONTS.bold, color:COLORS.textSub, textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 },
  previewRow:    { flexDirection:'row', alignItems:'center', gap:12 },
  previewItem:   { flex:1, alignItems:'center' },
  previewCaption:{ fontSize:10, color:COLORS.textMute, marginBottom:4 },
  previewNum:    { fontSize:18, fontWeight:FONTS.black, color:COLORS.primary },

  // Toggle row
  toggleRow:    { flexDirection:'row', alignItems:'center', gap:10, paddingVertical:12, borderTopWidth:1, borderTopColor:COLORS.border, marginTop:4 },
  toggleLabel:  { fontSize:14, fontWeight:FONTS.medium, color:COLORS.text },
  toggleSub:    { fontSize:11, color:COLORS.textMute, marginTop:1 },

  // Info / hint boxes
  infoBox:     { flexDirection:'row', alignItems:'flex-start', gap:6, backgroundColor:COLORS.infoLight, borderRadius:RADIUS.sm, padding:10, marginTop:8 },
  infoTxt:     { flex:1, fontSize:12, color:COLORS.info, lineHeight:17 },
  hintWarn:    { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:COLORS.warningBg, borderRadius:RADIUS.sm, padding:8, marginTop:6 },
  hintWarnTxt: { fontSize:12, color:COLORS.warning, flex:1 },
  hintOk:      { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:COLORS.successBg, borderRadius:RADIUS.sm, padding:8, marginTop:6 },
  hintOkTxt:   { fontSize:12, color:COLORS.success, flex:1 },
  dangerBanner:{ flexDirection:'row', alignItems:'flex-start', gap:8, backgroundColor:'#FEF3C7', borderRadius:RADIUS.sm, padding:10, marginBottom:12, borderWidth:1, borderColor:'#FDE68A' },
  dangerBannerTxt: { flex:1, fontSize:12, color:'#92400E', lineHeight:17 },

  // Info rows
  infoRow:     { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:11 },
  infoRowBorder:{ borderBottomWidth:1, borderBottomColor:COLORS.border },
  infoLabel:   { fontSize:13, color:COLORS.textSub },
  infoValue:   { fontSize:13, fontWeight:FONTS.semibold, color:COLORS.text, maxWidth:'60%', textAlign:'right' },

  // Action buttons
  actionBtn:       { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:7, paddingVertical:13, borderRadius:RADIUS.md, marginTop:10 },
  actionBtnPrimary:{ backgroundColor:COLORS.primary },
  actionBtnDanger: { backgroundColor:COLORS.danger },
  actionBtnSecondary: { backgroundColor:COLORS.secondary },
  actionBtnOutline:{ borderWidth:1.5, borderColor:COLORS.primary, backgroundColor:'transparent' },
  actionBtnTxt:    { color:'#fff', fontWeight:FONTS.bold, fontSize:13 },

  // Backup
  connectedRow:  { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:COLORS.successLight, borderRadius:RADIUS.md, padding:12, marginBottom:4 },
  connectedDot:  { width:8, height:8, borderRadius:4, backgroundColor:COLORS.success, flexShrink:0 },
  connectedEmail:{ fontSize:13, fontWeight:FONTS.semibold, color:COLORS.success },
  connectedLast: { fontSize:11, color:COLORS.success, opacity:0.7, marginTop:1 },
  disconnectBtn: { paddingHorizontal:10, paddingVertical:5, borderRadius:RADIUS.sm, backgroundColor:'rgba(220,38,38,0.1)' },
  disconnectTxt: { fontSize:11, fontWeight:FONTS.bold, color:COLORS.danger },
  timeChip:      { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:12, paddingVertical:7, borderRadius:RADIUS.md, backgroundColor:COLORS.primaryLight, borderWidth:1, borderColor:COLORS.primary },
  timeChipTxt:   { fontSize:13, fontWeight:FONTS.bold, color:COLORS.primary },
  backupBtns:    { flexDirection:'row', gap:10, marginTop:4 },

  // Sign out
  signOutBtn:  { flexDirection:'row', alignItems:'center', backgroundColor:COLORS.dangerLight, borderRadius:RADIUS.lg, padding:16, marginTop:8, borderWidth:1, borderColor:'#FECACA' },
  signOutTitle:{ fontSize:15, fontWeight:FONTS.bold, color:COLORS.danger },
  signOutSub:  { fontSize:11, color:COLORS.danger, opacity:0.7, marginTop:1 },

  // Floating save
  floatSave:   { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:COLORS.primary, paddingVertical:14, borderRadius:RADIUS.lg, marginTop:16 },
  floatSaveTxt:{ color:'#fff', fontWeight:FONTS.black, fontSize:15 },

  // Bottom sheet overlay
  overlay:       { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(15,23,42,0.6)', justifyContent:'flex-end' },
  sheet:         { backgroundColor:COLORS.card, borderTopLeftRadius:RADIUS.xxl, borderTopRightRadius:RADIUS.xxl, maxHeight:'75%' },
  sheetHeader:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingVertical:16, borderBottomWidth:1, borderBottomColor:COLORS.border },
  sheetTitle:    { fontSize:17, fontWeight:FONTS.black, color:COLORS.text },
  sheetSearch:   { flexDirection:'row', alignItems:'center', gap:8, margin:12, paddingHorizontal:12, height:42, backgroundColor:COLORS.bg, borderRadius:RADIUS.md, borderWidth:1, borderColor:COLORS.border },
  sheetSearchInput: { flex:1, fontSize:14, color:COLORS.text },
  sheetItem:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingVertical:14, borderBottomWidth:1, borderBottomColor:COLORS.border },
  sheetItemName: { fontSize:14, color:COLORS.text, fontWeight:FONTS.medium },
  sheetItemCode: { fontSize:12, color:COLORS.textMute, backgroundColor:COLORS.bgDeep, paddingHorizontal:8, paddingVertical:3, borderRadius:RADIUS.sm },
});