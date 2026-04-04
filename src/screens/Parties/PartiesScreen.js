import Icon from '../../utils/Icon';
import React, { useState, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert, RefreshControl,
  StatusBar, FlatList, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getParties, saveParty, deleteParty } from '../../db';
import { INDIAN_STATES, formatINR, formatINRCompact } from '../../utils/gst';
import { COLORS, RADIUS, FONTS } from '../../theme';

const EMPTY_FORM = {
  name: '', phone: '', email: '', address: '',
  gstin: '', state: '', state_code: '', pan: '', type: 'customer',
};

// CSV template columns (must match bulk upload parser below)
const TEMPLATE_COLS = ['Name*','Type (customer/supplier)*','Phone','Email','GSTIN','PAN','State','Address'];
const TEMPLATE_SAMPLE = [
  ['Rahul Traders','customer','9876543210','rahul@example.com','22AAAAA0000A1Z5','AAAAA0000A','Maharashtra','123 Main Road, Mumbai'],
  ['Shree Suppliers','supplier','8765432109','','','','Gujarat',''],
];

// ── CSV / Excel helpers ────────────────────────────────────────────
function esc(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g,'""')}"` : s;
}

function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(esc).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Parse uploaded CSV ─────────────────────────────────────────────
function parsePartiesCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('File must have a header row and at least one data row');

  const header = lines[0].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase());
  const nameIdx    = header.findIndex(h => h.includes('name'));
  const typeIdx    = header.findIndex(h => h.includes('type'));
  const phoneIdx   = header.findIndex(h => h.includes('phone'));
  const emailIdx   = header.findIndex(h => h.includes('email'));
  const gstinIdx   = header.findIndex(h => h.includes('gstin'));
  const panIdx     = header.findIndex(h => h.includes('pan'));
  const stateIdx   = header.findIndex(h => h.includes('state'));
  const addressIdx = header.findIndex(h => h.includes('address'));

  if (nameIdx === -1) throw new Error('Could not find "Name" column in the file');

  const results = [], errors = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g,'').trim());
    const name = nameIdx !== -1 ? cols[nameIdx] : '';
    if (!name) continue;
    const type = typeIdx !== -1 ? cols[typeIdx]?.toLowerCase() : 'customer';
    results.push({
      name,
      type: type === 'supplier' ? 'supplier' : 'customer',
      phone:   phoneIdx   !== -1 ? cols[phoneIdx]   || '' : '',
      email:   emailIdx   !== -1 ? cols[emailIdx]   || '' : '',
      gstin:   gstinIdx   !== -1 ? (cols[gstinIdx]   || '').toUpperCase() : '',
      pan:     panIdx     !== -1 ? (cols[panIdx]     || '').toUpperCase() : '',
      state:   stateIdx   !== -1 ? cols[stateIdx]   || '' : '',
      address: addressIdx !== -1 ? cols[addressIdx] || '' : '',
    });
  }
  return { results, errors };
}

