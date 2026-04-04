import Icon from '../../utils/Icon';
import React, { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert, RefreshControl, StatusBar,
  ActivityIndicator, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getItems, saveItem, deleteItem } from '../../db';
import { GST_RATES, formatINR } from '../../utils/gst';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';

// Units now dynamic — see PRODUCT_UNITS / SERVICE_UNITS above

const EMPTY_FORM = {
  name: '', code: '', unit: 'pcs', hsn: '',
  sale_price: '', purchase_price: '',
  gst_rate: 18, stock: '', min_stock: '',
  item_type: 'product', // 'product' | 'service'
  description: '',      // for services
};

const SERVICE_UNITS = ['hrs', 'days', 'visit', 'job', 'month', 'year', 'fixed'];
const PRODUCT_UNITS = ['pcs', 'kg', 'g', 'litre', 'ml', 'metre', 'box', 'bag', 'dozen', 'set'];

// Bulk upload template columns
const ITEM_TEMPLATE_COLS  = ['Name*', 'Type (product/service)*', 'Sale Price*', 'Purchase Price', 'GST% (0/5/12/18/28)', 'Unit', 'HSN/SAC', 'Item Code', 'Opening Stock', 'Min Stock Alert', 'Description'];
const ITEM_TEMPLATE_SAMPLE = [
  ['Rice 25kg Bag', 'product', '1200', '950', '5', 'kg', '1006', 'RICE25', '50', '10', ''],
  ['Installation Charges', 'service', '2500', '', '18', 'hrs', '9987', 'INST01', '', '', 'Labour charges for installation'],
];

// CSV helpers
function escCSV(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(escCSV).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Parse uploaded items CSV
function parseItemsCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('File must have a header row and at least one data row');
  const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
  const col = (key) => header.findIndex(h => h.includes(key));
  const nameIdx  = col('name'), typeIdx = col('type'), saleIdx = col('sale');
  const buyIdx   = col('purchase'), gstIdx  = col('gst'), unitIdx = col('unit');
  const hsnIdx   = col('hsn'), codeIdx = col('code'), stockIdx = col('stock');
  const minIdx   = col('min'), descIdx = col('desc');
  if (nameIdx === -1) throw new Error('Could not find "Name" column');
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    // Handle quoted commas
    // Simple CSV split - handles quoted fields, no lookbehind needed
    const cols = (() => {
      const row = lines[i], result = [];
      let cur = '', inQ = false;
      for (let ci = 0; ci < row.length; ci++) {
        const ch = row[ci];
        if (ch === '"' && !inQ) { inQ = true; }
        else if (ch === '"' && inQ && row[ci+1] === '"') { cur += '"'; ci++; }
        else if (ch === '"' && inQ) { inQ = false; }
        else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
        else { cur += ch; }
      }
      result.push(cur.trim());
      return result;
    })();
    const name = nameIdx !== -1 ? cols[nameIdx] : '';
    if (!name) continue;
    const type = typeIdx !== -1 ? (cols[typeIdx]?.toLowerCase() || 'product') : 'product';
    results.push({
      name,
      item_type:      type === 'service' ? 'service' : 'product',
      sale_price:     saleIdx  !== -1 ? parseFloat(cols[saleIdx]  || '0') || 0 : 0,
      purchase_price: buyIdx   !== -1 ? parseFloat(cols[buyIdx]   || '0') || 0 : 0,
      gst_rate:       gstIdx   !== -1 ? parseInt(cols[gstIdx]     || '18') || 18 : 18,
      unit:           unitIdx  !== -1 ? cols[unitIdx] || (type === 'service' ? 'hrs' : 'pcs') : 'pcs',
      hsn:            hsnIdx   !== -1 ? cols[hsnIdx]  || '' : '',
      code:           codeIdx  !== -1 ? cols[codeIdx] || '' : '',
      stock:          stockIdx !== -1 ? parseFloat(cols[stockIdx] || '0') || 0 : 0,
      min_stock:      minIdx   !== -1 ? parseFloat(cols[minIdx]   || '0') || 0 : 0,
      description:    descIdx  !== -1 ? cols[descIdx] || '' : '',
    });
  }
  return results;
}

