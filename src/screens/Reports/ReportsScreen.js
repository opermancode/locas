import Icon from '../../utils/Icon';
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, StatusBar, TextInput, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getReportData } from '../../db';
import { formatINR, formatINRCompact } from '../../utils/gst';
import { COLORS, RADIUS, FONTS } from '../../theme';

// ── Date helpers ──────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function lastDay(y, m) { return new Date(y, m + 1, 0); }

const FY_START_MONTH = 3; // April = index 3 (0-based)

function getRange(key, customFrom, customTo) {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const fyYear = m >= FY_START_MONTH ? y : y - 1;

  switch (key) {
    case 'today':      return { from: fmtDate(now), to: fmtDate(now) };
    case 'thisWeek': {
      const mon = new Date(now); mon.setDate(now.getDate() - now.getDay() + 1);
      return { from: fmtDate(mon), to: fmtDate(now) };
    }
    case 'thisMonth':  return { from: `${y}-${pad(m+1)}-01`, to: fmtDate(lastDay(y, m)) };
    case 'lastMonth': {
      const lm = m === 0 ? 11 : m - 1, ly = m === 0 ? y - 1 : y;
      return { from: `${ly}-${pad(lm+1)}-01`, to: fmtDate(lastDay(ly, lm)) };
    }
    case 'thisQuarter': {
      const q = Math.floor((m - FY_START_MONTH + 12) % 12 / 3);
      const qStart = (FY_START_MONTH + q * 3) % 12;
      const qYear  = qStart > m ? y - 1 : y;
      return { from: `${qYear}-${pad(qStart+1)}-01`, to: fmtDate(lastDay(qYear, qStart + 2)) };
    }
    case 'thisFY':  return { from: `${fyYear}-04-01`, to: `${fyYear+1}-03-31` };
    case 'lastFY':  return { from: `${fyYear-1}-04-01`, to: `${fyYear}-03-31` };
    case 'custom':  return { from: customFrom, to: customTo };
    default:        return { from: `${y}-${pad(m+1)}-01`, to: fmtDate(lastDay(y, m)) };
  }
}

const PRESETS = [
  { key: 'today',       label: 'Today' },
  { key: 'thisWeek',    label: 'This Week' },
  { key: 'thisMonth',   label: 'This Month' },
  { key: 'lastMonth',   label: 'Last Month' },
  { key: 'thisQuarter', label: 'This Quarter' },
  { key: 'thisFY',      label: 'This FY' },
  { key: 'lastFY',      label: 'Last FY' },
  { key: 'custom',      label: 'Custom' },
];

// Report tabs
const REPORT_TABS = [
  { key: 'overview',  label: 'Overview',   icon: 'bar-chart-2' },
  { key: 'sales',     label: 'Sales',      icon: 'file-text'   },
  { key: 'purchases', label: 'Purchases',  icon: 'shopping-bag'},
  { key: 'expenses',  label: 'Expenses',   icon: 'credit-card' },
  { key: 'gst',       label: 'GST / GSTR', icon: 'hash'        },
  { key: 'pl',        label: 'P & L',      icon: 'trending-up' },
];

// ── CSV download helper ────────────────────────────────────────────
function downloadCSV(filename, content) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function esc(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}
const n2 = (v) => Number(v || 0).toFixed(2);

