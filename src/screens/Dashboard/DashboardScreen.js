import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Platform, Dimensions, ActivityIndicator,
  TextInput, Modal, Keyboard, Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from '../../utils/Icon';
import * as DB from '../../db';
import { formatINRCompact, formatINR } from '../../utils/gst';
import { getLicenseStatus } from '../../utils/licenseSystem';
import { COLORS, RADIUS, FONTS } from '../../theme';

const RENEW_URL = 'https://locas-business.vercel.app/renew.html';
const BRAND = '#FF6B00';

// ── Sparkline (hero card top-right) ───────────────────────────────
function Sparkline({ points = [], width = 80, height = 32, color = '#4ADE80' }) {
  if (points.length < 2 || Platform.OS !== 'web') return null;
  const max = Math.max(...points, 1), min = Math.min(...points, 0);
  const range = max - min || 1;
  const step  = width / (points.length - 1);
  const coords = points.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`);
  const d = `M${coords.join(' L')}`;
  const fill = `M${coords[0]} L${coords.join(' L')} L${width},${height} L0,${height} Z`;
  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <path d="${fill}" fill="${color}22"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
  return React.createElement('div', { style: { width, height }, dangerouslySetInnerHTML: { __html: svg } });
}

// ── Smooth area line chart — pure SVG, no CDN, Electron safe ─────
function SmoothAreaChart({ data = [] }) {
  if (!data.length) return null;

  const max = Math.max(...data.map(d => d.value), 1);

  // Native fallback: simple bars
  if (Platform.OS !== 'web') {
    return (
      <View style={{ flexDirection:'row', alignItems:'flex-end', height:110, gap:3, paddingTop:4 }}>
        {data.map((d, i) => {
          const isLast = i === data.length - 1;
          const h = Math.max(3, Math.round((d.value / max) * 80));
          return (
            <View key={i} style={{ flex:1, alignItems:'center' }}>
              <View style={{ width:'60%', height:h, backgroundColor: isLast ? BRAND : BRAND+'44', borderRadius:3 }} />
              <Text style={{ fontSize:7, color:COLORS.textMute, marginTop:3 }}>{d.label}</Text>
            </View>
          );
        })}
      </View>
    );
  }

  // Web: pure inline SVG — no CDN, no iframe, Electron safe
  const W = 400, H = 130;
  const PAD = { l: 4, r: 4, t: 20, b: 26 };
  const cW  = W - PAD.l - PAD.r;
  const cH  = H - PAD.t - PAD.b;
  const n   = data.length;

  const pts = data.map((d, i) => ({
    x: PAD.l + (i / (n - 1)) * cW,
    y: PAD.t + (1 - d.value / max) * cH,
    label: d.label,
    value: d.value,
  }));

  // Smooth cubic bezier
  const cubicPath = (points) => {
    if (points.length < 2) return '';
    let path = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i], p1 = points[i + 1];
      const cpx = ((p0.x + p1.x) / 2).toFixed(1);
      path += ` C${cpx},${p0.y.toFixed(1)} ${cpx},${p1.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
    }
    return path;
  };

  const linePath = cubicPath(pts);
  const last     = pts[pts.length - 1];
  const fillPath = `${linePath} L${last.x.toFixed(1)},${(PAD.t + cH).toFixed(1)} L${PAD.l},${(PAD.t + cH).toFixed(1)} Z`;
  const fmt = (v) => v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v > 0 ? String(Math.round(v)) : '';

  const svgHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FF6B00" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#FF6B00" stop-opacity="0.01"/>
      </linearGradient>
    </defs>
    <path d="${fillPath}" fill="url(#ag)"/>
    <path d="${linePath}" fill="none" stroke="#FF6B00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${pts.map((p, i) => {
      const isLast = i === pts.length - 1;
      const valTxt = fmt(p.value);
      return `
        ${isLast ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="8" fill="#FF6B00" fill-opacity="0.12"/>` : ''}
        ${isLast
          ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#FF6B00" stroke="#fff" stroke-width="2"/>`
          : `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="#fff" stroke="#FF6B00" stroke-width="1.5"/>`
        }
        ${isLast && valTxt ? `<text x="${p.x.toFixed(1)}" y="${(p.y - 10).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="#FF6B00">${valTxt}</text>` : ''}
        <text x="${p.x.toFixed(1)}" y="${H - 4}" text-anchor="middle" font-size="9" fill="#94A3B8">${p.label}</text>
      `;
    }).join('')}
  </svg>`;

  return React.createElement('div', {
    style: { width: '100%', height: H },
    dangerouslySetInnerHTML: { __html: svgHtml },
  });
}