export default function InventoryScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  const [items, setItems]         = useState([]);
  const [filtered, setFiltered]   = useState([]);
  const [search, setSearch]       = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Bulk upload state
  const [bulkModal,   setBulkModal]   = useState(false);
  const [bulkParsed,  setBulkParsed]  = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSaving,  setBulkSaving]  = useState(false);
  const [bulkDone,    setBulkDone]    = useState(null);

  const load = async () => {
    try {
      const data = await getItems();
      setItems(data);
      apply(data, search, lowStockOnly, typeFilter);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => {
    load();
    // Auto-open add modal if navigated with openAdd flag
    if (route?.params?.openAdd) {
      setForm(EMPTY_FORM);
      setModal(true);
      navigation.setParams({ openAdd: false });
    }
  }, []));

  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'product' | 'service'

  const apply = (data, q, lowOnly, tFilter) => {
    let out = data;
    if (q.trim()) {
      const lq = q.toLowerCase();
      out = out.filter(i =>
        i.name.toLowerCase().includes(lq) ||
        (i.description || '').toLowerCase().includes(lq) ||
        (i.code || '').toLowerCase().includes(lq) ||
        (i.hsn  || '').includes(lq)
      );
    }
    if (lowOnly) out = out.filter(i => i.min_stock > 0 && i.stock <= i.min_stock && i.item_type !== 'service');
    if (tFilter && tFilter !== 'all') out = out.filter(i => (i.item_type || 'product') === tFilter);
    setFiltered(out);
  };

  const handleSearch = (q) => { setSearch(q); apply(items, q, lowStockOnly, typeFilter); };
  const toggleLow    = ()  => { const n = !lowStockOnly; setLowStockOnly(n); apply(items, search, n, typeFilter); };
  const handleTypeFilter = (t) => { setTypeFilter(t); apply(items, search, lowStockOnly, t); };
  const onRefresh    = ()  => { setRefreshing(true); load(); };

  const openAdd  = () => { setForm(EMPTY_FORM); setModal(true); };
  const openEdit = (item) => {
    setForm({
      id:             item.id,
      name:           item.name,
      code:           item.code || '',
      unit:           item.unit || 'pcs',
      hsn:            item.hsn  || '',
      sale_price:     String(item.sale_price     || ''),
      purchase_price: String(item.purchase_price || ''),
      gst_rate:       item.gst_rate || 18,
      stock:          String(item.stock     || ''),
      min_stock:      String(item.min_stock || ''),
      item_type:      item.item_type || 'product',
      description:    item.description || '',
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Error', 'Item name is required'); return; }
    if (!form.sale_price || parseFloat(form.sale_price) < 0) { Alert.alert('Error', 'Enter a valid sale price'); return; }
    const isService = form.item_type === 'service';
    setSaving(true);
    try {
      await saveItem({
        ...form,
        sale_price:     parseFloat(form.sale_price)     || 0,
        purchase_price: parseFloat(form.purchase_price) || 0,
        stock:          isService ? 0 : (parseFloat(form.stock) || 0),
        min_stock:      isService ? 0 : (parseFloat(form.min_stock) || 0),
        item_type:      form.item_type || 'product',
        description:    form.description || '',
      });
      setModal(false);
      load();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    // FIX: Alert.alert with buttons is a no-op on React Native Web.
    if (Platform.OS === 'web') {
      if (!window.confirm(`Delete item "${item.name}"? This cannot be undone.`)) return;
      deleteItem(item.id).then(load);
      return;
    }
    Alert.alert('Delete Item', `Delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteItem(item.id);
        load();
      }},
    ]);
  };


  // ── Export Stock Inventory to CSV ─────────────────────────────
  const exportStockInventory = () => {
    if (items.length === 0) {
      if (Platform.OS === 'web') {
        window.alert('No items to export. Add some inventory items first.');
      } else {
        Alert.alert('No Items', 'Add some inventory items first.');
      }
      return;
    }

    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '-');

      // CSV header
      const headers = [
        'Sr No', 'Item Name', 'Code', 'HSN/SAC', 'Unit',
        'Sale Price (₹)', 'Cost Price (₹)', 'GST Rate (%)',
        'Current Stock', 'Min Stock', 'Stock Value (₹)', 'Status'
      ];

      // CSV rows
      const rows = items.map((item, idx) => {
        const stockValue = (item.stock || 0) * (item.sale_price || 0);
        const isLow = item.min_stock > 0 && item.stock <= item.min_stock;
        const isNeg = item.stock < 0;
        const status = isNeg ? 'Negative Stock' : isLow ? 'Low Stock' : 'OK';

        // Escape any commas or quotes in text fields
        const esc = (val) => {
          const str = String(val || '');
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };

        return [
          idx + 1,
          esc(item.name),
          esc(item.code || ''),
          esc(item.hsn || ''),
          esc(item.unit || 'pcs'),
          (item.sale_price || 0).toFixed(2),
          (item.purchase_price || 0).toFixed(2),
          item.gst_rate || 0,
          item.stock || 0,
          item.min_stock || 0,
          stockValue.toFixed(2),
          status,
        ].join(',');
      });

      // Summary rows at bottom
      const totalValue = items.reduce((s, i) => s + ((i.stock || 0) * (i.sale_price || 0)), 0);
      const lowCount   = items.filter(i => i.min_stock > 0 && i.stock <= i.min_stock).length;
      const negCount   = items.filter(i => i.stock < 0).length;

      const csv = [
        `LOCAS — Stock Inventory Report`,
        `Generated: ${dateStr} ${timeStr}`,
        `Total Items: ${items.length}  |  Low Stock: ${lowCount}  |  Negative Stock: ${negCount}  |  Total Stock Value: ₹${totalValue.toFixed(2)}`,
        '',
        headers.join(','),
        ...rows,
        '',
        `,,,,,,,,,,Total Stock Value,${totalValue.toFixed(2)}`,
      ].join('\n');

      if (Platform.OS === 'web') {
        // Browser download
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href     = url;
        link.download = `Stock_Inventory_${dateStr}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        Alert.alert('Export', 'CSV export is available on desktop/web version.');
      }
    } catch (e) {
      console.error('Export failed:', e);
      if (Platform.OS === 'web') {
        window.alert('Export failed: ' + e.message);
      } else {
        Alert.alert('Export Failed', e.message);
      }
    }
  };

  // ── Stats ──────────────────────────────────────────────────────
  const products      = items.filter(i => i.item_type !== 'service');
  const services      = items.filter(i => i.item_type === 'service');
  const totalItems    = items.length;
  const lowStockCount = products.filter(i => i.min_stock > 0 && i.stock <= i.min_stock).length;
  const totalValue    = products.reduce((s, i) => s + (i.stock * i.sale_price), 0);

  // ── Sort state ─────────────────────────────────────────────────
  const [sortKey, setSortKey] = React.useState('name');
  const [sortAsc, setSortAsc] = React.useState(true);

  const handleSort = (key) => {
    if (sortKey === key) { setSortAsc(a => !a); }
    else { setSortKey(key); setSortAsc(true); }
  };

  const sorted = React.useMemo(() => {
    const out = [...filtered];
    out.sort((a, b) => {
      let va, vb;
      switch (sortKey) {
        case 'name':           va = a.name || '';          vb = b.name || '';          break;
        case 'item_type':      va = a.item_type || '';     vb = b.item_type || '';     break;
        case 'hsn':            va = a.hsn || '';           vb = b.hsn || '';           break;
        case 'unit':           va = a.unit || '';          vb = b.unit || '';          break;
        case 'sale_price':     va = a.sale_price || 0;     vb = b.sale_price || 0;     break;
        case 'purchase_price': va = a.purchase_price || 0; vb = b.purchase_price || 0; break;
        case 'gst_rate':       va = a.gst_rate || 0;       vb = b.gst_rate || 0;       break;
        case 'stock':          va = a.stock || 0;          vb = b.stock || 0;          break;
        case 'min_stock':      va = a.min_stock || 0;      vb = b.min_stock || 0;      break;
        case 'stock_value':    va = (a.stock||0)*(a.sale_price||0); vb = (b.stock||0)*(b.sale_price||0); break;
        default:               va = a.name || '';          vb = b.name || '';
      }
      if (typeof va === 'number') return sortAsc ? va - vb : vb - va;
      return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return out;
  }, [filtered, sortKey, sortAsc]);

  // ── Render item ───────────────────────────────────────────────
  const renderItem = ({ item }) => {
    const isLow = item.min_stock > 0 && item.stock <= item.min_stock;
    return (
      <View style={s.itemCard}>
        <View style={s.cardMain}>
          {/* Left */}
          <View style={{ flex: 1 }}>
            <View style={s.nameRow}>
              <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
              {item.item_type === 'service'
                ? <View style={s.serviceBadge}><Text style={s.serviceBadgeText}>Service</Text></View>
                : isLow ? <View style={s.lowBadge}><Text style={s.lowText}>Low Stock</Text></View> : null}
            </View>
            {item.description ? <Text style={s.itemSub} numberOfLines={1}>{item.description}</Text> : null}
            {item.code ? <Text style={s.itemSub}>Code: {item.code}</Text> : null}
            {item.hsn  ? <Text style={s.itemSub}>HSN: {item.hsn}</Text>   : null}
            <Text style={s.itemSub}>GST {item.gst_rate}%  ·  {item.unit}</Text>
          </View>

          {/* Right */}
          <View style={s.cardRight}>
            <Text style={s.salePrice}>{formatINR(item.sale_price)}</Text>
            {item.purchase_price > 0 && (
              <Text style={s.purchasePrice}>Cost: {formatINR(item.purchase_price)}</Text>
            )}
            <View style={s.cardActions}>
              <TouchableOpacity style={s.editBtn} onPress={() => openEdit(item)}>
                <Icon name="edit-2" size={14} color={COLORS.textSub} />
              </TouchableOpacity>
              <TouchableOpacity style={s.delBtn} onPress={() => handleDelete(item)}>
                <Icon name="trash-2" size={14} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Stock bar — hidden for services */}
        {item.item_type !== 'service' && (
          <View style={s.stockRow}>
            <Text style={[s.stockLabel, isLow && { color: COLORS.danger }]}>
              Stock: {item.stock} {item.unit}
            </Text>
            {item.min_stock > 0 && (
              <Text style={s.minStock}>Min: {item.min_stock}</Text>
            )}
            <Text style={s.stockValue}>{formatINR(item.stock * item.sale_price)}</Text>
          </View>
        )}
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.card} />

      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Inventory</Text>
          <Text style={s.headerSub}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={s.headerBtns}>
          {/* Excel export */}
          <TouchableOpacity style={s.excelBtn} onPress={exportStockInventory}>
            <ExcelIcon />
            <Text style={s.excelBtnTxt}>Export</Text>
          </TouchableOpacity>
          {/* Bulk Upload */}
          <TouchableOpacity style={s.bulkBtn} onPress={openBulkModal}>
            <Icon name="upload" size={14} color="#8B5CF6" />
            <Text style={s.bulkBtnTxt}>Bulk Upload</Text>
          </TouchableOpacity>
          {/* Add single */}
          <TouchableOpacity style={s.addBtn} onPress={openAdd}>
            <Icon name="plus" size={14} color="#fff" />
            <Text style={s.addBtnTxt}>Add Item</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── KPI strip ── */}
      <View style={s.kpiStrip}>
        <KPI label="Products"    value={String(products.length)} color={COLORS.primary} />
        <View style={s.kpiDiv} />
        <KPI label="Services"    value={String(services.length)} color="#0EA5E9" />
        <View style={s.kpiDiv} />
        <KPI label="Low Stock"   value={String(lowStockCount)}  color={lowStockCount > 0 ? COLORS.danger : COLORS.textMute} />
        <View style={s.kpiDiv} />
        <KPI label="Stock Value" value={formatINR(totalValue)}  color={COLORS.primary} />
      </View>

      {/* ── Toolbar ── */}
      <View style={s.toolbar}>
        <View style={s.searchBox}>
          <Icon name="search" size={15} color={COLORS.textMute} />
          <TextInput
            style={s.searchInput}
            placeholder="Search name, code, HSN..."
            placeholderTextColor={COLORS.textMute}
            value={search}
            onChangeText={handleSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Icon name="x" size={14} color={COLORS.textMute} />
            </TouchableOpacity>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={s.chipRow}>
          {[
            { key: 'all',     label: `All (${items.length})` },
            { key: 'product', label: `Products (${products.length})` },
            { key: 'service', label: `Services (${services.length})` },
          ].map(f => (
            <TouchableOpacity
              key={f.key}
              style={[s.chip, typeFilter === f.key && s.chipActive]}
              onPress={() => handleTypeFilter(f.key)}
            >
              <Text style={[s.chipTxt, typeFilter === f.key && s.chipTxtActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
          {lowStockCount > 0 && (
            <TouchableOpacity
              style={[s.chip, lowStockOnly && s.chipDanger]}
              onPress={toggleLow}
            >
              <Text style={[s.chipTxt, lowStockOnly && s.chipTxtDanger]}>
                ⚠ Low Stock ({lowStockCount})
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* ── Table ── */}
      <View style={s.tableWrap}>
        {/* Sticky column header */}
        <View style={s.thead}>
          <SortHeader label="#"           colKey="idx"            width={36}  align="center" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
          <SortHeader label="Item / Service" colKey="name"        flex={2.2}  align="left"   sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
          <SortHeader label="Type"        colKey="item_type"      width={72}  align="center" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
          <SortHeader label="HSN/SAC"     colKey="hsn"            width={78}  align="left"   sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
          <SortHeader label="Unit"        colKey="unit"           width={54}  align="center" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
          <SortHeader label="Sale ₹"      colKey="sale_price"     flex={1}    align="right"  sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
          <SortHeader label="Cost ₹"      colKey="purchase_price" flex={1}    align="right"  sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
          <SortHeader label="GST%"        colKey="gst_rate"       width={52}  align="center" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
          <SortHeader label="Stock"       colKey="stock"          flex={0.9}  align="right"  sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
          <SortHeader label="Min"         colKey="min_stock"      width={50}  align="center" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
          <SortHeader label="Value ₹"     colKey="stock_value"    flex={1.1}  align="right"  sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
          <View style={{ width: 68 }} />
        </View>

        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {sorted.length === 0 ? (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Icon name="package" size={28} color={COLORS.primary} />
              </View>
              <Text style={s.emptyTitle}>
                {search || typeFilter !== 'all' || lowStockOnly ? 'No items match' : 'No items yet'}
              </Text>
              <Text style={s.emptySub}>
                {search || typeFilter !== 'all' ? 'Try a different search or filter' : 'Add products and services to your inventory'}
              </Text>
              {!search && typeFilter === 'all' && !lowStockOnly && (
                <TouchableOpacity style={s.emptyBtn} onPress={openAdd}>
                  <Text style={s.emptyBtnTxt}>+ Add First Item</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            sorted.map((item, idx) => {
              const isService  = item.item_type === 'service';
              const isLow      = !isService && item.min_stock > 0 && item.stock <= item.min_stock;
              const isNeg      = !isService && item.stock < 0;
              const stockValue = isService ? null : item.stock * item.sale_price;
              const rowBg      = idx % 2 === 0 ? COLORS.card : '#FAFBFF';

              return (
                <View key={item.id} style={[s.trow, { backgroundColor: rowBg },
                  isLow && s.trowLow,
                  isNeg && s.trowNeg,
                ]}>
                  {/* # */}
                  <Text style={[s.td, { width: 36, textAlign: 'center', color: COLORS.textMute, fontSize: 11 }]}>
                    {idx + 1}
                  </Text>

                  {/* Name */}
                  <View style={[s.tdCol, { flex: 2.2 }]}>
                    <Text style={s.tdName} numberOfLines={1}>{item.name}</Text>
                    {item.code ? <Text style={s.tdSub} numberOfLines={1}>#{item.code}</Text> : null}
                  </View>

                  {/* Type badge */}
                  <View style={{ width: 72, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={[s.typePill, isService ? s.typePillSvc : s.typePillProd]}>
                      <Text style={[s.typePillTxt, isService ? s.typePillSvcTxt : s.typePillProdTxt]}>
                        {isService ? 'Service' : 'Product'}
                      </Text>
                    </View>
                  </View>

                  {/* HSN/SAC */}
                  <Text style={[s.td, { width: 78 }]} numberOfLines={1}>
                    {item.hsn || '—'}
                  </Text>

                  {/* Unit */}
                  <Text style={[s.td, { width: 54, textAlign: 'center' }]}>{item.unit}</Text>

                  {/* Sale price */}
                  <Text style={[s.td, { flex: 1, textAlign: 'right', fontWeight: FONTS.bold }]}>
                    {formatINR(item.sale_price)}
                  </Text>

                  {/* Cost price */}
                  <Text style={[s.td, { flex: 1, textAlign: 'right', color: COLORS.textSub }]}>
                    {item.purchase_price > 0 ? formatINR(item.purchase_price) : '—'}
                  </Text>

                  {/* GST */}
                  <Text style={[s.td, { width: 52, textAlign: 'center' }]}>{item.gst_rate}%</Text>

                  {/* Stock */}
                  <View style={{ flex: 0.9, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 8 }}>
                    {isService
                      ? <Text style={[s.td, { color: COLORS.textMute }]}>—</Text>
                      : <Text style={[s.td, { fontWeight: FONTS.semibold },
                          isNeg && { color: COLORS.danger },
                          isLow && { color: COLORS.warning },
                        ]}>
                          {item.stock}
                        </Text>
                    }
                    {isLow && <Text style={s.lowHint}>Low</Text>}
                    {isNeg && <Text style={s.negHint}>Neg</Text>}
                  </View>

                  {/* Min stock */}
                  <Text style={[s.td, { width: 50, textAlign: 'center', color: COLORS.textMute }]}>
                    {isService ? '—' : (item.min_stock || '—')}
                  </Text>

                  {/* Stock value */}
                  <Text style={[s.td, { flex: 1.1, textAlign: 'right' },
                    isNeg && { color: COLORS.danger },
                  ]}>
                    {isService ? '—' : formatINR(stockValue)}
                  </Text>

                  {/* Actions */}
                  <View style={s.tdActions}>
                    <TouchableOpacity style={s.editBtn} onPress={() => openEdit(item)}>
                      <Icon name="edit-2" size={13} color={COLORS.textSub} />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.delBtn} onPress={() => handleDelete(item)}>
                      <Icon name="trash-2" size={13} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      {/* ── Bulk Upload Modal ─────────────────────────────── */}
      <Modal visible={bulkModal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modalContainer}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => { setBulkModal(false); setBulkParsed(null); setBulkDone(null); }}>
              <Text style={s.modalCancel}>Close</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>Bulk Item Upload</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={s.modalScroll} keyboardShouldPersistTaps="handled">

            {/* Step 1 */}
            <View style={s.bulkStep}>
              <View style={s.bulkStepNum}><Text style={s.bulkStepNumTxt}>1</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.bulkStepTitle}>Download Template</Text>
                <Text style={s.bulkStepDesc}>Download the CSV template, fill your items, then upload it back.</Text>
              </View>
            </View>

            {/* Template preview card */}
            <View style={s.templateCard}>
              <View style={s.templateHeader}>
                <ExcelIcon />
                <Text style={s.templateName}>LOCAS_Items_Template.csv</Text>
              </View>
              <View style={s.templateCols}>
                {ITEM_TEMPLATE_COLS.map((col, i) => (
                  <View key={i} style={[s.templateCol, col.includes('*') && s.templateColRequired]}>
                    <Text style={[s.templateColTxt, col.includes('*') && s.templateColTxtRequired]}>
                      {col.replace('*', '')}
                      {col.includes('*') ? <Text style={{ color: COLORS.danger }}>*</Text> : null}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={s.templateHint}>* Required. GST must be one of: 0, 5, 12, 18, 28</Text>
            </View>

            <TouchableOpacity style={s.downloadBtn} onPress={handleDownloadTemplate}>
              <ExcelIcon />
              <Text style={s.downloadBtnTxt}>Download Template (.csv)</Text>
            </TouchableOpacity>

            {/* Step 2 */}
            <View style={[s.bulkStep, { marginTop: 20 }]}>
              <View style={s.bulkStepNum}><Text style={s.bulkStepNumTxt}>2</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.bulkStepTitle}>Upload Filled File</Text>
                <Text style={s.bulkStepDesc}>Select your filled CSV to preview and import.</Text>
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
                      <Text style={s.uploadZoneSub}>Supported: .csv exported from Excel or Google Sheets</Text>
                    </>
                }
              </TouchableOpacity>
            )}

            {/* Preview */}
            {bulkParsed && (
              <>
                <View style={s.previewHeader}>
                  <View style={s.previewBadge}>
                    <Icon name="check-circle" size={14} color={COLORS.success} />
                    <Text style={s.previewBadgeTxt}>{bulkParsed.length} items found</Text>
                  </View>
                  <TouchableOpacity style={s.rePickBtn} onPress={() => setBulkParsed(null)}>
                    <Icon name="refresh-cw" size={13} color={COLORS.primary} />
                    <Text style={s.rePickBtnTxt}>Change file</Text>
                  </TouchableOpacity>
                </View>

                <View style={s.previewTable}>
                  <View style={s.previewThead}>
                    {['Name', 'Type', 'Sale ₹', 'GST%', 'Unit', 'Stock'].map((h, i) => (
                      <Text key={h} style={[s.previewTh, i === 0 && { flex: 2 }]}>{h}</Text>
                    ))}
                  </View>
                  {bulkParsed.slice(0, 8).map((item, i) => (
                    <View key={i} style={[s.previewTrow, i % 2 === 0 && { backgroundColor: '#FAFBFF' }]}>
                      <Text style={[s.previewTd, { flex: 2 }]} numberOfLines={1}>{item.name}</Text>
                      <View style={[s.typePill,
                        item.item_type === 'service' ? { backgroundColor: '#E0F2FE' } : { backgroundColor: COLORS.primaryLight }
                      ]}>
                        <Text style={[s.typePillTxt,
                          { color: item.item_type === 'service' ? '#0369A1' : COLORS.primary, fontSize: 8 }
                        ]}>
                          {item.item_type === 'service' ? 'Svc' : 'Prd'}
                        </Text>
                      </View>
                      <Text style={s.previewTd} numberOfLines={1}>₹{item.sale_price}</Text>
                      <Text style={s.previewTd} numberOfLines={1}>{item.gst_rate}%</Text>
                      <Text style={s.previewTd} numberOfLines={1}>{item.unit}</Text>
                      <Text style={s.previewTd} numberOfLines={1}>
                        {item.item_type === 'service' ? '—' : item.stock}
                      </Text>
                    </View>
                  ))}
                  {bulkParsed.length > 8 && (
                    <View style={s.previewMore}>
                      <Text style={s.previewMoreTxt}>+{bulkParsed.length - 8} more items</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[s.importBtn, bulkSaving && { opacity: 0.5 }]}
                  onPress={handleBulkSave}
                  disabled={bulkSaving}
                >
                  {bulkSaving
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <><Icon name="upload" size={15} color="#fff" /><Text style={s.importBtnTxt}>  Import {bulkParsed.length} Items</Text></>
                  }
                </TouchableOpacity>
              </>
            )}

            {/* Success */}
            {bulkDone && (
              <View style={s.doneCard}>
                <View style={s.doneIcon}>
                  <Icon name="check-circle" size={32} color={COLORS.success} />
                </View>
                <Text style={s.doneTitle}>Import Complete!</Text>
                <Text style={s.doneSub}>
                  {bulkDone.added} items added successfully
                  {bulkDone.failed > 0 ? ('\n' + bulkDone.failed + ' failed') : ''}
                </Text>
                <TouchableOpacity style={s.doneBtn} onPress={() => { setBulkModal(false); setBulkDone(null); }}>
                  <Text style={s.doneBtnTxt}>Done</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ── Add / Edit Modal ───────────────────────────────── */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modalContainer}>
          {/* Modal header */}
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setModal(false)}>
              <Text style={s.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>{form.id ? 'Edit Item' : 'New Item'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Text style={[s.modalSave, saving && { opacity: 0.4 }]}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Product / Service toggle */}
          <View style={s.typeToggleBar}>
            <TouchableOpacity
              style={[s.typeBtn, form.item_type === 'product' && s.typeBtnActive]}
              onPress={() => setForm(f => ({ ...f, item_type: 'product', unit: 'pcs' }))}
            >
              <Icon name="package" size={15} color={form.item_type === 'product' ? '#fff' : COLORS.textSub} />
              <Text style={[s.typeBtnTxt, form.item_type === 'product' && s.typeBtnTxtActive]}>
                Product
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.typeBtn, form.item_type === 'service' && s.typeBtnServiceActive]}
              onPress={() => setForm(f => ({ ...f, item_type: 'service', unit: 'hrs', stock: '0', min_stock: '0' }))}
            >
              <Icon name="tool" size={15} color={form.item_type === 'service' ? '#fff' : COLORS.textSub} />
              <Text style={[s.typeBtnTxt, form.item_type === 'service' && s.typeBtnTxtActive]}>
                Service
              </Text>
            </TouchableOpacity>
          </View>

          {/* Hint */}
          <View style={[s.typeHint,
            form.item_type === 'service' ? s.typeHintService : s.typeHintProduct
          ]}>
            <Icon
              name={form.item_type === 'service' ? 'tool' : 'package'}
              size={12}
              color={form.item_type === 'service' ? '#0EA5E9' : COLORS.primary}
            />
            <Text style={[s.typeHintTxt,
              form.item_type === 'service' ? { color: '#0369A1' } : { color: COLORS.primary }
            ]}>
              {form.item_type === 'service'
                ? 'Services have no stock tracking — ideal for labour, consulting, repairs, delivery etc.'
                : 'Products track stock levels and trigger low-stock alerts.'}
            </Text>
          </View>

          <ScrollView style={s.modalScroll} keyboardShouldPersistTaps="handled">

            {/* Name */}
            <FieldLabel>
              {form.item_type === 'service' ? 'Service Name *' : 'Product Name *'}
            </FieldLabel>
            <TextInput
              style={s.input}
              value={form.name}
              onChangeText={v => setForm(f => ({ ...f, name: v }))}
              placeholder={form.item_type === 'service' ? 'e.g. Installation Charges' : 'e.g. Rice Bag 25kg'}
              placeholderTextColor={COLORS.textMute}
            />

            {/* Description — services only */}
            {form.item_type === 'service' && (
              <>
                <FieldLabel>Description (optional)</FieldLabel>
                <TextInput
                  style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
                  value={form.description}
                  onChangeText={v => setForm(f => ({ ...f, description: v }))}
                  placeholder="Brief description of the service..."
                  placeholderTextColor={COLORS.textMute}
                  multiline
                />
              </>
            )}

            {/* Code + HSN/SAC */}
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Item Code</FieldLabel>
                <TextInput
                  style={s.input}
                  value={form.code}
                  onChangeText={v => setForm(f => ({ ...f, code: v }))}
                  placeholder="SKU / code"
                  placeholderTextColor={COLORS.textMute}
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <FieldLabel>{form.item_type === 'service' ? 'SAC Code' : 'HSN Code'}</FieldLabel>
                <TextInput
                  style={s.input}
                  value={form.hsn}
                  onChangeText={v => setForm(f => ({ ...f, hsn: v }))}
                  placeholder={form.item_type === 'service' ? 'e.g. 9987' : 'e.g. 1006'}
                  placeholderTextColor={COLORS.textMute}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Unit */}
            <FieldLabel>Unit</FieldLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(form.item_type === 'service' ? SERVICE_UNITS : PRODUCT_UNITS).map(u => (
                  <TouchableOpacity
                    key={u}
                    style={[s.chip, form.unit === u && s.chipActive]}
                    onPress={() => setForm(f => ({ ...f, unit: u }))}
                  >
                    <Text style={[s.chipText, form.unit === u && s.chipTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Pricing */}
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <FieldLabel>{form.item_type === 'service' ? 'Charge (₹) *' : 'Sale Price (₹) *'}</FieldLabel>
                <TextInput
                  style={s.input}
                  value={form.sale_price}
                  onChangeText={v => setForm(f => ({ ...f, sale_price: v }))}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.textMute}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <FieldLabel>{form.item_type === 'service' ? 'Cost / Expense (₹)' : 'Purchase Price (₹)'}</FieldLabel>
                <TextInput
                  style={s.input}
                  value={form.purchase_price}
                  onChangeText={v => setForm(f => ({ ...f, purchase_price: v }))}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.textMute}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* GST Rate */}
            <FieldLabel>GST Rate</FieldLabel>
            <View style={s.gstRow}>
              {GST_RATES.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[s.gstChip, form.gst_rate === r && s.gstChipActive]}
                  onPress={() => setForm(f => ({ ...f, gst_rate: r }))}
                >
                  <Text style={[s.gstChipText, form.gst_rate === r && s.gstChipTextActive]}>
                    {r}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Stock fields — PRODUCTS ONLY */}
            {form.item_type === 'product' && (
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Opening Stock</FieldLabel>
                  <TextInput
                    style={s.input}
                    value={form.stock}
                    onChangeText={v => setForm(f => ({ ...f, stock: v }))}
                    placeholder="0"
                    placeholderTextColor={COLORS.textMute}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <FieldLabel>Min Stock Alert</FieldLabel>
                  <TextInput
                    style={s.input}
                    value={form.min_stock}
                    onChangeText={v => setForm(f => ({ ...f, min_stock: v }))}
                    placeholder="0"
                    placeholderTextColor={COLORS.textMute}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function KPI({ label, value, color }) {
  return (
    <View style={s.kpiChip}>
      <Text style={[s.kpiVal, { color }]}>{value}</Text>
      <Text style={s.kpiLbl}>{label}</Text>
    </View>
  );
}

function SortHeader({ label, colKey, flex, width, align, sortKey, sortAsc, onSort }) {
  const active = sortKey === colKey;
  const baseStyle = { paddingHorizontal: 8, paddingVertical: 9 };
  const sizeStyle = flex ? { flex } : { width };
  return (
    <TouchableOpacity
      style={[baseStyle, sizeStyle]}
      onPress={() => onSort(colKey)}
      activeOpacity={0.7}
    >
      <Text style={[s.thTxt, { textAlign: align }, active && s.thTxtActive]} numberOfLines={1}>
        {label}{active ? (sortAsc ? ' ↑' : ' ↓') : ''}
      </Text>
    </TouchableOpacity>
  );
}

// Excel-style export icon (green with grid lines)
function ExcelIcon() {
  return (
    <View style={s.excelIcon}>
      <View style={s.excelGrid}>
        <View style={s.excelRow}>
          <View style={[s.excelCell, s.excelCellHeader]} />
          <View style={[s.excelCell, s.excelCellHeader]} />
          <View style={[s.excelCell, s.excelCellHeader, { borderRightWidth: 0 }]} />
        </View>
        <View style={s.excelRow}>
          <View style={[s.excelCell, { borderBottomWidth: 0 }]} />
          <View style={[s.excelCell, { borderBottomWidth: 0 }]} />
          <View style={[s.excelCell, { borderBottomWidth: 0, borderRightWidth: 0 }]} />
        </View>
      </View>
    </View>
  );
}

function FieldLabel({ children }) {
  return <Text style={s.fieldLabel}>{children}</Text>;
}

// ─── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.bg },

  // Header
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle:{ fontSize: 20, fontWeight: FONTS.black, color: COLORS.text },
  headerSub:  { fontSize: 11, color: COLORS.textMute, marginTop: 1 },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Excel export button
  excelBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#86EFAC' },
  excelBtnTxt:{ fontSize: 12, fontWeight: FONTS.bold, color: '#16A34A' },
  excelIcon:  { width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  excelGrid:  { width: 14, height: 14, borderWidth: 1, borderColor: '#16A34A', borderRadius: 2, overflow: 'hidden' },
  excelRow:   { flex: 1, flexDirection: 'row' },
  excelCell:  { flex: 1, borderRightWidth: 1, borderRightColor: '#16A34A', borderBottomWidth: 1, borderBottomColor: '#16A34A' },
  excelCellHeader: { backgroundColor: '#16A34A' },

  // Add button
  addBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.md },
  addBtnTxt:  { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },

  // KPI strip
  kpiStrip:   { flexDirection: 'row', backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  kpiChip:    { flex: 1, alignItems: 'center', paddingVertical: 11 },
  kpiDiv:     { width: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  kpiVal:     { fontSize: 15, fontWeight: FONTS.black, marginBottom: 2 },
  kpiLbl:     { fontSize: 9, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.4 },

  // Toolbar
  toolbar:    { backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingTop: 10 },
  searchBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 12, height: 38, backgroundColor: COLORS.bg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  searchInput:{ flex: 1, fontSize: 13, color: COLORS.text, paddingVertical: 0 },
  chipScroll: { flexGrow: 0 },
  chipRow:    { paddingHorizontal: 12, paddingBottom: 10, gap: 7 },
  chip:       { paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.full, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  chipTxt:    { fontSize: 11, color: COLORS.textSub, fontWeight: FONTS.medium },
  chipTxtActive:{ color: '#fff', fontWeight: FONTS.bold },
  chipDanger: { backgroundColor: COLORS.dangerLight, borderColor: COLORS.danger },
  chipTxtDanger:{ color: COLORS.danger, fontWeight: FONTS.bold },

  // Table
  tableWrap:  { flex: 1 },
  thead:      { flexDirection: 'row', backgroundColor: '#F1F5F9', borderBottomWidth: 2, borderBottomColor: COLORS.border },
  thTxt:      { fontSize: 10, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.4 },
  thTxtActive:{ color: COLORS.primary },

  trow:       { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border, minHeight: 44 },
  trowLow:    { borderLeftWidth: 3, borderLeftColor: COLORS.warning },
  trowNeg:    { borderLeftWidth: 3, borderLeftColor: COLORS.danger },

  td:         { fontSize: 12, color: COLORS.text, paddingHorizontal: 8 },
  tdCol:      { justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 6 },
  tdName:     { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.text },
  tdSub:      { fontSize: 10, color: COLORS.textMute, marginTop: 1 },

  // Type pill
  typePill:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full },
  typePillProd:{ backgroundColor: COLORS.primaryLight },
  typePillSvc: { backgroundColor: '#E0F2FE' },
  typePillTxt: { fontSize: 9, fontWeight: FONTS.black, letterSpacing: 0.2 },
  typePillProdTxt:{ color: COLORS.primary },
  typePillSvcTxt: { color: '#0369A1' },

  // Stock hints
  lowHint:    { fontSize: 8, fontWeight: FONTS.bold, color: COLORS.warning, textTransform: 'uppercase' },
  negHint:    { fontSize: 8, fontWeight: FONTS.bold, color: COLORS.danger, textTransform: 'uppercase' },

  // Action buttons
  tdActions:  { width: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 6 },
  editBtn:    { padding: 6, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgDeep },
  delBtn:     { padding: 6, borderRadius: RADIUS.sm, backgroundColor: COLORS.dangerLight },

  // Empty state
  empty:      { alignItems: 'center', paddingTop: 70, paddingHorizontal: 32 },
  emptyIcon:  { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 6, textAlign: 'center' },
  emptySub:   { fontSize: 13, color: COLORS.textMute, textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  emptyBtn:   { backgroundColor: COLORS.primary, paddingHorizontal: 22, paddingVertical: 10, borderRadius: RADIUS.lg },
  emptyBtnTxt:{ color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },

  // Modal
  modalContainer:    { flex: 1, backgroundColor: COLORS.card, marginTop: Platform.OS === 'web' ? 60 : 0 },
  modalHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle:        { fontSize: 17, fontWeight: FONTS.black, color: COLORS.text },
  modalCancel:       { fontSize: 14, color: COLORS.textSub },
  modalSave:         { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.primary },
  modalScroll:       { padding: 20, paddingBottom: 40 },

  // Product/Service toggle in modal
  typeToggleBar:      { flexDirection: 'row', margin: 16, marginBottom: 0, gap: 8, backgroundColor: COLORS.bg, borderRadius: RADIUS.lg, padding: 4, borderWidth: 1, borderColor: COLORS.border },
  typeBtn:            { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: RADIUS.md },
  typeBtnActive:      { backgroundColor: COLORS.primary },
  typeBtnServiceActive: { backgroundColor: '#0EA5E9' },
  typeBtnTxt:         { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.textSub },
  typeBtnTxtActive:   { color: '#fff', fontWeight: FONTS.bold },
  typeHint:           { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 10, padding: 10, borderRadius: RADIUS.md },
  typeHintProduct:    { backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primary + '33' },
  typeHintService:    { backgroundColor: '#E0F2FE', borderWidth: 1, borderColor: '#BAE6FD' },
  typeHintTxt:        { flex: 1, fontSize: 11, lineHeight: 16 },

  // Form fields
  fieldLabel:   { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7, marginTop: 18 },
  input:        { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.text },
  row:          { flexDirection: 'row', gap: 12 },
  gstRow:       { flexDirection: 'row', gap: 10, marginBottom: 2, flexWrap: 'wrap' },
  gstChip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  gstChipActive:{ backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  gstChipText:  { fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.medium },
  gstChipTextActive: { color: '#fff', fontWeight: FONTS.bold },

  // Unit chips (in modal)
  chipTextActive:{ color: '#fff', fontWeight: FONTS.bold },

  // Service badge on card (legacy, keep for compatibility)
  serviceBadge:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.sm, backgroundColor: '#E0F2FE' },
  serviceBadgeText:{ fontSize: 9, fontWeight: FONTS.bold, color: '#0369A1' },

  // Low stock filter chip (legacy)
  lowFilter:        { paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.full, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  lowFilterActive:  { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  lowFilterText:    { fontSize: 11, color: COLORS.textSub, fontWeight: FONTS.medium },
  lowFilterTextActive:{ color: '#fff', fontWeight: FONTS.bold },

  // Export button (legacy duplicate — kept for modal references)
  exportBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.secondary, paddingVertical: 14, borderRadius: RADIUS.lg, marginTop: 8 },
  exportBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },

  // Bulk upload button in header
  bulkBtn:    { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:11, paddingVertical:8, borderRadius:RADIUS.md, backgroundColor:'#F5F3FF', borderWidth:1, borderColor:'#C4B5FD' },
  bulkBtnTxt: { fontSize:12, fontWeight:FONTS.bold, color:'#8B5CF6' },

  // Bulk modal
  bulkStep:      { flexDirection:'row', alignItems:'flex-start', gap:12, marginBottom:14 },
  bulkStepNum:   { width:28, height:28, borderRadius:14, backgroundColor:COLORS.primary, alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2 },
  bulkStepNumTxt:{ fontSize:13, fontWeight:FONTS.black, color:'#fff' },
  bulkStepTitle: { fontSize:15, fontWeight:FONTS.bold, color:COLORS.text, marginBottom:3 },
  bulkStepDesc:  { fontSize:13, color:COLORS.textSub, lineHeight:19 },

  templateCard:        { backgroundColor:'#F0FDF4', borderRadius:RADIUS.lg, borderWidth:1, borderColor:'#86EFAC', padding:14, marginBottom:12 },
  templateHeader:      { flexDirection:'row', alignItems:'center', gap:8, marginBottom:10 },
  templateName:        { fontSize:13, fontWeight:FONTS.bold, color:'#16A34A' },
  templateCols:        { flexDirection:'row', flexWrap:'wrap', gap:6, marginBottom:8 },
  templateCol:         { paddingHorizontal:8, paddingVertical:4, borderRadius:RADIUS.sm, backgroundColor:'#fff', borderWidth:1, borderColor:'#86EFAC' },
  templateColRequired: { borderColor:COLORS.danger, backgroundColor:'#FEF2F2' },
  templateColTxt:      { fontSize:10, fontWeight:FONTS.medium, color:COLORS.textSub },
  templateColTxtRequired: { color:COLORS.danger, fontWeight:FONTS.bold },
  templateHint:        { fontSize:11, color:COLORS.textMute },

  downloadBtn:    { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:'#16A34A', paddingVertical:13, borderRadius:RADIUS.lg, marginBottom:8 },
  downloadBtnTxt: { fontSize:14, fontWeight:FONTS.bold, color:'#fff' },

  uploadZone:      { alignItems:'center', justifyContent:'center', paddingVertical:36, borderRadius:RADIUS.xl, borderWidth:2, borderColor:COLORS.primary, borderStyle:'dashed', backgroundColor:COLORS.primaryLight, gap:10, marginBottom:8 },
  uploadZoneIcon:  { width:60, height:60, borderRadius:30, backgroundColor:COLORS.card, alignItems:'center', justifyContent:'center' },
  uploadZoneTitle: { fontSize:15, fontWeight:FONTS.bold, color:COLORS.primary },
  uploadZoneSub:   { fontSize:12, color:COLORS.textSub, textAlign:'center', paddingHorizontal:20 },

  previewHeader:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:10 },
  previewBadge:    { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:COLORS.successLight, paddingHorizontal:10, paddingVertical:5, borderRadius:RADIUS.full },
  previewBadgeTxt: { fontSize:12, fontWeight:FONTS.bold, color:COLORS.success },
  rePickBtn:       { flexDirection:'row', alignItems:'center', gap:5 },
  rePickBtnTxt:    { fontSize:12, color:COLORS.primary, fontWeight:FONTS.semibold },

  previewTable:  { backgroundColor:COLORS.card, borderRadius:RADIUS.lg, borderWidth:1, borderColor:COLORS.border, overflow:'hidden', marginBottom:14 },
  previewThead:  { flexDirection:'row', backgroundColor:'#F1F5F9', paddingVertical:8, paddingHorizontal:10, borderBottomWidth:1, borderBottomColor:COLORS.border },
  previewTh:     { flex:1, fontSize:10, fontWeight:FONTS.bold, color:COLORS.textMute, textTransform:'uppercase', letterSpacing:0.4, paddingHorizontal:4 },
  previewTrow:   { flexDirection:'row', alignItems:'center', paddingVertical:9, paddingHorizontal:10, borderBottomWidth:1, borderBottomColor:COLORS.border },
  previewTd:     { flex:1, fontSize:11, color:COLORS.text, paddingHorizontal:4 },
  previewMore:   { padding:10, alignItems:'center', backgroundColor:'#F8FAFC' },
  previewMoreTxt:{ fontSize:12, color:COLORS.textMute, fontWeight:FONTS.medium },

  importBtn:    { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:COLORS.primary, paddingVertical:14, borderRadius:RADIUS.lg, marginBottom:8 },
  importBtnTxt: { fontSize:14, fontWeight:FONTS.bold, color:'#fff' },

  doneCard:  { alignItems:'center', padding:28, backgroundColor:COLORS.successLight, borderRadius:RADIUS.xl, borderWidth:1, borderColor:COLORS.success+'44' },
  doneIcon:  { width:64, height:64, borderRadius:32, backgroundColor:'#fff', alignItems:'center', justifyContent:'center', marginBottom:14 },
  doneTitle: { fontSize:20, fontWeight:FONTS.black, color:COLORS.success, marginBottom:8 },
  doneSub:   { fontSize:14, color:COLORS.success, textAlign:'center', lineHeight:21, marginBottom:20, opacity:0.8 },
  doneBtn:   { backgroundColor:COLORS.success, paddingHorizontal:32, paddingVertical:12, borderRadius:RADIUS.lg },
  doneBtnTxt:{ color:'#fff', fontWeight:FONTS.bold, fontSize:14 },
});