export default function ReportsScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [preset,     setPreset]     = useState('thisMonth');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');
  const [activeTab,  setActiveTab]  = useState('overview');
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [exporting,  setExporting]  = useState(false);

  const load = async (p = preset, cf = customFrom, ct = customTo) => {
    setLoading(true);
    try {
      const { from, to } = getRange(p, cf, ct);
      if (!from || !to) return;
      const d = await getReportData(from, to);
      setData(d);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const switchPreset = (p) => {
    setPreset(p);
    if (p !== 'custom') load(p);
  };

  const applyCustom = () => { if (customFrom && customTo) load('custom', customFrom, customTo); };

  // ── Derived numbers ───────────────────────────────────────────
  const sales      = data?.sales     || [];
  const purchases  = data?.purchases || [];
  const expenses   = data?.expenses  || [];

  const totalSales       = sales.reduce((s, i) => s + (i.total  || 0), 0);
  const totalCollected   = sales.reduce((s, i) => s + (i.paid   || 0), 0);
  const totalOutstanding = totalSales - totalCollected;
  const totalPurchases   = purchases.reduce((s, i) => s + (i.total || 0), 0);
  const totalExpenses    = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit        = totalSales - totalPurchases - totalExpenses;

  const cgst = data?.gst?.cgst  || 0;
  const sgst = data?.gst?.sgst  || 0;
  const igst = data?.gst?.igst  || 0;
  const totalTax = data?.gst?.total || 0;

  const { from, to } = getRange(preset, customFrom, customTo);
  const periodLabel  = from && to ? `${from}  →  ${to}` : '—';

  // ── Export functions ──────────────────────────────────────────
  const exportSalesCSV = () => {
    const header = 'Invoice No,Date,Party,GSTIN,Supply,Taxable,CGST,SGST,IGST,Total Tax,Total,Paid,Outstanding,Status';
    const rows   = sales.map(i => [
      i.invoice_number, i.date, esc(i.party_name), esc(i.party_gstin || ''),
      i.supply_type === 'inter' ? 'Inter' : 'Intra',
      n2(i.taxable), n2(i.cgst), n2(i.sgst), n2(i.igst), n2(i.total_tax),
      n2(i.total), n2(i.paid), n2((i.total||0)-(i.paid||0)), i.status || 'unpaid',
    ].join(','));
    downloadCSV(`Sales_${from}_${to}.csv`, [header, ...rows].join('\n'));
  };

  const exportGSTR1CSV = () => {
    const lines = [
      '# GSTR-1 — B2B Sales Summary',
      `# Period: ${from} to ${to}`,
      `# Generated: ${new Date().toLocaleDateString('en-IN')}`,
      '',
      '# B2B Invoices (with GSTIN)',
      'Invoice No,Date,Party Name,GSTIN,Taxable Value,IGST,CGST,SGST,Total Tax,Invoice Value,Place of Supply',
    ];
    const b2b = sales.filter(i => i.party_gstin);
    b2b.forEach(i => lines.push([
      i.invoice_number, i.date, esc(i.party_name), i.party_gstin,
      n2(i.taxable), n2(i.igst), n2(i.cgst), n2(i.sgst), n2(i.total_tax),
      n2(i.total), esc(i.party_state || ''),
    ].join(',')));
    lines.push('');
    lines.push(`B2B Total,,,,,${n2(b2b.reduce((s,i)=>s+(i.igst||0),0))},${n2(b2b.reduce((s,i)=>s+(i.cgst||0),0))},${n2(b2b.reduce((s,i)=>s+(i.sgst||0),0))},${n2(b2b.reduce((s,i)=>s+(i.total_tax||0),0))},${n2(b2b.reduce((s,i)=>s+(i.total||0),0))}`);

    lines.push('');
    lines.push('# B2C / Walk-in (without GSTIN)');
    lines.push('Invoice No,Date,Party Name,Taxable Value,IGST,CGST,SGST,Total Tax,Invoice Value');
    const b2c = sales.filter(i => !i.party_gstin);
    b2c.forEach(i => lines.push([
      i.invoice_number, i.date, esc(i.party_name || 'Walk-in'),
      n2(i.taxable), n2(i.igst), n2(i.cgst), n2(i.sgst), n2(i.total_tax), n2(i.total),
    ].join(',')));

    lines.push('');
    lines.push('# GST Summary');
    lines.push('Type,Amount');
    lines.push(`Total Taxable,${n2(sales.reduce((s,i)=>s+(i.taxable||0),0))}`);
    lines.push(`CGST,${n2(cgst)}`);
    lines.push(`SGST,${n2(sgst)}`);
    lines.push(`IGST,${n2(igst)}`);
    lines.push(`Total Tax,${n2(totalTax)}`);
    lines.push(`Total Invoice Value,${n2(totalSales)}`);

    downloadCSV(`GSTR1_${from}_${to}.csv`, lines.join('\n'));
  };

  const exportFullReport = () => {
    const lines = [
      `# LOCAS — Full Business Report`,
      `# Period: ${from} to ${to}`,
      `# Generated: ${new Date().toLocaleDateString('en-IN')}`,
      '',
      '# P&L SUMMARY',
      `Total Sales,${n2(totalSales)}`,
      `Total Purchases,${n2(totalPurchases)}`,
      `Total Expenses,${n2(totalExpenses)}`,
      `Net Profit,${n2(netProfit)}`,
      '',
      '# SALES',
      'Invoice No,Date,Party,GSTIN,Taxable,CGST,SGST,IGST,Total Tax,Total,Paid,Outstanding,Status',
      ...sales.map(i => [i.invoice_number,i.date,esc(i.party_name),esc(i.party_gstin||''),n2(i.taxable),n2(i.cgst),n2(i.sgst),n2(i.igst),n2(i.total_tax),n2(i.total),n2(i.paid),n2((i.total||0)-(i.paid||0)),i.status||'unpaid'].join(',')),
      '',
      '# PURCHASES',
      'Invoice No,Date,Party,Total,Paid,Outstanding,Status',
      ...purchases.map(i => [i.invoice_number,i.date,esc(i.party_name),n2(i.total),n2(i.paid),n2((i.total||0)-(i.paid||0)),i.status||'unpaid'].join(',')),
      '',
      '# EXPENSES',
      'Date,Category,Party,Bill No,Method,Amount,Note',
      ...expenses.map(e => [e.date,esc(e.category),esc(e.party_name||''),esc(e.bill_no||''),esc(e.method||''),n2(e.amount),esc(e.note||'')].join(',')),
      '',
      '# GST SUMMARY',
      `CGST,${n2(cgst)}`,
      `SGST,${n2(sgst)}`,
      `IGST,${n2(igst)}`,
      `Total Tax,${n2(totalTax)}`,
    ];
    downloadCSV(`Report_${from}_${to}.csv`, lines.join('\n'));
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.card} />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Reports</Text>
          <Text style={s.headerSub}>{periodLabel}</Text>
        </View>
        <TouchableOpacity style={s.exportAllBtn} onPress={exportFullReport} disabled={!data}>
          <Icon name="download" size={14} color="#16A34A" />
          <Text style={s.exportAllTxt}>Export All</Text>
        </TouchableOpacity>
      </View>

      {/* ── Period selector ── */}
      <View style={s.periodBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.presetRow}>
          {PRESETS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[s.presetChip, preset === p.key && s.presetChipActive]}
              onPress={() => switchPreset(p.key)}
            >
              <Text style={[s.presetTxt, preset === p.key && s.presetTxtActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Custom date pickers */}
        {preset === 'custom' && (
          <View style={s.customRow}>
            <TextInput
              style={s.dateInput}
              value={customFrom}
              onChangeText={setCustomFrom}
              placeholder="From YYYY-MM-DD"
              placeholderTextColor={COLORS.textMute}
            />
            <Text style={{ color: COLORS.textMute, fontSize: 12 }}>→</Text>
            <TextInput
              style={s.dateInput}
              value={customTo}
              onChangeText={setCustomTo}
              placeholder="To YYYY-MM-DD"
              placeholderTextColor={COLORS.textMute}
            />
            <TouchableOpacity style={s.applyBtn} onPress={applyCustom}>
              <Text style={s.applyTxt}>Apply</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Report type tabs ── */}
      <View style={s.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
          {REPORT_TABS.map(t => (
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

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={s.loadingTxt}>Crunching numbers…</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* ════ OVERVIEW ════ */}
          {activeTab === 'overview' && (
            <>
              {/* P&L Hero */}
              <View style={s.plHero}>
                <Text style={s.plHeroLabel}>Net Profit / Loss</Text>
                <Text style={[s.plHeroAmt, { color: netProfit >= 0 ? '#4ADE80' : '#F87171' }]}>
                  {netProfit >= 0 ? '' : '−'}{formatINR(Math.abs(netProfit))}
                </Text>
                <Text style={s.plHeroPeriod}>{periodLabel}</Text>
                <View style={s.plRow}>
                  <PLStat label="Sales"    value={totalSales}    color="#4ADE80" />
                  <View style={s.plDiv} />
                  <PLStat label="Purchases" value={totalPurchases} color="#F87171" />
                  <View style={s.plDiv} />
                  <PLStat label="Expenses"  value={totalExpenses}  color="#FBBF24" />
                </View>
              </View>

              {/* 4 KPI tiles */}
              <View style={s.kpiGrid}>
                <KPITile label="Total Sales"    value={formatINRCompact(totalSales)}       color="#3B82F6" icon="file-text"   bg="#EFF6FF" />
                <KPITile label="Collected"      value={formatINRCompact(totalCollected)}   color="#16A34A" icon="check-circle" bg="#F0FDF4" />
                <KPITile label="Outstanding"    value={formatINRCompact(totalOutstanding)} color={totalOutstanding > 0 ? '#DC2626' : '#6B7280'} icon="clock" bg="#FEF2F2" />
                <KPITile label="Total Tax"      value={formatINRCompact(totalTax)}         color="#8B5CF6" icon="hash"        bg="#F5F3FF" />
              </View>

              {/* Sales summary */}
              <SectionHead title="Sales Summary" count={`${sales.length} invoices`} />
              <View style={s.card}>
                <DataRow label="Total Invoiced"  value={formatINR(totalSales)} />
                <DataRow label="Collected"        value={formatINR(totalCollected)}   color={COLORS.success} />
                <DataRow label="Outstanding"      value={formatINR(totalOutstanding)} color={totalOutstanding > 0 ? COLORS.danger : COLORS.textMute} />
                <DataRow label="Invoices Count"   value={String(sales.length)} />
                {sales.length > 0 && <DataRow label="Avg Invoice Value" value={formatINR(totalSales / sales.length)} />}
                <DataRow label="B2B (with GSTIN)" value={String(sales.filter(i => i.party_gstin).length) + ' invoices'} muted />
                <DataRow label="B2C / Walk-in"    value={String(sales.filter(i => !i.party_gstin).length) + ' invoices'} muted last />
              </View>

              {/* Top customers */}
              {(() => {
                const byParty = {};
                sales.forEach(i => { byParty[i.party_name||'Walk-in'] = (byParty[i.party_name||'Walk-in']||0) + (i.total||0); });
                const top = Object.entries(byParty).sort((a,b) => b[1]-a[1]).slice(0,5);
                if (!top.length) return null;
                return (
                  <>
                    <SectionHead title="Top Customers" />
                    <View style={s.card}>
                      {top.map(([name, amt], i) => (
                        <View key={name} style={[s.topRow, i < top.length-1 && s.rowBorder]}>
                          <View style={s.rankBadge}><Text style={s.rankTxt}>#{i+1}</Text></View>
                          <Text style={s.topName} numberOfLines={1}>{name}</Text>
                          <Text style={s.topAmt}>{formatINR(amt)}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                );
              })()}

              {/* GST quick view */}
              <SectionHead title="GST Collected" />
              <View style={s.gstBoxRow}>
                <GSTBox label="CGST" value={cgst} color="#6366F1" />
                <GSTBox label="SGST" value={sgst} color="#8B5CF6" />
                <GSTBox label="IGST" value={igst} color="#EC4899" />
              </View>
              <View style={s.card}>
                <DataRow label="Total Tax Collected" value={formatINR(totalTax)} last />
              </View>
            </>
          )}

          {/* ════ SALES ════ */}
          {activeTab === 'sales' && (
            <>
              <View style={s.tabHeaderRow}>
                <Text style={s.tabHeaderTitle}>Sales Report</Text>
                <TouchableOpacity style={s.csvBtn} onPress={exportSalesCSV}>
                  <Icon name="download" size={13} color="#16A34A" />
                  <Text style={s.csvBtnTxt}>CSV</Text>
                </TouchableOpacity>
              </View>

              {/* Summary tiles */}
              <View style={s.summaryStrip}>
                <SummaryCell label="Invoices"    value={sales.length}                 color={COLORS.primary} />
                <SummaryCell label="Total"       value={formatINRCompact(totalSales)} color={COLORS.primary} />
                <SummaryCell label="Collected"   value={formatINRCompact(totalCollected)} color={COLORS.success} />
                <SummaryCell label="Outstanding" value={formatINRCompact(totalOutstanding)} color={COLORS.danger} />
              </View>

              {/* Sales table */}
              {sales.length === 0 ? (
                <EmptyState icon="file-text" title="No sales in this period" />
              ) : (
                <View style={s.tableCard}>
                  <View style={s.thead}>
                    {['Invoice #','Date','Party','Total','Paid','Balance','Status'].map((h, i) => (
                      <Text key={h} style={[s.th, i === 0 && { flex: 1.2 }, i === 2 && { flex: 2 }, i >= 3 && { textAlign: 'right' }]}>{h}</Text>
                    ))}
                  </View>
                  {sales.map((inv, idx) => {
                    const bal = (inv.total||0) - (inv.paid||0);
                    const isPaid = inv.status === 'paid';
                    const statusColor = isPaid ? '#16A34A' : bal > 0 ? '#DC2626' : '#6B7280';
                    return (
                      <View key={inv.id} style={[s.trow, idx%2===0 && s.trowEven]}>
                        <Text style={[s.td, { flex: 1.2, color: COLORS.primary, fontWeight: FONTS.bold }]} numberOfLines={1}>{inv.invoice_number}</Text>
                        <Text style={[s.td, { flex: 1 }]} numberOfLines={1}>{inv.date}</Text>
                        <Text style={[s.td, { flex: 2 }]} numberOfLines={1}>{inv.party_name || 'Walk-in'}</Text>
                        <Text style={[s.td, { flex: 1, textAlign: 'right', fontWeight: FONTS.semibold }]}>{formatINR(inv.total)}</Text>
                        <Text style={[s.td, { flex: 1, textAlign: 'right', color: COLORS.success }]}>{formatINR(inv.paid||0)}</Text>
                        <Text style={[s.td, { flex: 1, textAlign: 'right', color: bal > 0.01 ? COLORS.danger : COLORS.textMute }]}>{bal > 0.01 ? formatINR(bal) : '—'}</Text>
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                          <View style={[s.statusPill, { backgroundColor: statusColor + '18' }]}>
                            <Text style={[s.statusPillTxt, { color: statusColor }]}>{(inv.status||'unpaid').charAt(0).toUpperCase()+(inv.status||'unpaid').slice(1)}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {/* ════ PURCHASES ════ */}
          {activeTab === 'purchases' && (
            <>
              <View style={s.tabHeaderRow}>
                <Text style={s.tabHeaderTitle}>Purchase Report</Text>
              </View>
              <View style={s.summaryStrip}>
                <SummaryCell label="Bills"      value={purchases.length}                  color={COLORS.info} />
                <SummaryCell label="Total"      value={formatINRCompact(totalPurchases)}  color={COLORS.info} />
                <SummaryCell label="Paid"       value={formatINRCompact(purchases.reduce((s,i)=>s+(i.paid||0),0))} color={COLORS.success} />
                <SummaryCell label="Payable"    value={formatINRCompact(purchases.reduce((s,i)=>s+Math.max(0,(i.total||0)-(i.paid||0)),0))} color={COLORS.danger} />
              </View>
              {purchases.length === 0 ? (
                <EmptyState icon="shopping-bag" title="No purchases in this period" />
              ) : (
                <View style={s.tableCard}>
                  <View style={s.thead}>
                    {['Invoice #','Date','Supplier','Total','Paid','Balance','Status'].map((h,i) => (
                      <Text key={h} style={[s.th, i===0&&{flex:1.2}, i===2&&{flex:2}, i>=3&&{textAlign:'right'}]}>{h}</Text>
                    ))}
                  </View>
                  {purchases.map((inv, idx) => {
                    const bal = (inv.total||0)-(inv.paid||0);
                    return (
                      <View key={inv.id} style={[s.trow, idx%2===0&&s.trowEven]}>
                        <Text style={[s.td,{flex:1.2,color:COLORS.info,fontWeight:FONTS.bold}]} numberOfLines={1}>{inv.invoice_number}</Text>
                        <Text style={[s.td,{flex:1}]} numberOfLines={1}>{inv.date}</Text>
                        <Text style={[s.td,{flex:2}]} numberOfLines={1}>{inv.party_name||'—'}</Text>
                        <Text style={[s.td,{flex:1,textAlign:'right',fontWeight:FONTS.semibold}]}>{formatINR(inv.total)}</Text>
                        <Text style={[s.td,{flex:1,textAlign:'right',color:COLORS.success}]}>{formatINR(inv.paid||0)}</Text>
                        <Text style={[s.td,{flex:1,textAlign:'right',color:bal>0.01?COLORS.danger:COLORS.textMute}]}>{bal>0.01?formatINR(bal):'—'}</Text>
                        <View style={{flex:1,alignItems:'center',justifyContent:'center'}}>
                          <View style={[s.statusPill,{backgroundColor:(inv.status==='paid'?'#16A34A':'#DC2626')+'18'}]}>
                            <Text style={[s.statusPillTxt,{color:inv.status==='paid'?'#16A34A':'#DC2626'}]}>{inv.status==='paid'?'Paid':'Due'}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {/* ════ EXPENSES ════ */}
          {activeTab === 'expenses' && (
            <>
              <View style={s.tabHeaderRow}>
                <Text style={s.tabHeaderTitle}>Expense Report</Text>
              </View>
              <View style={s.summaryStrip}>
                <SummaryCell label="Entries"  value={expenses.length}                color={COLORS.danger} />
                <SummaryCell label="Total"    value={formatINRCompact(totalExpenses)} color={COLORS.danger} />
              </View>
              {/* By category breakdown */}
              {expenses.length > 0 && (() => {
                const byCat = {};
                expenses.forEach(e => { byCat[e.category||'Other'] = (byCat[e.category||'Other']||0) + (e.amount||0); });
                const cats = Object.entries(byCat).sort((a,b) => b[1]-a[1]);
                return (
                  <>
                    <SectionHead title="By Category" />
                    <View style={s.card}>
                      {cats.map(([cat, amt], i) => (
                        <DataRow key={cat} label={cat} value={formatINR(amt)} last={i===cats.length-1} />
                      ))}
                    </View>
                  </>
                );
              })()}
              {expenses.length === 0 ? (
                <EmptyState icon="credit-card" title="No expenses in this period" />
              ) : (
                <>
                  <SectionHead title="All Entries" />
                  <View style={s.tableCard}>
                    <View style={s.thead}>
                      {['Date','Category','Party','Amount','Method'].map((h,i) => (
                        <Text key={h} style={[s.th, i===1&&{flex:1.5}, i===2&&{flex:2}, i===3&&{textAlign:'right'}]}>{h}</Text>
                      ))}
                    </View>
                    {expenses.map((e, idx) => (
                      <View key={e.id||idx} style={[s.trow, idx%2===0&&s.trowEven]}>
                        <Text style={[s.td,{flex:1}]} numberOfLines={1}>{e.date}</Text>
                        <Text style={[s.td,{flex:1.5}]} numberOfLines={1}>{e.category||'—'}</Text>
                        <Text style={[s.td,{flex:2}]} numberOfLines={1}>{e.party_name||'—'}</Text>
                        <Text style={[s.td,{flex:1,textAlign:'right',fontWeight:FONTS.semibold,color:COLORS.danger}]}>{formatINR(e.amount)}</Text>
                        <Text style={[s.td,{flex:1}]} numberOfLines={1}>{e.method||'—'}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </>
          )}

          {/* ════ GST / GSTR ════ */}
          {activeTab === 'gst' && (
            <>
              <View style={s.tabHeaderRow}>
                <Text style={s.tabHeaderTitle}>GST / GSTR-1 Report</Text>
                <TouchableOpacity style={s.csvBtn} onPress={exportGSTR1CSV}>
                  <Icon name="download" size={13} color="#16A34A" />
                  <Text style={s.csvBtnTxt}>GSTR-1 CSV</Text>
                </TouchableOpacity>
              </View>

              {/* GST summary boxes */}
              <View style={s.gstBoxRow}>
                <GSTBox label="CGST" value={cgst} color="#6366F1" />
                <GSTBox label="SGST" value={sgst} color="#8B5CF6" />
                <GSTBox label="IGST" value={igst} color="#EC4899" />
              </View>

              <View style={s.card}>
                <DataRow label="Total Taxable Value" value={formatINR(sales.reduce((s,i)=>s+(i.taxable||0),0))} />
                <DataRow label="Total Tax Collected" value={formatINR(totalTax)} color={COLORS.primary} />
                <DataRow label="Intra-state (CGST+SGST)" value={`${sales.filter(i=>i.supply_type!=='inter').length} invoices`} muted />
                <DataRow label="Inter-state (IGST)"      value={`${sales.filter(i=>i.supply_type==='inter').length} invoices`} muted last />
              </View>

              {/* GSTR-1: B2B */}
              <SectionHead title="GSTR-1 — B2B Invoices (with GSTIN)" count={`${sales.filter(i=>i.party_gstin).length}`} />
              {sales.filter(i => i.party_gstin).length === 0 ? (
                <View style={[s.card,{alignItems:'center',paddingVertical:20}]}>
                  <Text style={{color:COLORS.textMute,fontSize:13}}>No B2B invoices in this period</Text>
                </View>
              ) : (
                <View style={s.tableCard}>
                  <View style={s.thead}>
                    {['Invoice #','Date','Party / GSTIN','Taxable','CGST','SGST','IGST','Total'].map((h,i) => (
                      <Text key={h} style={[s.th, i===2&&{flex:2.5}, i>=3&&{textAlign:'right'}]}>{h}</Text>
                    ))}
                  </View>
                  {sales.filter(i=>i.party_gstin).map((inv, idx) => (
                    <View key={inv.id} style={[s.trow, idx%2===0&&s.trowEven]}>
                      <Text style={[s.td,{flex:1,color:COLORS.primary,fontWeight:FONTS.bold}]} numberOfLines={1}>{inv.invoice_number}</Text>
                      <Text style={[s.td,{flex:1}]} numberOfLines={1}>{inv.date}</Text>
                      <View style={[{flex:2.5,paddingHorizontal:8,justifyContent:'center'}]}>
                        <Text style={[s.td,{paddingHorizontal:0,fontWeight:FONTS.medium}]} numberOfLines={1}>{inv.party_name}</Text>
                        <Text style={{fontSize:10,color:COLORS.textMute}} numberOfLines={1}>{inv.party_gstin}</Text>
                      </View>
                      <Text style={[s.td,{flex:1,textAlign:'right'}]}>{formatINR(inv.taxable)}</Text>
                      <Text style={[s.td,{flex:1,textAlign:'right'}]}>{formatINR(inv.cgst)}</Text>
                      <Text style={[s.td,{flex:1,textAlign:'right'}]}>{formatINR(inv.sgst)}</Text>
                      <Text style={[s.td,{flex:1,textAlign:'right'}]}>{formatINR(inv.igst)}</Text>
                      <Text style={[s.td,{flex:1,textAlign:'right',fontWeight:FONTS.bold}]}>{formatINR(inv.total)}</Text>
                    </View>
                  ))}
                  {/* Totals row */}
                  <View style={[s.trow,{backgroundColor:'#EFF6FF'}]}>
                    <Text style={[s.td,{flex:1,fontWeight:FONTS.bold}]}>Total</Text>
                    <Text style={[s.td,{flex:1}]} />
                    <Text style={[s.td,{flex:2.5}]} />
                    <Text style={[s.td,{flex:1,textAlign:'right',fontWeight:FONTS.bold}]}>{formatINR(sales.filter(i=>i.party_gstin).reduce((s,i)=>s+(i.taxable||0),0))}</Text>
                    <Text style={[s.td,{flex:1,textAlign:'right',fontWeight:FONTS.bold}]}>{formatINR(sales.filter(i=>i.party_gstin).reduce((s,i)=>s+(i.cgst||0),0))}</Text>
                    <Text style={[s.td,{flex:1,textAlign:'right',fontWeight:FONTS.bold}]}>{formatINR(sales.filter(i=>i.party_gstin).reduce((s,i)=>s+(i.sgst||0),0))}</Text>
                    <Text style={[s.td,{flex:1,textAlign:'right',fontWeight:FONTS.bold}]}>{formatINR(sales.filter(i=>i.party_gstin).reduce((s,i)=>s+(i.igst||0),0))}</Text>
                    <Text style={[s.td,{flex:1,textAlign:'right',fontWeight:FONTS.bold}]}>{formatINR(sales.filter(i=>i.party_gstin).reduce((s,i)=>s+(i.total||0),0))}</Text>
                  </View>
                </View>
              )}

              {/* GSTR-1: B2C */}
              <SectionHead title="GSTR-1 — B2C / Walk-in (no GSTIN)" count={`${sales.filter(i=>!i.party_gstin).length}`} />
              {sales.filter(i=>!i.party_gstin).length > 0 && (
                <View style={s.tableCard}>
                  <View style={s.thead}>
                    {['Invoice #','Date','Party','Taxable','Tax','Total'].map((h,i) => (
                      <Text key={h} style={[s.th, i===2&&{flex:2}, i>=3&&{textAlign:'right'}]}>{h}</Text>
                    ))}
                  </View>
                  {sales.filter(i=>!i.party_gstin).map((inv, idx) => (
                    <View key={inv.id} style={[s.trow, idx%2===0&&s.trowEven]}>
                      <Text style={[s.td,{flex:1,color:COLORS.primary,fontWeight:FONTS.bold}]} numberOfLines={1}>{inv.invoice_number}</Text>
                      <Text style={[s.td,{flex:1}]} numberOfLines={1}>{inv.date}</Text>
                      <Text style={[s.td,{flex:2}]} numberOfLines={1}>{inv.party_name||'Walk-in'}</Text>
                      <Text style={[s.td,{flex:1,textAlign:'right'}]}>{formatINR(inv.taxable)}</Text>
                      <Text style={[s.td,{flex:1,textAlign:'right'}]}>{formatINR(inv.total_tax)}</Text>
                      <Text style={[s.td,{flex:1,textAlign:'right',fontWeight:FONTS.bold}]}>{formatINR(inv.total)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Export note */}
              <View style={s.infoBox}>
                <Icon name="info" size={14} color={COLORS.info} />
                <Text style={s.infoTxt}>
                  Tap "GSTR-1 CSV" to export a CSV file ready for your CA or for filing on the GST portal. 
                  B2B invoices (with GSTIN) and B2C invoices are listed separately as required by GSTR-1.
                </Text>
              </View>
            </>
          )}

          {/* ════ P & L ════ */}
          {activeTab === 'pl' && (
            <>
              <View style={s.tabHeaderRow}>
                <Text style={s.tabHeaderTitle}>Profit & Loss</Text>
              </View>

              <View style={s.plHero}>
                <Text style={s.plHeroLabel}>Net Profit / Loss</Text>
                <Text style={[s.plHeroAmt, { color: netProfit >= 0 ? '#4ADE80' : '#F87171' }]}>
                  {netProfit >= 0 ? '' : '−'}{formatINR(Math.abs(netProfit))}
                </Text>
                <Text style={s.plHeroPeriod}>{periodLabel}</Text>
              </View>

              <SectionHead title="Income" />
              <View style={s.card}>
                <DataRow label="Total Sales (Gross)"   value={formatINR(totalSales)} />
                <DataRow label="Collected"              value={formatINR(totalCollected)} color={COLORS.success} />
                <DataRow label="Outstanding Receivable" value={formatINR(totalOutstanding)} color={COLORS.danger} muted last />
              </View>

              <SectionHead title="Cost of Goods / Purchases" />
              <View style={s.card}>
                <DataRow label="Total Purchases" value={formatINR(totalPurchases)} color={COLORS.danger} last />
              </View>

              <SectionHead title="Operating Expenses" />
              <View style={s.card}>
                {expenses.length === 0
                  ? <DataRow label="No expenses this period" value="₹0.00" last />
                  : (() => {
                      const byCat = {};
                      expenses.forEach(e => { byCat[e.category||'Other'] = (byCat[e.category||'Other']||0)+(e.amount||0); });
                      const cats = Object.entries(byCat).sort((a,b) => b[1]-a[1]);
                      return cats.map(([cat, amt], i) => (
                        <DataRow key={cat} label={cat} value={formatINR(amt)} muted={i>0} last={i===cats.length-1} />
                      ));
                    })()
                }
              </View>
              <View style={s.card}>
                <DataRow label="Total Expenses" value={formatINR(totalExpenses)} color={COLORS.danger} last />
              </View>

              <SectionHead title="GST" />
              <View style={s.card}>
                <DataRow label="Total GST Collected" value={formatINR(totalTax)} last />
              </View>

              {/* P&L Summary */}
              <View style={s.plSummaryCard}>
                <Text style={s.plSummaryTitle}>P&L Summary</Text>
                <View style={s.plSummaryRow}>
                  <Text style={s.plSummaryLabel}>Total Sales</Text>
                  <Text style={[s.plSummaryValue, {color:'#4ADE80'}]}>+{formatINR(totalSales)}</Text>
                </View>
                <View style={s.plSummaryRow}>
                  <Text style={s.plSummaryLabel}>Total Purchases</Text>
                  <Text style={[s.plSummaryValue,{color:'#F87171'}]}>−{formatINR(totalPurchases)}</Text>
                </View>
                <View style={s.plSummaryRow}>
                  <Text style={s.plSummaryLabel}>Total Expenses</Text>
                  <Text style={[s.plSummaryValue,{color:'#FBBF24'}]}>−{formatINR(totalExpenses)}</Text>
                </View>
                <View style={[s.plSummaryRow,s.plSummaryTotal]}>
                  <Text style={s.plSummaryTotalLabel}>Net Profit / Loss</Text>
                  <Text style={[s.plSummaryTotalValue,{color:netProfit>=0?'#4ADE80':'#F87171'}]}>
                    {netProfit>=0?'+':'−'}{formatINR(Math.abs(netProfit))}
                  </Text>
                </View>
              </View>
            </>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function SectionHead({ title, count }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionHeadTxt}>{title}</Text>
      {count !== undefined && <Text style={s.sectionCount}>{count}</Text>}
    </View>
  );
}

function DataRow({ label, value, color, muted, last }) {
  return (
    <View style={[s.dataRow, !last && s.dataRowBorder]}>
      <Text style={[s.dataLabel, muted && s.dataLabelMuted]}>{muted ? `  ↳ ${label}` : label}</Text>
      <Text style={[s.dataValue, color && { color }]}>{value}</Text>
    </View>
  );
}

function KPITile({ label, value, color, icon, bg }) {
  return (
    <View style={[s.kpiTile, { borderTopColor: color }]}>
      <View style={[s.kpiIcon, { backgroundColor: bg }]}>
        <Icon name={icon} size={15} color={color} />
      </View>
      <Text style={[s.kpiAmt, { color }]}>{value}</Text>
      <Text style={s.kpiLbl}>{label}</Text>
    </View>
  );
}

function PLStat({ label, value, color }) {
  return (
    <View style={s.plStat}>
      <Text style={[s.plStatAmt, { color }]}>{formatINRCompact(Math.abs(value))}</Text>
      <Text style={s.plStatLbl}>{label}</Text>
    </View>
  );
}

function GSTBox({ label, value, color }) {
  return (
    <View style={[s.gstBox, { borderTopColor: color }]}>
      <Text style={[s.gstAmt, { color }]}>{formatINR(value)}</Text>
      <Text style={s.gstLbl}>{label}</Text>
    </View>
  );
}

function SummaryCell({ label, value, color }) {
  return (
    <View style={s.summaryCell}>
      <Text style={[s.summaryCellVal, { color }]}>{typeof value === 'number' ? value : value}</Text>
      <Text style={s.summaryCellLbl}>{label}</Text>
    </View>
  );
}

function EmptyState({ icon, title }) {
  return (
    <View style={s.emptyState}>
      <Icon name={icon} size={28} color={COLORS.textMute} />
      <Text style={s.emptyStateTxt}>{title}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.bg },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:     { padding: 14, paddingBottom: 40 },
  loadingTxt: { fontSize: 13, color: COLORS.textMute, marginTop: 12 },

  // Header
  header:      { flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:12, backgroundColor:COLORS.card, borderBottomWidth:1, borderBottomColor:COLORS.border },
  backBtn:     { padding:4, marginRight:10 },
  headerTitle: { fontSize:19, fontWeight:FONTS.black, color:COLORS.text },
  headerSub:   { fontSize:10, color:COLORS.textMute, marginTop:1 },
  exportAllBtn:{ flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:12, paddingVertical:8, borderRadius:RADIUS.md, backgroundColor:'#F0FDF4', borderWidth:1, borderColor:'#86EFAC' },
  exportAllTxt:{ fontSize:12, fontWeight:FONTS.bold, color:'#16A34A' },

  // Period bar
  periodBar:  { backgroundColor:COLORS.card, borderBottomWidth:1, borderBottomColor:COLORS.border },
  presetRow:  { paddingHorizontal:12, paddingVertical:10, gap:7 },
  presetChip: { paddingHorizontal:13, paddingVertical:6, borderRadius:RADIUS.full, backgroundColor:COLORS.bg, borderWidth:1, borderColor:COLORS.border },
  presetChipActive: { backgroundColor:COLORS.primary, borderColor:COLORS.primary },
  presetTxt:  { fontSize:12, fontWeight:FONTS.medium, color:COLORS.textSub },
  presetTxtActive: { color:'#fff', fontWeight:FONTS.bold },
  customRow:  { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:12, paddingBottom:10 },
  dateInput:  { flex:1, fontSize:12, color:COLORS.text, backgroundColor:COLORS.bg, borderWidth:1, borderColor:COLORS.border, borderRadius:RADIUS.sm, paddingHorizontal:10, paddingVertical:8 },
  applyBtn:   { backgroundColor:COLORS.primary, paddingHorizontal:14, paddingVertical:8, borderRadius:RADIUS.md },
  applyTxt:   { color:'#fff', fontWeight:FONTS.bold, fontSize:12 },

  // Tab bar
  tabBar:     { backgroundColor:COLORS.card, borderBottomWidth:1, borderBottomColor:COLORS.border },
  tabRow:     { paddingHorizontal:12, paddingVertical:0, gap:0 },
  tab:        { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:14, paddingVertical:11, borderBottomWidth:2, borderBottomColor:'transparent' },
  tabActive:  { borderBottomColor:COLORS.primary },
  tabTxt:     { fontSize:12, fontWeight:FONTS.medium, color:COLORS.textMute },
  tabTxtActive: { color:COLORS.primary, fontWeight:FONTS.bold },

  // P&L Hero
  plHero:     { backgroundColor:'#0F172A', borderRadius:RADIUS.xl, padding:20, marginBottom:12 },
  plHeroLabel:{ fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:4 },
  plHeroAmt:  { fontSize:28, fontWeight:FONTS.black, marginBottom:4 },
  plHeroPeriod:{ fontSize:10, color:'rgba(255,255,255,0.35)', marginBottom:18 },
  plRow:      { flexDirection:'row', backgroundColor:'rgba(255,255,255,0.06)', borderRadius:RADIUS.md, padding:12 },
  plDiv:      { width:1, backgroundColor:'rgba(255,255,255,0.08)', marginHorizontal:4 },
  plStat:     { flex:1, alignItems:'center' },
  plStatAmt:  { fontSize:13, fontWeight:FONTS.bold, marginBottom:2 },
  plStatLbl:  { fontSize:9, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:0.4 },

  // KPI grid
  kpiGrid:    { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:12 },
  kpiTile:    { flex:1, minWidth:'45%', backgroundColor:COLORS.card, borderRadius:RADIUS.lg, padding:12, borderWidth:1, borderColor:COLORS.border, borderTopWidth:3 },
  kpiIcon:    { width:30, height:30, borderRadius:8, alignItems:'center', justifyContent:'center', marginBottom:8 },
  kpiAmt:     { fontSize:16, fontWeight:FONTS.black, marginBottom:2 },
  kpiLbl:     { fontSize:10, color:COLORS.textMute },

  // Section head
  sectionHead:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:14, marginBottom:6 },
  sectionHeadTxt:{ fontSize:13, fontWeight:FONTS.bold, color:COLORS.textSub, textTransform:'uppercase', letterSpacing:0.5 },
  sectionCount: { fontSize:11, color:COLORS.textMute, backgroundColor:COLORS.bgDeep, paddingHorizontal:8, paddingVertical:2, borderRadius:RADIUS.full },

  // Card + data rows
  card:       { backgroundColor:COLORS.card, borderRadius:RADIUS.lg, borderWidth:1, borderColor:COLORS.border, overflow:'hidden', marginBottom:10 },
  dataRow:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:14, paddingVertical:11 },
  dataRowBorder: { borderBottomWidth:1, borderBottomColor:COLORS.border },
  dataLabel:  { fontSize:13, color:COLORS.textSub, flex:1 },
  dataLabelMuted: { color:COLORS.textMute, fontSize:12 },
  dataValue:  { fontSize:13, fontWeight:FONTS.semibold, color:COLORS.text },

  // GST boxes
  gstBoxRow:  { flexDirection:'row', gap:8, marginBottom:10 },
  gstBox:     { flex:1, backgroundColor:COLORS.card, borderRadius:RADIUS.lg, padding:12, borderTopWidth:3, borderWidth:1, borderColor:COLORS.border, alignItems:'center' },
  gstAmt:     { fontSize:14, fontWeight:FONTS.black, marginBottom:3 },
  gstLbl:     { fontSize:10, color:COLORS.textMute, textAlign:'center' },

  // Tab content header
  tabHeaderRow:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:10 },
  tabHeaderTitle:{ fontSize:16, fontWeight:FONTS.black, color:COLORS.text },
  csvBtn:     { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:12, paddingVertical:7, borderRadius:RADIUS.md, backgroundColor:'#F0FDF4', borderWidth:1, borderColor:'#86EFAC' },
  csvBtnTxt:  { fontSize:12, fontWeight:FONTS.bold, color:'#16A34A' },

  // Summary strip
  summaryStrip:{ flexDirection:'row', backgroundColor:COLORS.card, borderRadius:RADIUS.lg, borderWidth:1, borderColor:COLORS.border, overflow:'hidden', marginBottom:12 },
  summaryCell: { flex:1, alignItems:'center', paddingVertical:12, borderRightWidth:1, borderRightColor:COLORS.border },
  summaryCellVal: { fontSize:15, fontWeight:FONTS.black, marginBottom:2 },
  summaryCellLbl: { fontSize:9, color:COLORS.textMute, textTransform:'uppercase', letterSpacing:0.4 },

  // Table
  tableCard:  { backgroundColor:COLORS.card, borderRadius:RADIUS.lg, borderWidth:1, borderColor:COLORS.border, overflow:'hidden', marginBottom:10 },
  thead:      { flexDirection:'row', backgroundColor:'#F1F5F9', paddingVertical:9, paddingHorizontal:8, borderBottomWidth:2, borderBottomColor:COLORS.border },
  th:         { flex:1, fontSize:10, fontWeight:FONTS.bold, color:COLORS.textMute, textTransform:'uppercase', letterSpacing:0.4, paddingHorizontal:4 },
  trow:       { flexDirection:'row', alignItems:'center', paddingVertical:9, paddingHorizontal:8, borderBottomWidth:1, borderBottomColor:COLORS.border },
  trowEven:   { backgroundColor:'#FAFBFF' },
  td:         { flex:1, fontSize:12, color:COLORS.text, paddingHorizontal:4 },

  // Status pill
  statusPill:    { paddingHorizontal:7, paddingVertical:2, borderRadius:RADIUS.full },
  statusPillTxt: { fontSize:9, fontWeight:FONTS.black, letterSpacing:0.2 },

  // Top customers
  topRow:     { flexDirection:'row', alignItems:'center', gap:10, paddingHorizontal:14, paddingVertical:11 },
  rowBorder:  { borderBottomWidth:1, borderBottomColor:COLORS.border },
  rankBadge:  { width:24, height:24, borderRadius:12, backgroundColor:COLORS.bgDeep, alignItems:'center', justifyContent:'center' },
  rankTxt:    { fontSize:10, fontWeight:FONTS.bold, color:COLORS.textSub },
  topName:    { flex:1, fontSize:13, fontWeight:FONTS.medium, color:COLORS.text },
  topAmt:     { fontSize:13, fontWeight:FONTS.black, color:COLORS.text },

  // P&L summary card
  plSummaryCard:   { backgroundColor:'#0F172A', borderRadius:RADIUS.xl, padding:18, marginBottom:10 },
  plSummaryTitle:  { fontSize:12, color:'rgba(255,255,255,0.4)', fontWeight:FONTS.bold, textTransform:'uppercase', letterSpacing:0.6, marginBottom:14 },
  plSummaryRow:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:8, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.06)' },
  plSummaryLabel:  { fontSize:13, color:'rgba(255,255,255,0.6)' },
  plSummaryValue:  { fontSize:14, fontWeight:FONTS.bold },
  plSummaryTotal:  { borderBottomWidth:0, paddingTop:14, marginTop:6, borderTopWidth:1, borderTopColor:'rgba(255,255,255,0.12)' },
  plSummaryTotalLabel: { fontSize:15, fontWeight:FONTS.bold, color:'#fff' },
  plSummaryTotalValue: { fontSize:18, fontWeight:FONTS.black },

  // Info box
  infoBox:    { flexDirection:'row', alignItems:'flex-start', gap:8, backgroundColor:COLORS.infoLight, borderRadius:RADIUS.md, padding:12, marginTop:8, marginBottom:10 },
  infoTxt:    { flex:1, fontSize:12, color:COLORS.info, lineHeight:18 },

  // Empty state
  emptyState: { alignItems:'center', paddingVertical:40, gap:10 },
  emptyStateTxt: { fontSize:13, color:COLORS.textMute },
});