// ── Donut ─────────────────────────────────────────────────────────
function DonutChart({ collected, outstanding, expenses, size = 80 }) {
  const total = collected + outstanding + expenses || 1;
  const segs = [
    { value: collected,   color: '#22C55E' },
    { value: outstanding, color: '#F59E0B' },
    { value: expenses,    color: '#EF4444' },
  ];
  if (Platform.OS !== 'web') {
    return (
      <View style={{ width:size, height:size, alignItems:'center', justifyContent:'center' }}>
        {segs.map((seg, i) => {
          const rs = size - i * 14;
          return <View key={i} style={{ position:'absolute', width:rs, height:rs, borderRadius:rs/2, borderWidth:5, borderColor:seg.color+(seg.value===0?'22':'CC') }} />;
        })}
      </View>
    );
  }
  const cx = size/2, cy = size/2, r = size/2 - 8, stroke = 12;
  const circ = 2 * Math.PI * r;
  let off = 0;
  const arcs = segs.map(seg => {
    const dash = (seg.value / total) * circ;
    const arc = { dash, off, color: seg.color };
    off += dash;
    return arc;
  });
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#F1F5F9" stroke-width="${stroke}"/>
    ${arcs.map(a => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${a.color}" stroke-width="${stroke}"
      stroke-dasharray="${a.dash} ${circ - a.dash}" stroke-dashoffset="${-a.off + circ*0.25}" transform="rotate(-90 ${cx} ${cy})"/>`).join('')}
  </svg>`;
  return React.createElement('div', { style:{ width:size, height:size, flexShrink:0 }, dangerouslySetInnerHTML:{ __html:svg } });
}

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [greeting,       setGreeting]       = useState('');
  const [updateInfo,     setUpdateInfo]     = useState(null);   // { version, notes }
  const [updateProgress, setUpdateProgress] = useState(null);   // 0-100 or null
  const [stats,          setStats]          = useState(null);
  const [profile,        setProfile]        = useState(null);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [topParties,     setTopParties]     = useState([]);
  const [openPOs,        setOpenPOs]        = useState([]);
  const [monthlyTrend,   setMonthlyTrend]   = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [licenseStatus,  setLicenseStatus]  = useState(null);
  const [licenseDismissed, setLicenseDismissed] = useState(false);
  const [showSearch,     setShowSearch]     = useState(false);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [searchResults,  setSearchResults]  = useState(null);
  const [searching,      setSearching]      = useState(false);
  const searchRef   = useRef(null);
  const searchTimer = useRef(null);
  const loadingRef  = useRef(false);
  const fadeAnim    = useRef(new Animated.Value(0)).current;

  const load = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    // Update greeting based on current device time — runs every focus
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning ☀️' : h < 17 ? 'Good afternoon 👋' : 'Good evening 🌙');
    try {
      const [data, prof, license] = await Promise.all([
        DB.getDashboardStats(),
        DB.getProfile(),
        getLicenseStatus().catch(() => null),
      ]);
      setStats(data); setProfile(prof); setLicenseStatus(license);
      const [inv, parties, pos] = await Promise.all([
        DB.getRecentInvoices(5).catch(() => []),
        DB.getTopParties(4).catch(() => []),
        DB.getPurchaseOrders({ status: 'active' }).catch(() => []),
      ]);
      setRecentInvoices(inv || []);
      setTopParties(parties || []);
      setOpenPOs((pos || []).slice(0, 4));
      // Monthly trend
      const allInv = await DB.getInvoices({ type: 'sale' }).catch(() => []);
      const now = new Date();
      const trend = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear(), m = d.getMonth();
        const from = `${y}-${String(m+1).padStart(2,'0')}-01`;
        const to   = new Date(y, m+1, 0).toISOString().split('T')[0];
        const total = (allInv||[]).filter(inv => inv.date >= from && inv.date <= to).reduce((s,inv) => s+(inv.total||0), 0);
        trend.push({ label: d.toLocaleDateString('en-IN', { month: 'short' }), value: total });
      }
      setMonthlyTrend(trend);
      Animated.timing(fadeAnim, { toValue:1, duration:300, useNativeDriver:true }).start();
    } catch(e) { console.error(e); }
    finally { setLoading(false); loadingRef.current = false; }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  // ── Listen for update events from Electron main process ────────
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.onUpdateDownloading(({ version }) => {
      setUpdateProgress(0);
    });
    window.electronAPI.onUpdateProgress((pct) => {
      setUpdateProgress(pct);
    });
    window.electronAPI.onUpdateReady((data) => {
      setUpdateInfo(data);
      setUpdateProgress(null);
    });
  }, []);

  const handleSearch = (q) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults(null); setSearching(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try { setSearchResults(await DB.globalSearch(q.trim())); }
      catch { setSearchResults({ invoices:[], quotations:[], parties:[], products:[] }); }
      finally { setSearching(false); }
    }, 280);
  };
  const openSearch  = () => { setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 80); };
  const closeSearch = () => { setShowSearch(false); setSearchQuery(''); setSearchResults(null); Keyboard.dismiss(); };
  const goResult = (type, item) => {
    closeSearch();
    if (type === 'invoice')   navigation.navigate('InvoicesTab',   { screen:'InvoiceDetail',   params:{ invoiceId:item.id } });
    if (type === 'quotation') navigation.navigate('QuotationsTab', { screen:'QuotationDetail', params:{ id:item.id } });
    if (type === 'party')     navigation.navigate('PartiesTab',    { screen:'PartyDetail',      params:{ partyId:item.id } });
    if (type === 'product')   navigation.navigate('Inventory');
  };

  const monthlySales  = stats?.sales?.total      || 0;
  const monthlyCount  = stats?.sales?.count       || 0;
  const collected     = stats?.collected?.total   || 0;
  const receivables   = stats?.receivables?.total || 0;
  const payables      = stats?.payables?.total    || 0;
  const monthExpenses = stats?.expenses?.total    || 0;
  const netProfit     = monthlySales - monthExpenses;

  const QUICK = [
    { label:'New Invoice',   icon:'file-plus',    color:BRAND,     bg:'#FFF0E6', go:() => navigation.navigate('InvoicesTab',   { screen:'CreateInvoice' }) },
    { label:'New Quotation', icon:'clipboard',    color:'#8B5CF6', bg:'#F5F3FF', go:() => navigation.navigate('QuotationsTab', { screen:'CreateQuotation' }) },
    { label:'New PO',        icon:'shopping-bag', color:'#10B981', bg:'#ECFDF5', go:() => navigation.navigate('More',          { screen:'PurchaseOrders' }) },
    { label:'Add Party',     icon:'user-plus',    color:'#3B82F6', bg:'#EFF6FF', go:() => navigation.navigate('PartiesTab') },
    { label:'Add Expense',   icon:'minus-circle', color:'#EF4444', bg:'#FEF2F2', go:() => navigation.navigate('More',          { screen:'Expenses' }) },
    { label:'Inventory',     icon:'box',          color:'#6366F1', bg:'#EEF2FF', go:() => navigation.navigate('Inventory') },
    { label:'Reports',       icon:'bar-chart-2',  color:'#0EA5E9', bg:'#F0F9FF', go:() => navigation.navigate('More',          { screen:'Reports' }) },
    { label:'Settings',      icon:'settings',     color:'#64748B', bg:'#F1F5F9', go:() => navigation.navigate('More',          { screen:'Settings' }) },
  ];

  const formatDate = (ds) => {
    if (!ds) return '';
    const d = new Date(ds), t = new Date();
    const y = new Date(t); y.setDate(y.getDate() - 1);
    if (d.toDateString() === t.toDateString()) return 'Today';
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
  };

  if (loading) {
    return (
      <View style={[s.container, { alignItems:'center', justifyContent:'center' }]}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <Animated.View style={[s.fill, { opacity: fadeAnim }]}>

        {/* ══ TOP BAR ═══════════════════════════════════════════ */}
        <View style={s.topBar}>
          <View style={{ flex:1 }}>
            <Text style={s.greetTxt}>{greeting}</Text>
            <Text style={s.bizName} numberOfLines={1}>{profile?.name || 'My Business'}</Text>
          </View>
          <TouchableOpacity style={s.topBtn} onPress={openSearch}>
            <Icon name="search" size={17} color={COLORS.textSub} />
          </TouchableOpacity>
          <TouchableOpacity style={s.topBtn} onPress={() => navigation.navigate('More', { screen:'Settings' })}>
            <Icon name="settings" size={17} color={COLORS.textSub} />
          </TouchableOpacity>
        </View>

        {/* License banner */}
        {licenseStatus?.warning && !licenseDismissed && (
          <View style={s.licenseBanner}>
            <Icon name="alert-triangle" size={13} color="#92400E" />
            <Text style={s.licenseTxt}>License expires in {licenseStatus.daysLeft} days</Text>
            <TouchableOpacity style={s.licenseBtn} onPress={() => Linking.openURL(RENEW_URL)}>
              <Text style={s.licenseBtnTxt}>Renew</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setLicenseDismissed(true)} style={{padding:4}}>
              <Icon name="x" size={13} color="#92400E" />
            </TouchableOpacity>
          </View>
        )}

        {/* Update downloading progress banner */}
        {updateProgress !== null && (
          <View style={s.updateProgressBanner}>
            <Icon name="download" size={13} color="#1E40AF" />
            <Text style={s.updateProgressTxt}>Downloading update... {updateProgress}%</Text>
            <View style={s.updateProgressBar}>
              <View style={[s.updateProgressFill, { width: `${updateProgress}%` }]} />
            </View>
          </View>
        )}

        {/* Update ready banner */}
        {updateInfo && updateProgress === null && (
          <TouchableOpacity
            style={s.updateReadyBanner}
            onPress={() => window.electronAPI?.installUpdate()}
            activeOpacity={0.85}
          >
            <View style={s.updateReadyLeft}>
              <Icon name="download" size={14} color="#fff" />
              <View>
                <Text style={s.updateReadyTitle}>Locas {updateInfo.version} is ready</Text>
                {updateInfo.notes && (
                  <Text style={s.updateReadyNotes} numberOfLines={1}>{updateInfo.notes}</Text>
                )}
              </View>
            </View>
            <View style={s.updateReadyBtn}>
              <Text style={s.updateReadyBtnTxt}>Install & Restart →</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ══ MAIN GRID ══════════════════════════════════════════ */}
        <View style={s.grid}>

          {/* ── LEFT COLUMN ── */}
          <View style={s.leftCol}>

            {/* Hero dark card */}
            <View style={s.heroCard}>
              <View style={s.heroTop}>
                <View style={{ flex:1 }}>
                  <Text style={s.heroLabel}>This Month · Sales</Text>
                  <Text style={s.heroAmt} numberOfLines={1} adjustsFontSizeToFit>{formatINR(monthlySales)}</Text>
                  <Text style={s.heroSub}>{monthlyCount} invoice{monthlyCount!==1?'s':''}</Text>
                </View>
                <Sparkline points={monthlyTrend.map(d=>d.value)} width={70} height={30} color={netProfit>=0?'#4ADE80':'#F87171'} />
              </View>
              <View style={s.heroStats}>
                {[
                  { label:'Collected',  val: formatINRCompact(collected),    color:'#4ADE80' },
                  { label:'Receivable', val: formatINRCompact(receivables),  color:'#FCD34D' },
                  { label:'Expenses',   val: formatINRCompact(monthExpenses),color:'#F87171' },
                  { label:'Net',        val: formatINRCompact(netProfit),    color: netProfit>=0?'#4ADE80':'#F87171' },
                ].map((st, i, arr) => (
                  <React.Fragment key={i}>
                    <View style={s.heroStat}>
                      <Text style={[s.heroStatVal, { color:st.color }]}>{st.val}</Text>
                      <Text style={s.heroStatLbl}>{st.label}</Text>
                    </View>
                    {i < arr.length-1 && <View style={s.heroDiv} />}
                  </React.Fragment>
                ))}
              </View>
            </View>

            {/* Sales Trend chart card — fixed height, no flex:1 gap */}
            <View style={s.chartCard}>
              <View style={s.chartCardHeader}>
                <Text style={s.chartCardTitle}>Sales Trend</Text>
                <Text style={s.chartCardSub}>6 months</Text>
              </View>
              <SmoothAreaChart data={monthlyTrend} />
            </View>

            {/* Quick actions */}
            <View style={s.qaCard}>
              <Text style={s.qaCardTitle}>Quick Actions</Text>
              <View style={s.qaGrid}>
                {QUICK.map((a, i) => (
                  <TouchableOpacity key={i} style={s.qaItem} onPress={a.go} activeOpacity={0.75}>
                    <View style={[s.qaIcon, { backgroundColor:a.bg }]}>
                      <Icon name={a.icon} size={16} color={a.color} />
                    </View>
                    <Text style={s.qaLabel} numberOfLines={2}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

          </View>

          {/* ── RIGHT COLUMN ── */}
          <View style={s.rightCol}>

            {/* 4 KPI tiles in 2×2 */}
            <View style={s.kpiGrid}>
              {[
                { label:'Outstanding', val:formatINRCompact(receivables), color:'#3B82F6', bg:'#EFF6FF', icon:'file-text',    sub: receivables>0?'To collect':'All clear ✓', go:()=>navigation.navigate('InvoicesTab',{screen:'InvoiceList'}) },
                { label:'Payables',    val:formatINRCompact(payables),    color:'#EF4444', bg:'#FEF2F2', icon:'trending-down', sub:'To suppliers',              go:()=>navigation.navigate('PartiesTab') },
                { label:'Open POs',    val:String(openPOs.length),        color:'#10B981', bg:'#ECFDF5', icon:'shopping-bag',  sub:'Active orders',             go:()=>navigation.navigate('More',{screen:'PurchaseOrders'}) },
                { label:'Expenses',    val:formatINRCompact(monthExpenses),color:'#F59E0B',bg:'#FFFBEB', icon:'credit-card',   sub:'This month',                go:()=>navigation.navigate('More',{screen:'Expenses'}) },
              ].map((k, i) => (
                <TouchableOpacity key={i} style={[s.kpiTile, { borderTopColor:k.color }]} onPress={k.go} activeOpacity={0.8}>
                  <View style={[s.kpiIcon, { backgroundColor:k.bg }]}>
                    <Icon name={k.icon} size={15} color={k.color} />
                  </View>
                  <Text style={[s.kpiAmt, { color:k.color }]}>{k.val}</Text>
                  <Text style={s.kpiLbl}>{k.label}</Text>
                  <Text style={s.kpiSub} numberOfLines={1}>{k.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Breakdown donut */}
            <View style={s.donutCard}>
              <Text style={s.donutTitle}>Breakdown</Text>
              <View style={s.donutBody}>
                <DonutChart collected={collected} outstanding={receivables} expenses={monthExpenses} size={72} />
                <View style={s.donutLegend}>
                  {[
                    { color:'#22C55E', label:'Collected',  val:formatINRCompact(collected) },
                    { color:'#F59E0B', label:'Receivable', val:formatINRCompact(receivables) },
                    { color:'#EF4444', label:'Expenses',   val:formatINRCompact(monthExpenses) },
                  ].map((it,i) => (
                    <View key={i} style={s.legendRow}>
                      <View style={[s.legendDot, { backgroundColor:it.color }]} />
                      <Text style={s.legendLabel}>{it.label}</Text>
                      <Text style={s.legendVal}>{it.val}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Recent invoices */}
            <View style={s.listCard}>
              <View style={s.listCardHeader}>
                <Text style={s.listCardTitle}>Recent Invoices</Text>
                <TouchableOpacity onPress={() => navigation.navigate('InvoicesTab', { screen:'InvoiceList' })}>
                  <Text style={s.listCardAction}>See all →</Text>
                </TouchableOpacity>
              </View>
              {recentInvoices.length === 0 ? (
                <View style={s.emptyRow}>
                  <Text style={s.emptyTxt}>No invoices yet</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('InvoicesTab', { screen:'CreateInvoice' })}>
                    <Text style={s.emptyAction}>Create one →</Text>
                  </TouchableOpacity>
                </View>
              ) : recentInvoices.map((inv, i) => {
                const isPaid = inv.status === 'paid';
                const isOD   = !isPaid && inv.due_date && inv.due_date < new Date().toISOString().split('T')[0];
                const sc = isPaid ? { bg:'#D1FAE5', txt:'#065F46', label:'Paid' }
                         : isOD  ? { bg:'#FECACA', txt:'#7F1D1D', label:'Overdue' }
                         : inv.status==='partial' ? { bg:'#FEF3C7', txt:'#92400E', label:'Partial' }
                         : { bg:'#FEE2E2', txt:'#991B1B', label:'Unpaid' };
                return (
                  <TouchableOpacity key={inv.id}
                    style={[s.invRow, i < recentInvoices.length-1 && s.invRowBorder]}
                    onPress={() => navigation.navigate('InvoicesTab', { screen:'InvoiceDetail', params:{ invoiceId:inv.id } })}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex:1 }}>
                      <Text style={s.invNum} numberOfLines={1}>{inv.invoice_number}</Text>
                      <Text style={s.invParty} numberOfLines={1}>{inv.party_name||'Walk-in'}</Text>
                    </View>
                    <View style={{ alignItems:'flex-end', gap:4 }}>
                      <Text style={s.invAmt}>{formatINRCompact(inv.total)}</Text>
                      <View style={[s.pill, { backgroundColor:sc.bg }]}>
                        <Text style={[s.pillTxt, { color:sc.txt }]}>{sc.label}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

          </View>
        </View>
      </Animated.View>

      {/* ── Search Modal ── */}
      <Modal visible={showSearch} animationType="fade" transparent onRequestClose={closeSearch}>
        <View style={s.searchOverlay}>
          <View style={[s.searchSheet, { paddingTop: insets.top + 8 }]}>
            <View style={s.searchHeader}>
              <View style={s.searchInputWrap}>
                <Icon name="search" size={15} color={COLORS.textMute} />
                <TextInput
                  ref={searchRef}
                  style={s.searchInput}
                  placeholder="Search invoices, parties, products..."
                  placeholderTextColor={COLORS.textMute}
                  value={searchQuery}
                  onChangeText={handleSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => handleSearch('')}>
                    <Icon name="x" size={14} color={COLORS.textMute} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity style={s.searchCancel} onPress={closeSearch}>
                <Text style={s.searchCancelTxt}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ flex:1 }}>
              {searching ? (
                <View style={s.searchLoading}>
                  <ActivityIndicator size="small" color={BRAND} />
                  <Text style={s.searchLoadingTxt}>Searching...</Text>
                </View>
              ) : searchResults ? (
                (() => {
                  const total = (searchResults.invoices?.length||0)+(searchResults.quotations?.length||0)+(searchResults.parties?.length||0)+(searchResults.products?.length||0);
                  return total === 0 ? (
                    <View style={s.searchEmpty}>
                      <Icon name="search" size={36} color={COLORS.border} />
                      <Text style={s.searchEmptyTxt}>No results for "{searchQuery}"</Text>
                    </View>
                  ) : (
                    <>
                      {[
                        { key:'invoices',   type:'invoice',   label:'Invoices',   icon:'file-text', color:'#3B82F6' },
                        { key:'quotations', type:'quotation', label:'Quotations', icon:'clipboard', color:'#8B5CF6' },
                        { key:'parties',    type:'party',     label:'Parties',    icon:'users',     color:'#10B981' },
                        { key:'products',   type:'product',   label:'Products',   icon:'package',   color:'#F59E0B' },
                      ].map(({ key, type, label, icon, color }) =>
                        searchResults[key]?.length > 0 ? (
                          <View key={key} style={s.searchSection}>
                            <Text style={s.searchSectionTitle}>{label} ({searchResults[key].length})</Text>
                            {searchResults[key].map(item => {
                              const title = item.invoice_number || item.quote_number || item.name;
                              const sub = type==='invoice'   ? `${item.party_name||'Walk-in'} · ${formatINR(item.total)}`
                                        : type==='quotation' ? `${item.party_name||'-'} · ${formatINR(item.total)}`
                                        : type==='party'     ? `${item.phone||''} · ${formatINR(Math.abs(item.balance||0))}`
                                        : `₹${item.sale_price} · Stock: ${item.stock||0}`;
                              return (
                                <TouchableOpacity key={`${type}-${item.id}`} style={s.searchResult} onPress={() => goResult(type, item)}>
                                  <View style={[s.searchResultIcon, { backgroundColor: color+'18' }]}>
                                    <Icon name={icon} size={15} color={color} />
                                  </View>
                                  <View style={{ flex:1 }}>
                                    <Text style={s.searchResultTitle} numberOfLines={1}>{title}</Text>
                                    <Text style={s.searchResultSub} numberOfLines={1}>{sub}</Text>
                                  </View>
                                  <Icon name="chevron-right" size={13} color={COLORS.border} />
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        ) : null
                      )}
                    </>
                  );
                })()
              ) : (
                <View style={s.searchHints}>
                  <Text style={s.searchHintsTitle}>Search across everything</Text>
                  {[
                    { icon:'file-text', color:'#3B82F6', text:'Invoice numbers — INV-0001' },
                    { icon:'clipboard', color:'#8B5CF6', text:'Quotation numbers — QUO-0001' },
                    { icon:'users',     color:'#10B981', text:'Party names or phone numbers' },
                    { icon:'package',   color:'#F59E0B', text:'Product names or HSN codes' },
                  ].map((h, i) => (
                    <View key={i} style={s.searchHintRow}>
                      <Icon name={h.icon} size={14} color={h.color} />
                      <Text style={s.searchHintTxt}>{h.text}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex:1, backgroundColor:COLORS.bg },
  fill:      { flex:1, display:'flex', flexDirection:'column' },

  // Top bar
  topBar:    { flexDirection:'row', alignItems:'center', backgroundColor:COLORS.card, paddingHorizontal:14, paddingVertical:10, borderBottomWidth:1, borderBottomColor:COLORS.border },
  greetTxt:  { fontSize:10, color:COLORS.textMute, marginBottom:1 },
  bizName:   { fontSize:16, fontWeight:FONTS.black, color:COLORS.text },
  topBtn:    { width:34, height:34, borderRadius:9, backgroundColor:COLORS.bg, alignItems:'center', justifyContent:'center', marginLeft:6, borderWidth:1, borderColor:COLORS.border },

  // License banner
  licenseBanner: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#FEF3C7', paddingHorizontal:14, paddingVertical:8, borderBottomWidth:1, borderBottomColor:'#FDE68A' },
  licenseTxt:    { flex:1, fontSize:12, fontWeight:FONTS.medium, color:'#92400E' },
  licenseBtn:    { backgroundColor:'#F59E0B', paddingHorizontal:10, paddingVertical:3, borderRadius:5 },
  licenseBtnTxt: { fontSize:11, fontWeight:FONTS.bold, color:'#fff' },

  // Main 2-column grid
  grid:     { flex:1, flexDirection:'row', padding:10, gap:10 },
  leftCol:  { flex:1.1, flexDirection:'column', gap:10 },
  rightCol: { flex:1, flexDirection:'column', gap:10 },

  // Hero card (dark)
  heroCard:    { backgroundColor:'#0F172A', borderRadius:RADIUS.xl, padding:14 },
  heroTop:     { flexDirection:'row', alignItems:'flex-start', marginBottom:12 },
  heroLabel:   { fontSize:10, color:'rgba(255,255,255,0.4)', marginBottom:3 },
  heroAmt:     { fontSize:22, fontWeight:FONTS.black, color:'#fff', marginBottom:2 },
  heroSub:     { fontSize:9, color:'rgba(255,255,255,0.35)' },
  heroStats:   { flexDirection:'row', backgroundColor:'rgba(255,255,255,0.05)', borderRadius:RADIUS.md, padding:10 },
  heroStat:    { flex:1, alignItems:'center' },
  heroStatVal: { fontSize:11, fontWeight:FONTS.bold, marginBottom:1 },
  heroStatLbl: { fontSize:7, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:0.3 },
  heroDiv:     { width:1, backgroundColor:'rgba(255,255,255,0.08)' },

  // Chart card — white bg, fixed height so no empty gap below chart
  chartCard:       { backgroundColor:COLORS.card, borderRadius:RADIUS.xl, padding:12, borderWidth:1, borderColor:COLORS.border },
  chartCardHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:6 },
  chartCardTitle:  { fontSize:12, fontWeight:FONTS.bold, color:COLORS.text },
  chartCardSub:    { fontSize:9, color:COLORS.textMute },

  // Quick actions card
  qaCard:      { backgroundColor:COLORS.card, borderRadius:RADIUS.xl, padding:12, borderWidth:1, borderColor:COLORS.border },
  qaCardTitle: { fontSize:11, fontWeight:FONTS.bold, color:COLORS.textSub, textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 },
  qaGrid:      { flexDirection:'row', flexWrap:'wrap', gap:6 },
  qaItem:      { width:'22%', alignItems:'center', gap:4 },
  qaIcon:      { width:36, height:36, borderRadius:10, alignItems:'center', justifyContent:'center' },
  qaLabel:     { fontSize:8, color:COLORS.textSub, textAlign:'center', fontWeight:FONTS.medium, lineHeight:11 },

  // KPI 2×2 grid
  kpiGrid: { flexDirection:'row', flexWrap:'wrap', gap:8 },
  kpiTile: { width:'47.5%', backgroundColor:COLORS.card, borderRadius:RADIUS.lg, padding:10, borderWidth:1, borderColor:COLORS.border, borderTopWidth:2.5, gap:3 },
  kpiIcon: { width:28, height:28, borderRadius:8, alignItems:'center', justifyContent:'center', marginBottom:2 },
  kpiAmt:  { fontSize:16, fontWeight:FONTS.black },
  kpiLbl:  { fontSize:11, fontWeight:FONTS.semibold, color:COLORS.text },
  kpiSub:  { fontSize:9, color:COLORS.textMute },

  // Breakdown donut card
  donutCard:   { backgroundColor:COLORS.card, borderRadius:RADIUS.xl, padding:12, borderWidth:1, borderColor:COLORS.border },
  donutTitle:  { fontSize:11, fontWeight:FONTS.bold, color:COLORS.textSub, textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 },
  donutBody:   { flexDirection:'row', alignItems:'center', gap:10 },
  donutLegend: { flex:1, gap:5 },
  legendRow:   { flexDirection:'row', alignItems:'center', gap:5 },
  legendDot:   { width:7, height:7, borderRadius:4, flexShrink:0 },
  legendLabel: { flex:1, fontSize:10, color:COLORS.textSub },
  legendVal:   { fontSize:10, fontWeight:FONTS.bold, color:COLORS.text },

  // Recent invoices list card
  listCard:       { flex:1, backgroundColor:COLORS.card, borderRadius:RADIUS.xl, padding:12, borderWidth:1, borderColor:COLORS.border, overflow:'hidden' },
  listCardHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8 },
  listCardTitle:  { fontSize:11, fontWeight:FONTS.bold, color:COLORS.textSub, textTransform:'uppercase', letterSpacing:0.5 },
  listCardAction: { fontSize:11, color:BRAND, fontWeight:FONTS.semibold },
  invRow:         { flexDirection:'row', alignItems:'center', paddingVertical:6 },
  invRowBorder:   { borderBottomWidth:1, borderBottomColor:COLORS.border },
  invNum:         { fontSize:12, fontWeight:FONTS.bold, color:BRAND },
  invParty:       { fontSize:10, color:COLORS.textMute, marginTop:1 },
  invAmt:         { fontSize:12, fontWeight:FONTS.bold, color:COLORS.text },
  pill:           { paddingHorizontal:6, paddingVertical:2, borderRadius:RADIUS.full },
  pillTxt:        { fontSize:8, fontWeight:FONTS.black, letterSpacing:0.2 },
  emptyRow:       { flex:1, alignItems:'center', justifyContent:'center', gap:6, paddingVertical:16 },
  emptyTxt:       { fontSize:12, color:COLORS.textMute },
  emptyAction:    { fontSize:12, color:BRAND, fontWeight:FONTS.semibold },

  // Update banners
  updateProgressBanner: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#EFF6FF', paddingHorizontal:14, paddingVertical:8, borderBottomWidth:1, borderBottomColor:'#BFDBFE' },
  updateProgressTxt:    { fontSize:12, color:'#1E40AF', fontWeight:FONTS.medium, flex:1 },
  updateProgressBar:    { width:80, height:4, backgroundColor:'#BFDBFE', borderRadius:2, overflow:'hidden' },
  updateProgressFill:   { height:'100%', backgroundColor:'#3B82F6', borderRadius:2 },
  updateReadyBanner:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:'#16A34A', paddingHorizontal:14, paddingVertical:9, borderBottomWidth:1, borderBottomColor:'#15803D' },
  updateReadyLeft:      { flexDirection:'row', alignItems:'center', gap:8, flex:1 },
  updateReadyTitle:     { fontSize:12, fontWeight:FONTS.bold, color:'#fff' },
  updateReadyNotes:     { fontSize:10, color:'rgba(255,255,255,0.75)', marginTop:1 },
  updateReadyBtn:       { backgroundColor:'rgba(0,0,0,0.2)', paddingHorizontal:10, paddingVertical:4, borderRadius:6 },
  updateReadyBtnTxt:    { fontSize:11, fontWeight:FONTS.bold, color:'#fff' },

  // Search modal
  searchOverlay:     { flex:1, backgroundColor:'rgba(0,0,0,0.5)' },
  searchSheet:       { flex:1, backgroundColor:COLORS.bg },
  searchHeader:      { flexDirection:'row', alignItems:'center', gap:10, paddingHorizontal:14, paddingBottom:10, backgroundColor:COLORS.card, borderBottomWidth:1, borderBottomColor:COLORS.border },
  searchInputWrap:   { flex:1, flexDirection:'row', alignItems:'center', gap:8, backgroundColor:COLORS.bg, borderRadius:RADIUS.md, paddingHorizontal:12, paddingVertical:9, borderWidth:1, borderColor:COLORS.border },
  searchInput:       { flex:1, fontSize:14, color:COLORS.text, paddingVertical:0 },
  searchCancel:      { paddingLeft:4, paddingVertical:8 },
  searchCancelTxt:   { fontSize:14, fontWeight:FONTS.semibold, color:BRAND },
  searchLoading:     { flexDirection:'row', alignItems:'center', justifyContent:'center', paddingVertical:40, gap:10 },
  searchLoadingTxt:  { fontSize:14, color:COLORS.textSub },
  searchEmpty:       { alignItems:'center', paddingVertical:48, gap:10 },
  searchEmptyTxt:    { fontSize:14, color:COLORS.textMute },
  searchSection:     { padding:14 },
  searchSectionTitle:{ fontSize:10, fontWeight:FONTS.bold, color:COLORS.textMute, textTransform:'uppercase', letterSpacing:0.7, marginBottom:8 },
  searchResult:      { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:COLORS.card, borderRadius:RADIUS.md, padding:11, marginBottom:6, borderWidth:1, borderColor:COLORS.border },
  searchResultIcon:  { width:34, height:34, borderRadius:9, alignItems:'center', justifyContent:'center', flexShrink:0 },
  searchResultTitle: { fontSize:13, fontWeight:FONTS.semibold, color:COLORS.text },
  searchResultSub:   { fontSize:11, color:COLORS.textMute, marginTop:1 },
  searchHints:       { padding:20 },
  searchHintsTitle:  { fontSize:15, fontWeight:FONTS.bold, color:COLORS.text, marginBottom:16 },
  searchHintRow:     { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:8 },
  searchHintTxt:     { fontSize:13, color:COLORS.textSub },
});