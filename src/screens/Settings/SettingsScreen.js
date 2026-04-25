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
import { clearLicense } from '../../utils/licenseSystem';
import { exportDataFile, getDataStorageInfo, pickDataFile, importDataFile, openDataFolder } from '../../utils/dataFileManager';
import { INDIAN_STATES } from '../../utils/gst';
import { COLORS, RADIUS, FONTS } from '../../theme';

const isNative = Platform.OS !== 'web';

const { expo: { version } } = require('../../../app.json');

// Padding helpers
const pad = (n, len = 4) => String(n).padStart(len, '0');

// Build a sample invoice number from prefix + separator + counter + padding
function buildSampleNumber(prefix, startNum, numDigits, separator) {
  const p   = (prefix || 'INV').toUpperCase();
  const n   = parseInt(startNum) || 1;
  const d   = parseInt(numDigits) || 4;
  const sep = separator !== undefined ? separator : '-';
  return `${p}${sep}${pad(n, d)}`;
}

// SETTINGS TABS
const TABS = [
  { key: 'business',  label: 'Business',  icon: 'briefcase'   },
  { key: 'invoice',   label: 'Invoice',   icon: 'file-text'   },
  { key: 'gst',       label: 'GST & Tax', icon: 'percent'     },
  { key: 'bank',      label: 'Bank / UPI',icon: 'credit-card' },
  { key: 'data',      label: 'Data',      icon: 'database'    },
  { key: 'about',     label: 'About',     icon: 'info'        },
];