export default function PartiesScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [parties,   setParties]   = useState([]);
  const [search,    setSearch]    = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all | customer | supplier
  const [refreshing, setRefreshing] = useState(false);
  const [sortKey,   setSortKey]   = useState('name');
  const [sortAsc,   setSortAsc]   = useState(true);

  // Add/Edit modal
  const [modal,   setModal]   = useState(false);
  const [form,    setForm]    = useState(EMPTY_FORM);
  const [saving,  setSaving]  = useState(false);
  const [stateModal, setStateModal] = useState(false);
  const [stateSearch, setStateSearch] = useState('');

  // Bulk upload modal
  const [bulkModal,   setBulkModal]   = useState(false);
  const [bulkParsed,  setBulkParsed]  = useState(null); // { results, errors }
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSaving,  setBulkSaving]  = useState(false);
  const [bulkDone,    setBulkDone]    = useState(null);  // { added, failed }

  const load = async () => {
    try {
      const data = await getParties();
      setParties(data);
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  // ── Derived lists ──────────────────────────────────────────────
  const customers = useMemo(() => parties.filter(p => p.type === 'customer'), [parties]);
  const suppliers = useMemo(() => parties.filter(p => p.type === 'supplier'), [parties]);

  const sorted = useMemo(() => {
    let out = [...parties];
    if (search.trim()) {
      const lq = search.toLowerCase();
      out = out.filter(p =>
        p.name.toLowerCase().includes(lq) ||
        (p.phone || '').includes(lq) ||
        (p.gstin || '').toLowerCase().includes(lq) ||
        (p.email || '').toLowerCase().includes(lq)
      );
    }
    if (typeFilter !== 'all') out = out.filter(p => p.type === typeFilter);
    out.sort((a, b) => {
      let va, vb;
      switch (sortKey) {
        case 'name':    va = a.name||'';          vb = b.name||'';           break;
        case 'type':    va = a.type||'';          vb = b.type||'';           break;
        case 'phone':   va = a.phone||'';         vb = b.phone||'';          break;
        case 'gstin':   va = a.gstin||'';         vb = b.gstin||'';          break;
        case 'state':   va = a.state||'';         vb = b.state||'';          break;
        case 'balance': va = a.balance||0;        vb = b.balance||0;         break;
        default:        va = a.name||'';          vb = b.name||'';
      }
      if (typeof va === 'number') return sortAsc ? va - vb : vb - va;
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return out;
  }, [parties, search, typeFilter, sortKey, sortAsc]);

  const handleSort = (key) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  // ── CRUD ────────────────────────────────────────────────────────
  const openAdd  = () => { setForm(EMPTY_FORM); setModal(true); };
  const openEdit = (p) => {
    setForm({ id:p.id, name:p.name, phone:p.phone||'', email:p.email||'',
      address:p.address||'', gstin:p.gstin||'', state:p.state||'',
      state_code:p.state_code||'', pan:p.pan||'', type:p.type||'customer' });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Error','Party name is required'); return; }
    setSaving(true);
    try {
      await saveParty(form);
      setModal(false);
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = (p) => {
    const doIt = async () => { await deleteParty(p.id); load(); };
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${p.name}"? This cannot be undone.`)) doIt();
    } else {
      Alert.alert('Delete Party', `Delete ${p.name}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doIt },
      ]);
    }
  };

  const selectState = (s) => {
    setForm(f => ({ ...f, state: s.name, state_code: s.code }));
    setStateModal(false);
    setStateSearch('');
  };

  const filteredStates = INDIAN_STATES.filter(s =>
    s.name.toLowerCase().includes(stateSearch.toLowerCase()) || s.code.includes(stateSearch)
  );

  // ── Export Excel (CSV) ─────────────────────────────────────────
  const handleExportCSV = () => {
    if (parties.length === 0) { window.alert('No parties to export'); return; }
    const header = ['#','Name','Type','Phone','Email','GSTIN','PAN','State','Balance'];
    const rows   = sorted.map((p, i) => [
      i+1, p.name, p.type, p.phone||'', p.email||'',
      p.gstin||'', p.pan||'', p.state||'',
      (p.balance||0).toFixed(2),
    ]);
    downloadCSV(`Parties_${new Date().toISOString().split('T')[0]}.csv`,
      [header, ...rows]);
  };

  // ── Bulk upload ────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    downloadCSV('LOCAS_Parties_Template.csv', [TEMPLATE_COLS, ...TEMPLATE_SAMPLE]);
  };

  const handlePickCSV = () => {
    const input = document.createElement('input');
    input.type  = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setBulkLoading(true);
      try {
        const text = await file.text();
        const parsed = parsePartiesCSV(text);
        setBulkParsed(parsed);
        setBulkDone(null);
      } catch (e) {
        window.alert('Parse error: ' + e.message);
      } finally {
        setBulkLoading(false);
      }
    };
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  const handleBulkSave = async () => {
    if (!bulkParsed?.results?.length) return;
    setBulkSaving(true);
    let added = 0, failed = 0;
    for (const p of bulkParsed.results) {
      try {
        await saveParty(p);
        added++;
      } catch { failed++; }
    }
    setBulkDone({ added, failed });
    setBulkParsed(null);
    setBulkSaving(false);
    load();
  };

  const openBulkModal = () => {
    setBulkParsed(null);
    setBulkDone(null);
    setBulkModal(true);
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.card} />

      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Parties</Text>
          <Text style={s.headerSub}>{parties.length} total</Text>
        </View>
        <View style={s.headerBtns}>
          {/* Excel export */}
          <TouchableOpacity style={s.excelBtn} onPress={handleExportCSV}>
            <ExcelIcon />
            <Text style={s.excelBtnTxt}>Export</Text>
          </TouchableOpacity>
          {/* Bulk upload */}
          <TouchableOpacity style={s.bulkBtn} onPress={openBulkModal}>
            <Icon name="upload" size={14} color="#8B5CF6" />
            <Text style={s.bulkBtnTxt}>Bulk Upload</Text>
          </TouchableOpacity>
          {/* Add single */}
          <TouchableOpacity style={s.addBtn} onPress={openAdd}>
            <Icon name="plus" size={14} color="#fff" />
            <Text style={s.addBtnTxt}>Add Party</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── KPI strip ── */}
      <View style={s.kpiStrip}>
        <KPI label="Total"     value={String(parties.length)}   color={COLORS.text} />
        <View style={s.kpiDiv} />
        <KPI label="Customers" value={String(customers.length)} color={COLORS.primary} />
        <View style={s.kpiDiv} />
        <KPI label="Suppliers" value={String(suppliers.length)} color="#0EA5E9" />
        <View style={s.kpiDiv} />
        <KPI label="Receivable"
          value={formatINRCompact(customers.reduce((s,p) => s + Math.max(0, p.balance||0), 0))}
          color={COLORS.success} />
        <View style={s.kpiDiv} />
        <KPI label="Payable"
          value={formatINRCompact(suppliers.reduce((s,p) => s + Math.max(0, -(p.balance||0)), 0))}
          color={COLORS.danger} />
      </View>

      {/* ── Toolbar ── */}
      <View style={s.toolbar}>
        <View style={s.searchBox}>
          <Icon name="search" size={15} color={COLORS.textMute} />
          <TextInput
            style={s.searchInput}
            placeholder="Search name, phone, GSTIN..."
            placeholderTextColor={COLORS.textMute}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon name="x" size={14} color={COLORS.textMute} />
            </TouchableOpacity>
          )}
        </View>
        <View style={s.chipRow}>
          {[
            { key:'all',      label:`All (${parties.length})` },
            { key:'customer', label:`Customers (${customers.length})` },
            { key:'supplier', label:`Suppliers (${suppliers.length})` },
          ].map(f => (
            <TouchableOpacity
              key={f.key}
              style={[s.chip, typeFilter===f.key && s.chipActive]}
              onPress={() => setTypeFilter(f.key)}
            >
              <Text style={[s.chipTxt, typeFilter===f.key && s.chipTxtActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Table ── */}
      <View style={s.tableWrap}>
        {/* Header row */}
        <View style={s.thead}>
          <Text style={[s.th, {width:36,textAlign:'center'}]}>#</Text>
          <SH label="Name"    colKey="name"    flex={2.2} sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
          <SH label="Type"    colKey="type"    width={80}  sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
          <SH label="Phone"   colKey="phone"   flex={1.2}  sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
          <SH label="GSTIN"   colKey="gstin"   flex={1.6}  sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
          <SH label="State"   colKey="state"   flex={1.1}  sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
          <SH label="Balance" colKey="balance" flex={1.1}  align="right" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
          <View style={{width:72}} />
        </View>

        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {sorted.length === 0 ? (
            <View style={s.empty}>
              <View style={s.emptyIcon}><Icon name="users" size={28} color={COLORS.primary} /></View>
              <Text style={s.emptyTitle}>
                {search || typeFilter !== 'all' ? 'No parties match' : 'No parties yet'}
              </Text>
              <Text style={s.emptySub}>
                {search ? 'Try a different search' : 'Add customers and suppliers'}
              </Text>
              {!search && typeFilter === 'all' && (
                <View style={s.emptyBtns}>
                  <TouchableOpacity style={s.emptyBtn} onPress={openAdd}>
                    <Text style={s.emptyBtnTxt}>+ Add Party</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.emptyBtnOutline} onPress={openBulkModal}>
                    <Text style={s.emptyBtnOutlineTxt}>Bulk Upload</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            sorted.map((p, idx) => {
              const isCust = p.type === 'customer';
              const bal = p.balance || 0;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[s.trow, idx%2===0 && s.trowEven]}
                  onPress={() => navigation.navigate('PartyDetail', { partyId: p.id })}
                  activeOpacity={0.75}
                >
                  {/* # */}
                  <Text style={[s.td,{width:36,textAlign:'center',color:COLORS.textMute,fontSize:11}]}>{idx+1}</Text>

                  {/* Name */}
                  <View style={{flex:2.2, paddingHorizontal:8, justifyContent:'center'}}>
                    <View style={s.nameCell}>
                      <View style={[s.avatar, isCust ? s.avatarCust : s.avatarSupp]}>
                        <Text style={[s.avatarTxt, isCust ? s.avatarTxtCust : s.avatarTxtSupp]}>
                          {p.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{flex:1}}>
                        <Text style={s.tdName} numberOfLines={1}>{p.name}</Text>
                        {p.email ? <Text style={s.tdSub} numberOfLines={1}>{p.email}</Text> : null}
                      </View>
                    </View>
                  </View>

                  {/* Type */}
                  <View style={{width:80,alignItems:'center',justifyContent:'center'}}>
                    <View style={[s.typePill, isCust ? s.typePillCust : s.typePillSupp]}>
                      <Text style={[s.typePillTxt, isCust ? s.typePillTxtCust : s.typePillTxtSupp]}>
                        {isCust ? 'Customer' : 'Supplier'}
                      </Text>
                    </View>
                  </View>

                  {/* Phone */}
                  <Text style={[s.td,{flex:1.2}]} numberOfLines={1}>{p.phone||'—'}</Text>

                  {/* GSTIN */}
                  <Text style={[s.td,{flex:1.6,fontSize:11}]} numberOfLines={1}>{p.gstin||'—'}</Text>

                  {/* State */}
                  <Text style={[s.td,{flex:1.1}]} numberOfLines={1}>{p.state||'—'}</Text>

                  {/* Balance */}
                  <View style={{flex:1.1,paddingHorizontal:8,alignItems:'flex-end',justifyContent:'center'}}>
                    {bal !== 0 ? (
                      <>
                        <Text style={[s.td, {paddingHorizontal:0, fontWeight:FONTS.bold,
                          color: bal > 0 ? COLORS.success : COLORS.danger}]}>
                          {formatINR(Math.abs(bal))}
                        </Text>
                        <Text style={{fontSize:9, color: bal > 0 ? COLORS.success : COLORS.danger}}>
                          {bal > 0 ? 'To receive' : 'To pay'}
                        </Text>
                      </>
                    ) : (
                      <Text style={[s.td,{paddingHorizontal:0,color:COLORS.textMute}]}>—</Text>
                    )}
                  </View>

                  {/* Actions */}
                  <View style={s.tdActions}>
                    <TouchableOpacity style={s.editBtn} onPress={() => openEdit(p)}>
                      <Icon name="edit-2" size={13} color={COLORS.textSub} />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.delBtn} onPress={() => handleDelete(p)}>
                      <Icon name="trash-2" size={13} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{height:40}} />
        </ScrollView>
      </View>

      {/* ══ Add / Edit Modal ══════════════════════════════════════ */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modalWrap}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setModal(false)}>
              <Text style={s.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>{form.id ? 'Edit Party' : 'Add Party'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Text style={[s.modalSave, saving && {opacity:0.4}]}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={s.modalScroll} keyboardShouldPersistTaps="handled">
            {/* Type */}
            <FL label="Type">
              <View style={s.typeRow}>
                {['customer','supplier'].map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.typeBtn, form.type===t && (t==='customer' ? s.typeBtnCust : s.typeBtnSupp)]}
                    onPress={() => setForm(f => ({...f, type:t}))}
                  >
                    <Icon name={t==='customer'?'user':'truck'} size={14}
                      color={form.type===t ? '#fff' : COLORS.textSub} />
                    <Text style={[s.typeBtnTxt, form.type===t && s.typeBtnTxtActive]}>
                      {t==='customer' ? 'Customer' : 'Supplier'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </FL>

            <FL label="Name *">
              <TextInput style={s.input} value={form.name} onChangeText={v=>setForm(f=>({...f,name:v}))} placeholder="Full name or business name" placeholderTextColor={COLORS.textMute} />
            </FL>
            <View style={s.row}>
              <View style={{flex:1}}>
                <FL label="Phone">
                  <TextInput style={s.input} value={form.phone} onChangeText={v=>setForm(f=>({...f,phone:v}))} placeholder="Mobile number" placeholderTextColor={COLORS.textMute} keyboardType="phone-pad" />
                </FL>
              </View>
              <View style={{width:12}}/>
              <View style={{flex:1}}>
                <FL label="Email">
                  <TextInput style={s.input} value={form.email} onChangeText={v=>setForm(f=>({...f,email:v}))} placeholder="email@example.com" placeholderTextColor={COLORS.textMute} keyboardType="email-address" autoCapitalize="none" />
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
            <View style={s.row}>
              <View style={{flex:1}}>
                <FL label="GSTIN">
                  <TextInput style={s.input} value={form.gstin} onChangeText={v=>setForm(f=>({...f,gstin:v.toUpperCase()}))} placeholder="22AAAAA0000A1Z5" placeholderTextColor={COLORS.textMute} autoCapitalize="characters" maxLength={15} />
                </FL>
              </View>
              <View style={{width:12}}/>
              <View style={{flex:1}}>
                <FL label="PAN">
                  <TextInput style={s.input} value={form.pan} onChangeText={v=>setForm(f=>({...f,pan:v.toUpperCase()}))} placeholder="AAAAA0000A" placeholderTextColor={COLORS.textMute} autoCapitalize="characters" maxLength={10} />
                </FL>
              </View>
            </View>
            <FL label="Address">
              <TextInput style={[s.input,{minHeight:64,textAlignVertical:'top'}]} value={form.address} onChangeText={v=>setForm(f=>({...f,address:v}))} placeholder="Full address" placeholderTextColor={COLORS.textMute} multiline />
            </FL>
            <View style={{height:40}} />
          </ScrollView>
        </View>
      </Modal>

      {/* ══ State Picker ══════════════════════════════════════════ */}
      <Modal visible={stateModal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modalWrap}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setStateModal(false)}>
              <Text style={s.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>Select State</Text>
            <View style={{width:60}} />
          </View>
          <View style={s.stateSearch}>
            <Icon name="search" size={15} color={COLORS.textMute} />
            <TextInput style={s.stateSearchInput} value={stateSearch} onChangeText={setStateSearch} placeholder="Search..." placeholderTextColor={COLORS.textMute} autoFocus />
          </View>
          <FlatList
            data={filteredStates}
            keyExtractor={s => s.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({item}) => (
              <TouchableOpacity style={s.stateItem} onPress={() => selectState(item)}>
                <Text style={s.stateItemName}>{item.name}</Text>
                <Text style={s.stateItemCode}>{item.code}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* ══ Bulk Upload Modal ═════════════════════════════════════ */}
      <Modal visible={bulkModal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modalWrap}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => { setBulkModal(false); setBulkParsed(null); setBulkDone(null); }}>
              <Text style={s.modalCancel}>Close</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>Bulk Party Upload</Text>
            <View style={{width:60}} />
          </View>

          <ScrollView style={s.modalScroll} keyboardShouldPersistTaps="handled">

            {/* Step 1 — Download template */}
            <View style={s.bulkStep}>
              <View style={s.bulkStepNum}><Text style={s.bulkStepNumTxt}>1</Text></View>
              <View style={{flex:1}}>
                <Text style={s.bulkStepTitle}>Download Template</Text>
                <Text style={s.bulkStepDesc}>
                  Download the Excel/CSV template, fill in your party details, then upload it back here.
                </Text>
              </View>
            </View>

            {/* Template preview */}
            <View style={s.templateCard}>
              <View style={s.templateHeader}>
                <ExcelIcon />
                <Text style={s.templateName}>LOCAS_Parties_Template.csv</Text>
              </View>
              <View style={s.templateCols}>
                {TEMPLATE_COLS.map((col, i) => (
                  <View key={i} style={[s.templateCol, col.includes('*') && s.templateColRequired]}>
                    <Text style={[s.templateColTxt, col.includes('*') && s.templateColTxtRequired]}>
                      {col.replace('*','')}
                      {col.includes('*') && <Text style={{color:COLORS.danger}}> *</Text>}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={s.templateHint}>* Required fields. Other columns are optional.</Text>
            </View>

            <TouchableOpacity style={s.downloadBtn} onPress={handleDownloadTemplate}>
              <ExcelIcon />
              <Text style={s.downloadBtnTxt}>Download Template (.csv)</Text>
            </TouchableOpacity>

            {/* Step 2 — Upload */}
            <View style={[s.bulkStep, {marginTop:20}]}>
              <View style={s.bulkStepNum}><Text style={s.bulkStepNumTxt}>2</Text></View>
              <View style={{flex:1}}>
                <Text style={s.bulkStepTitle}>Upload Filled File</Text>
                <Text style={s.bulkStepDesc}>Select your filled CSV file to preview and import.</Text>
              </View>
            </View>

            {/* Upload zone */}
            {!bulkParsed && !bulkDone && (
              <TouchableOpacity style={s.uploadZone} onPress={handlePickCSV} disabled={bulkLoading}>
                {bulkLoading
                  ? <ActivityIndicator size="large" color={COLORS.primary} />
                  : <>
                      <View style={s.uploadZoneIcon}>
                        <Icon name="upload" size={28} color={COLORS.primary} />
                      </View>
                      <Text style={s.uploadZoneTitle}>Click to Select CSV File</Text>
                      <Text style={s.uploadZoneSub}>Supported: .csv files exported from Excel or Google Sheets</Text>
                    </>
                }
              </TouchableOpacity>
            )}

            {/* Preview parsed data */}
            {bulkParsed && (
              <>
                <View style={s.previewHeader}>
                  <View style={s.previewBadge}>
                    <Icon name="check-circle" size={14} color={COLORS.success} />
                    <Text style={s.previewBadgeTxt}>{bulkParsed.results.length} parties found</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setBulkParsed(null); }} style={s.rePickBtn}>
                    <Icon name="refresh-cw" size={13} color={COLORS.primary} />
                    <Text style={s.rePickBtnTxt}>Change file</Text>
                  </TouchableOpacity>
                </View>

                {/* Preview table */}
                <View style={s.previewTable}>
                  <View style={s.previewThead}>
                    {['Name','Type','Phone','GSTIN','State'].map(h => (
                      <Text key={h} style={[s.previewTh, h==='Name'&&{flex:2}]}>{h}</Text>
                    ))}
                  </View>
                  {bulkParsed.results.slice(0,8).map((p, i) => (
                    <View key={i} style={[s.previewTrow, i%2===0&&{backgroundColor:'#FAFBFF'}]}>
                      <Text style={[s.previewTd, {flex:2}]} numberOfLines={1}>{p.name}</Text>
                      <View style={[s.typePill, p.type==='customer'?s.typePillCust:s.typePillSupp, {paddingVertical:2}]}>
                        <Text style={[s.typePillTxt, p.type==='customer'?s.typePillTxtCust:s.typePillTxtSupp, {fontSize:8}]}>
                          {p.type}
                        </Text>
                      </View>
                      <Text style={s.previewTd} numberOfLines={1}>{p.phone||'—'}</Text>
                      <Text style={[s.previewTd,{fontSize:10}]} numberOfLines={1}>{p.gstin||'—'}</Text>
                      <Text style={s.previewTd} numberOfLines={1}>{p.state||'—'}</Text>
                    </View>
                  ))}
                  {bulkParsed.results.length > 8 && (
                    <View style={s.previewMore}>
                      <Text style={s.previewMoreTxt}>+{bulkParsed.results.length - 8} more parties</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[s.importBtn, bulkSaving && {opacity:0.5}]}
                  onPress={handleBulkSave}
                  disabled={bulkSaving}
                >
                  {bulkSaving
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <><Icon name="upload" size={15} color="#fff" /><Text style={s.importBtnTxt}>  Import {bulkParsed.results.length} Parties</Text></>
                  }
                </TouchableOpacity>
              </>
            )}

            {/* Success result */}
            {bulkDone && (
              <View style={s.doneCard}>
                <View style={s.doneIcon}>
                  <Icon name="check-circle" size={32} color={COLORS.success} />
                </View>
                <Text style={s.doneTitle}>Import Complete!</Text>
                <Text style={s.doneSub}>
                  {bulkDone.added} parties added successfully
                  {bulkDone.failed > 0 ? `\n${bulkDone.failed} failed` : ''}
                </Text>
                <TouchableOpacity style={s.doneBtn} onPress={() => {
                  setBulkModal(false); setBulkDone(null);
                }}>
                  <Text style={s.doneBtnTxt}>Done</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{height:40}} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────
function KPI({ label, value, color }) {
  return (
    <View style={s.kpiChip}>
      <Text style={[s.kpiVal, {color}]}>{value}</Text>
      <Text style={s.kpiLbl}>{label}</Text>
    </View>
  );
}

function SH({ label, colKey, flex, width, align='left', sortKey, sortAsc, onSort }) {
  const active = sortKey === colKey;
  return (
    <TouchableOpacity
      style={[{paddingHorizontal:8, paddingVertical:9}, flex ? {flex} : {width}]}
      onPress={() => onSort(colKey)}
      activeOpacity={0.7}
    >
      <Text style={[s.th, {textAlign:align}, active && {color:COLORS.primary}]} numberOfLines={1}>
        {label}{active ? (sortAsc ? ' ↑' : ' ↓') : ''}
      </Text>
    </TouchableOpacity>
  );
}

function ExcelIcon() {
  return (
    <View style={s.excelIconWrap}>
      <View style={s.excelGrid}>
        <View style={s.excelRow}>
          <View style={[s.excelCell, s.excelCellHeader]} />
          <View style={[s.excelCell, s.excelCellHeader, {borderRightWidth:0}]} />
        </View>
        <View style={[s.excelRow, {flex:1}]}>
          <View style={[s.excelCell, {borderBottomWidth:0}]} />
          <View style={[s.excelCell, {borderBottomWidth:0, borderRightWidth:0}]} />
        </View>
      </View>
    </View>
  );
}

function FL({ label, children }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:  { flex:1, backgroundColor:COLORS.bg },

  // Header
  header:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:14, paddingVertical:12, backgroundColor:COLORS.card, borderBottomWidth:1, borderBottomColor:COLORS.border },
  headerTitle: { fontSize:20, fontWeight:FONTS.black, color:COLORS.text },
  headerSub:   { fontSize:11, color:COLORS.textMute, marginTop:1 },
  headerBtns:  { flexDirection:'row', alignItems:'center', gap:8 },

  // Excel export button
  excelBtn:      { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:11, paddingVertical:8, borderRadius:RADIUS.md, backgroundColor:'#F0FDF4', borderWidth:1, borderColor:'#86EFAC' },
  excelBtnTxt:   { fontSize:12, fontWeight:FONTS.bold, color:'#16A34A' },
  excelIconWrap: { width:16, height:16 },
  excelGrid:     { flex:1, borderWidth:1, borderColor:'#16A34A', borderRadius:2, overflow:'hidden' },
  excelRow:      { flexDirection:'row', flex:1 },
  excelCell:     { flex:1, borderRightWidth:1, borderRightColor:'#16A34A', borderBottomWidth:1, borderBottomColor:'#16A34A' },
  excelCellHeader: { backgroundColor:'#16A34A' },

  // Bulk upload button
  bulkBtn:    { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:11, paddingVertical:8, borderRadius:RADIUS.md, backgroundColor:'#F5F3FF', borderWidth:1, borderColor:'#C4B5FD' },
  bulkBtnTxt: { fontSize:12, fontWeight:FONTS.bold, color:'#8B5CF6' },

  // Add button
  addBtn:    { flexDirection:'row', alignItems:'center', gap:5, backgroundColor:COLORS.primary, paddingHorizontal:14, paddingVertical:9, borderRadius:RADIUS.md },
  addBtnTxt: { color:'#fff', fontWeight:FONTS.bold, fontSize:13 },

  // KPI strip
  kpiStrip: { flexDirection:'row', backgroundColor:COLORS.card, borderBottomWidth:1, borderBottomColor:COLORS.border },
  kpiChip:  { flex:1, alignItems:'center', paddingVertical:11 },
  kpiDiv:   { width:1, backgroundColor:COLORS.border, marginVertical:10 },
  kpiVal:   { fontSize:14, fontWeight:FONTS.black, marginBottom:2 },
  kpiLbl:   { fontSize:9, color:COLORS.textMute, textTransform:'uppercase', letterSpacing:0.4, textAlign:'center' },

  // Toolbar
  toolbar:    { backgroundColor:COLORS.card, borderBottomWidth:1, borderBottomColor:COLORS.border, paddingTop:10 },
  searchBox:  { flexDirection:'row', alignItems:'center', gap:8, marginHorizontal:12, marginBottom:8, paddingHorizontal:12, height:38, backgroundColor:COLORS.bg, borderRadius:RADIUS.md, borderWidth:1, borderColor:COLORS.border },
  searchInput:{ flex:1, fontSize:13, color:COLORS.text, paddingVertical:0 },
  chipRow:    { flexDirection:'row', paddingHorizontal:12, paddingBottom:10, gap:7 },
  chip:       { paddingHorizontal:13, paddingVertical:5, borderRadius:RADIUS.full, backgroundColor:COLORS.bg, borderWidth:1, borderColor:COLORS.border },
  chipActive: { backgroundColor:COLORS.secondary, borderColor:COLORS.secondary },
  chipTxt:    { fontSize:11, fontWeight:FONTS.medium, color:COLORS.textSub },
  chipTxtActive:{ color:'#fff', fontWeight:FONTS.bold },

  // Table
  tableWrap:  { flex:1 },
  thead:      { flexDirection:'row', backgroundColor:'#F1F5F9', borderBottomWidth:2, borderBottomColor:COLORS.border },
  th:         { fontSize:10, fontWeight:FONTS.bold, color:COLORS.textMute, textTransform:'uppercase', letterSpacing:0.4 },
  trow:       { flexDirection:'row', alignItems:'center', borderBottomWidth:1, borderBottomColor:COLORS.border, minHeight:48, backgroundColor:COLORS.card },
  trowEven:   { backgroundColor:'#FAFBFF' },
  td:         { fontSize:12, color:COLORS.text, paddingHorizontal:8 },

  nameCell:   { flexDirection:'row', alignItems:'center', gap:8 },
  avatar:     { width:28, height:28, borderRadius:14, alignItems:'center', justifyContent:'center', flexShrink:0 },
  avatarCust: { backgroundColor:COLORS.primaryLight },
  avatarSupp: { backgroundColor:'#E0F2FE' },
  avatarTxt:  { fontSize:12, fontWeight:FONTS.black },
  avatarTxtCust: { color:COLORS.primary },
  avatarTxtSupp: { color:'#0369A1' },
  tdName:     { fontSize:13, fontWeight:FONTS.semibold, color:COLORS.text },
  tdSub:      { fontSize:10, color:COLORS.textMute, marginTop:1 },

  typePill:       { paddingHorizontal:7, paddingVertical:3, borderRadius:RADIUS.full },
  typePillCust:   { backgroundColor:COLORS.primaryLight },
  typePillSupp:   { backgroundColor:'#E0F2FE' },
  typePillTxt:    { fontSize:9, fontWeight:FONTS.black, letterSpacing:0.2 },
  typePillTxtCust:{ color:COLORS.primary },
  typePillTxtSupp:{ color:'#0369A1' },

  tdActions:  { width:72, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, paddingHorizontal:6 },
  editBtn:    { padding:6, borderRadius:RADIUS.sm, backgroundColor:COLORS.bgDeep },
  delBtn:     { padding:6, borderRadius:RADIUS.sm, backgroundColor:COLORS.dangerLight },

  // Empty
  empty:          { alignItems:'center', paddingTop:70, paddingHorizontal:32 },
  emptyIcon:      { width:60, height:60, borderRadius:30, backgroundColor:COLORS.primaryLight, alignItems:'center', justifyContent:'center', marginBottom:14 },
  emptyTitle:     { fontSize:16, fontWeight:FONTS.bold, color:COLORS.text, marginBottom:6, textAlign:'center' },
  emptySub:       { fontSize:13, color:COLORS.textMute, textAlign:'center', lineHeight:19, marginBottom:20 },
  emptyBtns:      { flexDirection:'row', gap:10 },
  emptyBtn:       { backgroundColor:COLORS.primary, paddingHorizontal:20, paddingVertical:10, borderRadius:RADIUS.lg },
  emptyBtnTxt:    { color:'#fff', fontWeight:FONTS.bold, fontSize:13 },
  emptyBtnOutline:{ paddingHorizontal:20, paddingVertical:10, borderRadius:RADIUS.lg, borderWidth:1.5, borderColor:'#8B5CF6' },
  emptyBtnOutlineTxt:{ color:'#8B5CF6', fontWeight:FONTS.bold, fontSize:13 },

  // Modal
  modalWrap:   { flex:1, backgroundColor:COLORS.card, marginTop: Platform.OS==='web' ? 60 : 0 },
  modalHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingTop:16, paddingBottom:14, borderBottomWidth:1, borderBottomColor:COLORS.border },
  modalTitle:  { fontSize:17, fontWeight:FONTS.black, color:COLORS.text },
  modalCancel: { fontSize:14, color:COLORS.textSub },
  modalSave:   { fontSize:14, fontWeight:FONTS.bold, color:COLORS.primary },
  modalScroll: { padding:18, paddingBottom:40 },

  // Form
  fieldWrap:  { marginBottom:12 },
  fieldLabel: { fontSize:11, fontWeight:FONTS.bold, color:COLORS.textSub, textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 },
  input:      { backgroundColor:COLORS.bg, borderWidth:1, borderColor:COLORS.border, borderRadius:RADIUS.md, paddingHorizontal:12, paddingVertical:11, fontSize:14, color:COLORS.text },
  row:        { flexDirection:'row' },
  picker:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  pickerTxt:  { fontSize:14, color:COLORS.text, flex:1 },
  pickerPlaceholder: { fontSize:14, color:COLORS.textMute, flex:1 },

  typeRow:        { flexDirection:'row', gap:8, marginBottom:4 },
  typeBtn:        { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, paddingVertical:10, borderRadius:RADIUS.md, backgroundColor:COLORS.bg, borderWidth:1, borderColor:COLORS.border },
  typeBtnCust:    { backgroundColor:COLORS.primary, borderColor:COLORS.primary },
  typeBtnSupp:    { backgroundColor:'#0EA5E9', borderColor:'#0EA5E9' },
  typeBtnTxt:     { fontSize:13, fontWeight:FONTS.semibold, color:COLORS.textSub },
  typeBtnTxtActive:{ color:'#fff', fontWeight:FONTS.bold },

  // State picker
  stateSearch:      { flexDirection:'row', alignItems:'center', gap:8, margin:12, paddingHorizontal:12, height:42, backgroundColor:COLORS.bg, borderRadius:RADIUS.md, borderWidth:1, borderColor:COLORS.border },
  stateSearchInput: { flex:1, fontSize:14, color:COLORS.text },
  stateItem:        { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingVertical:13, borderBottomWidth:1, borderBottomColor:COLORS.border },
  stateItemName:    { fontSize:14, color:COLORS.text, fontWeight:FONTS.medium },
  stateItemCode:    { fontSize:12, color:COLORS.textMute, backgroundColor:COLORS.bgDeep, paddingHorizontal:8, paddingVertical:3, borderRadius:RADIUS.sm },

  // Bulk upload modal
  bulkStep:      { flexDirection:'row', alignItems:'flex-start', gap:12, marginBottom:14 },
  bulkStepNum:   { width:28, height:28, borderRadius:14, backgroundColor:COLORS.primary, alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2 },
  bulkStepNumTxt:{ fontSize:13, fontWeight:FONTS.black, color:'#fff' },
  bulkStepTitle: { fontSize:15, fontWeight:FONTS.bold, color:COLORS.text, marginBottom:3 },
  bulkStepDesc:  { fontSize:13, color:COLORS.textSub, lineHeight:19 },

  templateCard:       { backgroundColor:'#F0FDF4', borderRadius:RADIUS.lg, borderWidth:1, borderColor:'#86EFAC', padding:14, marginBottom:12 },
  templateHeader:     { flexDirection:'row', alignItems:'center', gap:8, marginBottom:10 },
  templateName:       { fontSize:13, fontWeight:FONTS.bold, color:'#16A34A' },
  templateCols:       { flexDirection:'row', flexWrap:'wrap', gap:6, marginBottom:8 },
  templateCol:        { paddingHorizontal:8, paddingVertical:4, borderRadius:RADIUS.sm, backgroundColor:'#fff', borderWidth:1, borderColor:'#86EFAC' },
  templateColRequired:{ borderColor:COLORS.danger, backgroundColor:'#FEF2F2' },
  templateColTxt:     { fontSize:10, fontWeight:FONTS.medium, color:COLORS.textSub },
  templateColTxtRequired: { color:COLORS.danger, fontWeight:FONTS.bold },
  templateHint:       { fontSize:11, color:COLORS.textMute },

  downloadBtn:    { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:'#16A34A', paddingVertical:13, borderRadius:RADIUS.lg, marginBottom:8 },
  downloadBtnTxt: { fontSize:14, fontWeight:FONTS.bold, color:'#fff' },

  uploadZone:       { alignItems:'center', justifyContent:'center', paddingVertical:36, borderRadius:RADIUS.xl, borderWidth:2, borderColor:COLORS.primary, borderStyle:'dashed', backgroundColor:COLORS.primaryLight, gap:10, marginBottom:8 },
  uploadZoneIcon:   { width:60, height:60, borderRadius:30, backgroundColor:COLORS.card, alignItems:'center', justifyContent:'center' },
  uploadZoneTitle:  { fontSize:15, fontWeight:FONTS.bold, color:COLORS.primary },
  uploadZoneSub:    { fontSize:12, color:COLORS.textSub, textAlign:'center', paddingHorizontal:20 },

  previewHeader:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:10 },
  previewBadge:   { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:COLORS.successLight, paddingHorizontal:10, paddingVertical:5, borderRadius:RADIUS.full },
  previewBadgeTxt:{ fontSize:12, fontWeight:FONTS.bold, color:COLORS.success },
  rePickBtn:      { flexDirection:'row', alignItems:'center', gap:5 },
  rePickBtnTxt:   { fontSize:12, color:COLORS.primary, fontWeight:FONTS.semibold },

  previewTable:  { backgroundColor:COLORS.card, borderRadius:RADIUS.lg, borderWidth:1, borderColor:COLORS.border, overflow:'hidden', marginBottom:14 },
  previewThead:  { flexDirection:'row', backgroundColor:'#F1F5F9', paddingVertical:8, paddingHorizontal:10, borderBottomWidth:1, borderBottomColor:COLORS.border },
  previewTh:     { flex:1, fontSize:10, fontWeight:FONTS.bold, color:COLORS.textMute, textTransform:'uppercase', letterSpacing:0.4, paddingHorizontal:4 },
  previewTrow:   { flexDirection:'row', alignItems:'center', paddingVertical:9, paddingHorizontal:10, borderBottomWidth:1, borderBottomColor:COLORS.border },
  previewTd:     { flex:1, fontSize:11, color:COLORS.text, paddingHorizontal:4 },
  previewMore:   { padding:10, alignItems:'center', backgroundColor:'#F8FAFC' },
  previewMoreTxt:{ fontSize:12, color:COLORS.textMute, fontWeight:FONTS.medium },

  importBtn:    { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:COLORS.primary, paddingVertical:14, borderRadius:RADIUS.lg, marginBottom:8 },
  importBtnTxt: { fontSize:14, fontWeight:FONTS.bold, color:'#fff' },

  doneCard:   { alignItems:'center', padding:28, backgroundColor:COLORS.successLight, borderRadius:RADIUS.xl, borderWidth:1, borderColor:COLORS.success+'44' },
  doneIcon:   { width:64, height:64, borderRadius:32, backgroundColor:'#fff', alignItems:'center', justifyContent:'center', marginBottom:14 },
  doneTitle:  { fontSize:20, fontWeight:FONTS.black, color:COLORS.success, marginBottom:8 },
  doneSub:    { fontSize:14, color:COLORS.success, textAlign:'center', lineHeight:21, marginBottom:20, opacity:0.8 },
  doneBtn:    { backgroundColor:COLORS.success, paddingHorizontal:32, paddingVertical:12, borderRadius:RADIUS.lg },
  doneBtnTxt: { color:'#fff', fontWeight:FONTS.bold, fontSize:14 },
});