export default function SettingsScreen({ navigation, route }) {
  const onLogout = route?.params?.onLogout;
  const insets = useSafeAreaInsets();
  const [form, setForm]           = useState(null);
  const [saving, setSaving]       = useState(false);
  const [dirty, setDirty]         = useState(false);
  const [activeTab, setActiveTab] = useState('business');
  const [stateModal, setStateModal]   = useState(false);
  const [stateSearch, setStateSearch] = useState('');

  // Invoice numbering
  const [numDigits, setNumDigits]           = useState('4');
  const [invoiceSeparator, setInvoiceSep]   = useState('-');



  // Data export / delete
  const [exportingData, setExportingData] = useState(false);
  const [importingData, setImportingData] = useState(false);
  const [exportFrom, setExportFrom]       = useState('');
  const [exportTo, setExportTo]           = useState('');
  const [exportPassword, setExportPassword] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [deleteFrom, setDeleteFrom]       = useState('');
  const [deleteTo, setDeleteTo]           = useState('');
  const [deletingData, setDeletingData]   = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus,   setUpdateStatus]   = useState(null); // 'latest' | 'found' | 'error'

  const load = async () => {
    try {
      const p = await getProfile();
      setForm({ ...p, show_upi_qr: !!p.show_upi_qr });
      // Detect current padding from existing prefix
      setNumDigits(String(p.invoice_num_digits || 4));
      setInvoiceSep(p.invoice_separator !== undefined ? p.invoice_separator : '-');
      setDirty(false);
    } catch (e) { console.error(e); }
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
      await saveProfile({ ...form, invoice_num_digits: parseInt(numDigits) || 4, invoice_separator: invoiceSeparator });
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






  // ── Sign out ───────────────────────────────────────────────────
  const handleSignOut = () => {
    const doSignOut = async () => {
      try {
        await clearLicense();      // wipe local license + device cache
        await firebaseSignOut();   // sign out of Firebase Auth
      } catch (e) {
        console.warn('Sign out error:', e.message);
      } finally {
        onLogout?.();              // tell App.js → setPhase('login')
      }
    };
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

  // ── Data export — encrypted .lbk (Electron) or JSON (browser) ──
  const handleExportFiltered = async () => {
    const IS_ELECTRON = typeof window !== 'undefined' && !!window.electronAPI?.db;

    if (IS_ELECTRON && !exportPassword.trim()) {
      Alert.alert('Password Required', 'Enter your account password to encrypt the backup. Only you can open it on the new device.');
      return;
    }

    setExportingData(true);
    try {
      const email = getCurrentUser()?.email || '';
      const result = await exportDataFile({
        email,
        password: exportPassword.trim(),
        fromDate: exportFrom || null,
        toDate:   exportTo   || null,
      });

      if (result.success === false && result.reason === 'canceled') return;

      if (result.success) {
        if (IS_ELECTRON) {
          Alert.alert('Backup Saved ✓',
            `Your encrypted backup has been saved.\n\nOnly you (${email}) can restore it — it is locked with your password.`);
          setExportPassword('');
        } else {
          window.alert(`Exported: ${result.filename}`);
        }
      } else {
        Alert.alert('Export Failed', result.reason || 'Unknown error');
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

  // ── Import .lbk backup (Electron) or JSON (browser) ───────────
  const handleImportJSON = async () => {
    const IS_ELECTRON = typeof window !== 'undefined' && !!window.electronAPI?.db;

    if (IS_ELECTRON && !importPassword.trim()) {
      Alert.alert('Password Required', 'Enter your account password to decrypt the backup file.');
      return;
    }

    // Confirm before wiping current data
    const confirmed = await new Promise((resolve) => {
      if (Platform.OS === 'web') {
        resolve(window.confirm('Import Backup?\n\nThis will REPLACE all current data. Export first if needed.\n\nContinue?'));
      } else {
        Alert.alert(
          'Import Backup',
          'This will REPLACE all current data with the backup file. Export your current data first if needed.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Import', style: 'destructive', onPress: () => resolve(true) },
          ]
        );
      }
    });
    if (!confirmed) return;

    setImportingData(true);
    try {
      const result = await importDataFile(IS_ELECTRON ? importPassword.trim() : null);

      if (!result || (result.reason === 'canceled')) return;

      if (result.success) {
        setImportPassword('');
        Alert.alert('Restored ✓',
          `All data has been restored for ${result.ownerEmail || 'your account'}.\n\nPlease restart Locas to see your data.`);
      } else if (result.reason === 'wrong_password') {
        Alert.alert('Wrong Password', result.message || 'Incorrect password. This backup file belongs to a different account or the password is wrong.');
      } else if (result.reason === 'invalid_file') {
        Alert.alert('Invalid File', result.message || 'This is not a valid Locas backup file.');
      } else {
        Alert.alert('Import Failed', result.message || 'Unknown error occurred.');
      }
    } catch (e) {
      console.error('Import error:', e);
      Alert.alert('Import Failed', e.message);
    } finally {
      setImportingData(false);
    }
  };

  // ── Manual check for update ─────────────────────────────────────
  const handleCheckUpdate = async () => {
    if (typeof window === 'undefined' || !window.electronAPI) {
      setUpdateStatus('error');
      setTimeout(() => setUpdateStatus(null), 3000);
      return;
    }
    setCheckingUpdate(true);
    setUpdateStatus(null);

    // Collect cleanup fns so we can remove ALL listeners once the first result arrives.
    // Without this, every button click stacks another set of listeners — causing
    // duplicate events and false "check internet" errors.
    const cleanups = [];
    let settled = false;

    const done = (status) => {
      if (settled) return; // ignore subsequent events from stale listeners
      settled = true;
      setUpdateStatus(status);
      setCheckingUpdate(false);
      setTimeout(() => setUpdateStatus(null), status === 'found' ? 8000 : 4000);
      cleanups.forEach(fn => fn && fn()); // remove all registered listeners
    };

    cleanups.push(window.electronAPI.onUpdateAlreadyLatest(() => done('latest')));
    cleanups.push(window.electronAPI.onUpdateDownloading(() => done('found')));
    cleanups.push(window.electronAPI.onUpdateReady(() => done('found')));
    cleanups.push(window.electronAPI.onUpdateError(() => done('error')));

    // Tell main process to check + download
    window.electronAPI.checkForUpdate();

    // Safety timeout — if no event fires in 15s, clear spinner and listeners
    setTimeout(() => done('error'), 15000);
  };



  const BACKUP_TIMES = ['00:00','06:00','08:00','10:00','12:00','18:00','20:00','22:00'];

  if (!form) return <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const prefix    = form.invoice_prefix || 'INV';
  const startNum  = form.invoice_counter != null ? form.invoice_counter + 1 : 1;
  const sampleNum = buildSampleNumber(prefix, startNum, numDigits, invoiceSeparator);
  const nextNum   = buildSampleNumber(prefix, startNum + 1, numDigits, invoiceSeparator);
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
                  onChangeText={v => { set('invoice_prefix', v.toUpperCase().replace(/[^A-Z0-9\-\/]/g,'')); }}
                  placeholder="INV"
                  placeholderTextColor={COLORS.textMute}
                  autoCapitalize="characters"
                  maxLength={10}
                />
              </FL>
              <Text style={s.hint}>Letters and numbers only. e.g. INV, BILL, 2526, OM</Text>
              <Text style={[s.hint, {marginTop:2, color: COLORS.primary}]}>
                💡 For financial year format use prefix like <Text style={{fontWeight:FONTS.bold}}>2526</Text> → 2526/00001
              </Text>

              {/* Separator */}
              <FL label="Separator">
                <View style={s.digitRow}>
                  {[
                    { val: '-',  label: 'Dash',    ex: 'INV-0001'  },
                    { val: '/',  label: 'Slash',   ex: 'INV/0001'  },
                    { val: '.',  label: 'Dot',     ex: 'INV.0001'  },
                    { val: '_',  label: 'Underscore', ex: 'INV_0001' },
                    { val: '',   label: 'None',    ex: 'INV0001'   },
                  ].map(opt => (
                    <TouchableOpacity
                      key={opt.val + 'sep'}
                      style={[s.digitChip, invoiceSeparator === opt.val && s.digitChipActive]}
                      onPress={() => { setInvoiceSep(opt.val); set('invoice_separator', opt.val); }}
                    >
                      <Text style={[s.digitChipTxt, invoiceSeparator === opt.val && s.digitChipTxtActive]}>{opt.label}</Text>
                      <Text style={[s.digitChipEx, invoiceSeparator === opt.val && {color:COLORS.primary}]}>{opt.ex}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </FL>

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
                Export all your data as an encrypted backup file (.lbk). Only you can restore it — it is locked with your password. Use date filters to export a specific period only.
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
              <FL label="Your Account Password *">
                <TextInput
                  style={s.input}
                  value={exportPassword}
                  onChangeText={setExportPassword}
                  placeholder="Enter your login password to encrypt the file"
                  placeholderTextColor={COLORS.textMute}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </FL>
              <TouchableOpacity
                style={[s.actionBtn, s.actionBtnPrimary, exportingData && {opacity:0.5}]}
                onPress={handleExportFiltered}
                disabled={exportingData}
              >
                {exportingData
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Icon name="download" size={14} color="#fff" /><Text style={s.actionBtnTxt}> Export Encrypted Backup (.lbk)</Text></>
                }
              </TouchableOpacity>
              <Text style={[s.hint, {marginTop:6}]}>Backup saves to your Downloads folder. The file is encrypted — only you can restore it with your password.</Text>
            </Card>

            <SH icon="upload" title="Restore from Backup" />
            <Card>
              <Text style={s.cardDesc}>
                Restore from a .lbk backup file. Select the file and enter the password you used when exporting. Use this when switching to a new device.
              </Text>
              <View style={s.infoBox}>
                <Icon name="info" size={13} color={COLORS.info} />
                <Text style={s.infoTxt}> This will replace ALL current data with the backup. Export first if needed.</Text>
              </View>
              <FL label="Your Account Password *">
                <TextInput
                  style={s.input}
                  value={importPassword}
                  onChangeText={setImportPassword}
                  placeholder="Password you used when exporting"
                  placeholderTextColor={COLORS.textMute}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </FL>
              <TouchableOpacity
                style={[s.actionBtn, s.actionBtnSecondary, importingData && {opacity:0.5}]}
                onPress={handleImportJSON}
                disabled={importingData}
              >
                {importingData
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Icon name="upload" size={14} color={COLORS.primary} /><Text style={[s.actionBtnTxt, {color:COLORS.primary}]}> Select Backup File (.lbk)</Text></>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, {backgroundColor: COLORS.bg, borderWidth:1, borderColor: COLORS.border, marginTop:8}]}
                onPress={() => openDataFolder()}
              >
                <Icon name="folder" size={14} color={COLORS.textSub} />
                <Text style={[s.actionBtnTxt, {color: COLORS.textSub}]}> Open Data Folder</Text>
              </TouchableOpacity>
              <Text style={[s.hint, {marginTop:6}]}>
                Opens the .locas-data folder where your data files are stored next to Locas.exe.
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

            {/* Check for Updates */}
            <SH icon="download" title="Updates" />
            <Card>
              <InfoRow label="Current Version" value={version} />
              <View style={{marginTop:10}}>
                <TouchableOpacity
                  style={[s.actionBtn, s.actionBtnPrimary, checkingUpdate && {opacity:0.5}]}
                  onPress={handleCheckUpdate}
                  disabled={checkingUpdate}
                >
                  {checkingUpdate
                    ? <><ActivityIndicator size="small" color="#fff" /><Text style={s.actionBtnTxt}> Checking...</Text></>
                    : <><Icon name="download" size={14} color="#fff" /><Text style={s.actionBtnTxt}> Check for Updates</Text></>
                  }
                </TouchableOpacity>
                {updateStatus === 'latest' && (
                  <View style={[s.infoBox, {marginTop:8, backgroundColor:'#F0FDF4', borderColor:'#86EFAC'}]}>
                    <Icon name="check-circle" size={13} color="#16A34A" />
                    <Text style={[s.infoTxt, {color:'#15803D'}]}> You are on the latest version ({version})</Text>
                  </View>
                )}
                {updateStatus === 'found' && (
                  <View style={[s.infoBox, {marginTop:8, backgroundColor:'#FFF7ED', borderColor:'#FED7AA'}]}>
                    <Icon name="download" size={13} color="#EA580C" />
                    <Text style={[s.infoTxt, {color:'#C2410C'}]}> New update found! Downloading in background — check the dashboard banner.</Text>
                  </View>
                )}
                {updateStatus === 'error' && (
                  <View style={[s.infoBox, {marginTop:8, backgroundColor:'#FEF2F2', borderColor:'#FECACA'}]}>
                    <Icon name="alert-triangle" size={13} color="#DC2626" />
                    <Text style={[s.infoTxt, {color:'#991B1B'}]}> Could not check for updates. Check your internet connection.</Text>
                  </View>
                )}
              </View>
              <Text style={[s.hint, {marginTop:8}]}>Updates download automatically in the background when available.</Text>
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