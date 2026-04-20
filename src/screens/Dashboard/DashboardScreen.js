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
import { COLORS, RADIUS, FONTS, SHADOW } from '../../theme';

const RENEW_URL = 'https://locas-business.vercel.app/renew.html';
const BRAND     = '#FF6B00';
const DARK      = '#0B1120';
const CARD_BG   = '#131C2E';
const ACCENT_DIM= 'rgba(255,107,0,0.12)';

// ── Mini sparkline SVG ─────────────────────────────────────────────
function Sparkline({ points = [], width = 88, height = 36, color = '#4ADE80' }) {
  if (points.length < 2 || Platform.OS !== 'web') return null;
  const max = Math.max(...points, 1), min = 0;
  const range = max - min || 1;
  const step  = width / (points.length - 1);
  const coords = points.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`);
  const d    = `M${coords.join(' L')}`;
  const fill = `M${coords[0]} L${coords.join(' L')} L${width},${height} L0,${height} Z`;
  const svg  = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.3"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${fill}" fill="url(#sg)"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return React.createElement('div', { style: { width, height }, dangerouslySetInnerHTML: { __html: svg } });
}

// ── Revenue area chart ─────────────────────────────────────────────
function AreaChart({ data = [] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  if (Platform.OS !== 'web') {
    return (
      <View style={{ flexDirection:'row', alignItems:'flex-end', height:68, gap:4, paddingTop:4 }}>
        {data.map((d, i) => {
          const isLast = i === data.length - 1;
          const h = Math.max(3, Math.round((d.value / max) * 52));
          return (
            <View key={i} style={{ flex:1, alignItems:'center', gap:4 }}>
              <View style={{ width:'70%', height:h, backgroundColor: isLast ? BRAND : BRAND+'55', borderRadius:3 }} />
              <Text style={{ fontSize:7, color:'rgba(255,255,255,0.35)' }}>{d.label}</Text>
            </View>
          );
        })}
      </View>
    );
  }
  const W=420, H=90, PL=38, PR=8, PT=8, PB=22;
  const cW = W-PL-PR, cH = H-PT-PB, n = data.length;
  const fmt = v => v>=100000?(v/100000).toFixed(1)+'L':v>=1000?(v/1000).toFixed(0)+'K':v>0?String(Math.round(v)):'0';
  const pts = data.map((d,i) => ({
    x: PL + (i/(n-1))*cW,
    y: PT + (1 - d.value/max)*cH,
    label: d.label, value: d.value,
  }));
  let path = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length-1; i++) {
    const p0=pts[i], p1=pts[i+1], cpx=((p0.x+p1.x)/2).toFixed(1);
    path += ` C${cpx},${p0.y.toFixed(1)} ${cpx},${p1.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
  }
  const last = pts[pts.length-1];
  const fillPath = `${path} L${last.x},${PT+cH} L${PL},${PT+cH} Z`;
  // Y-axis grid lines at 0%, 50%, 100%
  const gridLines = [0, 0.5, 1].map(pct => {
    const y = (PT + (1-pct)*cH).toFixed(1);
    const lbl = fmt(max * pct);
    return `<line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,4"/>
            <text x="${PL-4}" y="${parseFloat(y)+3}" text-anchor="end" font-size="8" fill="rgba(255,255,255,0.25)" font-family="system-ui">${lbl}</text>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BRAND}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${BRAND}" stop-opacity="0.02"/>
    </linearGradient></defs>
    ${gridLines}
    <path d="${fillPath}" fill="url(#rg)"/>
    <path d="${path}" fill="none" stroke="${BRAND}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${pts.map((p,i)=>{
      const isL=i===pts.length-1;
      return isL
        ? `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${BRAND}"/><circle cx="${p.x}" cy="${p.y}" r="7" fill="${BRAND}" opacity="0.15"/>`
        : p.value>0?`<circle cx="${p.x}" cy="${p.y}" r="2" fill="${BRAND}" opacity="0.6"/>`:'';
    }).join('')}
    ${pts.map(p=>`<text x="${p.x}" y="${H-2}" text-anchor="middle" font-size="8.5" fill="rgba(255,255,255,0.28)" font-family="system-ui">${p.label}</text>`).join('')}
  </svg>`;
  return React.createElement('div', { style:{width:'100%',height:H}, dangerouslySetInnerHTML:{__html:svg} });
}

// ── Donut chart ────────────────────────────────────────────────────
function DonutChart({ collected=0, outstanding=0, expenses=0, size=68 }) {
  const total = collected + outstanding + expenses || 1;
  const segs   = [
    { val: collected,   color: '#22C55E' },
    { val: outstanding, color: '#F59E0B' },
    { val: expenses,    color: '#EF4444' },
  ];
  if (Platform.OS !== 'web') {
    return <View style={{ width:size, height:size, borderRadius:size/2, backgroundColor:'rgba(255,255,255,0.06)' }} />;
  }
  const cx=size/2, cy=size/2, r=(size/2)-6, stroke=9;
  const circ = 2*Math.PI*r;
  let offset = 0;
  const paths = segs.map(seg => {
    const dash = (seg.val/total)*circ;
    const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${stroke}" stroke-dasharray="${dash} ${circ-dash}" stroke-dashoffset="${-offset}" stroke-linecap="butt" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += dash;
    return el;
  });
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="${stroke}"/>${paths.join('')}</svg>`;
  return React.createElement('div', { style:{width:size,height:size}, dangerouslySetInnerHTML:{__html:svg} });
}

// ── Month names ────────────────────────────────────────────────────
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── PO Widget ─────────────────────────────────────────────────────
function POWidget({ poStats, selectedMonth, onMonthChange, onNavigate, onPoPress, onNavigatePOAlerts, onNavigateBacklog }) {
  const now = new Date();
  const prevMonth = () => onMonthChange(selectedMonth.month===0?{year:selectedMonth.year-1,month:11}:{year:selectedMonth.year,month:selectedMonth.month-1});
  const nextMonth = () => {
    if (selectedMonth.year>=now.getFullYear()&&selectedMonth.month>=now.getMonth()) return;
    onMonthChange(selectedMonth.month===11?{year:selectedMonth.year+1,month:0}:{year:selectedMonth.year,month:selectedMonth.month+1});
  };
  const isCurrent = selectedMonth.year===now.getFullYear()&&selectedMonth.month===now.getMonth();
  const alerts = [...(poStats?.overdue||[]), ...(poStats?.nearDue||[])];
  const hasAlerts = alerts.length > 0;

  return (
    <View style={pw.card}>
      <View style={pw.header}>
        <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
          <View style={pw.iconWrap}><Icon name="shopping-bag" size={13} color={BRAND}/></View>
          <Text style={pw.title}>Purchase Orders</Text>
          {hasAlerts&&<View style={pw.badge}><Text style={pw.badgeTxt}>{alerts.length}</Text></View>}
        </View>
        <TouchableOpacity onPress={onNavigate} style={pw.seeAllBtn}>
          <Text style={pw.seeAllTxt}>View all</Text>
          <Icon name="chevron-right" size={11} color={BRAND}/>
        </TouchableOpacity>
      </View>

      {/* Month selector */}
      <View style={pw.monthRow}>
        <TouchableOpacity onPress={prevMonth} style={pw.monthArrow}><Icon name="chevron-left" size={13} color="rgba(255,255,255,0.5)"/></TouchableOpacity>
        <Text style={pw.monthTxt}>{MONTH_NAMES[selectedMonth.month]} {selectedMonth.year}{isCurrent?' · Now':''}</Text>
        <TouchableOpacity onPress={nextMonth} style={[pw.monthArrow,isCurrent&&{opacity:0.25}]} disabled={isCurrent}><Icon name="chevron-right" size={13} color="rgba(255,255,255,0.5)"/></TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={pw.statsRow}>
        {[
          {val:String(poStats?.count??'—'), lbl:'Orders', color:'rgba(255,255,255,0.9)', onPress:null},
          {val:poStats?.total?formatINRCompact(poStats.total):'₹—', lbl:'Total Value', color:'#4ADE80', onPress:onNavigate},
          {val:poStats?.remainingValue?formatINRCompact(poStats.remainingValue):'₹0', lbl:'Remaining', color:'#F87171', onPress:()=>poStats?.remainingValue>0&&onNavigateBacklog&&onNavigateBacklog()},
          {val:String((poStats?.overdue?.length??0)+(poStats?.nearDue?.length??0)), lbl:'Alerts', color:'#FCD34D', onPress:()=>{const c=(poStats?.overdue?.length??0)+(poStats?.nearDue?.length??0);if(c>0)onNavigatePOAlerts();}},
        ].map((s,i,arr)=>(
          <React.Fragment key={i}>
            <TouchableOpacity style={pw.statCell} onPress={s.onPress||undefined} activeOpacity={s.onPress?0.7:1} disabled={!s.onPress}>
              <Text style={[pw.statVal,{color:s.color}]}>{s.val}</Text>
              <Text style={pw.statLbl}>{s.lbl}{s.onPress?' ↗':''}</Text>
            </TouchableOpacity>
            {i<arr.length-1&&<View style={pw.statDiv}/>}
          </React.Fragment>
        ))}
      </View>

      {/* Alert rows */}
      {(poStats?.overdue||[]).length>0&&(
        <TouchableOpacity style={pw.alertRow} onPress={onNavigatePOAlerts} activeOpacity={0.8}>
          <Icon name="alert-triangle" size={12} color="#F87171"/>
          <Text style={[pw.alertTxt,{color:'#F87171'}]}>{poStats.overdue.length} PO{poStats.overdue.length>1?'s':''} overdue — tap to review</Text>
          <Icon name="chevron-right" size={11} color="#F87171"/>
        </TouchableOpacity>
      )}
      {(poStats?.nearDue||[]).length>0&&(
        <TouchableOpacity style={[pw.alertRow,{borderColor:'rgba(252,211,77,0.2)',backgroundColor:'rgba(252,211,77,0.06)'}]} onPress={onNavigatePOAlerts} activeOpacity={0.8}>
          <Icon name="clock" size={12} color="#FCD34D"/>
          <Text style={[pw.alertTxt,{color:'#FCD34D'}]}>{poStats.nearDue.length} PO{poStats.nearDue.length>1?'s':''} due within 7 days</Text>
          <Icon name="chevron-right" size={11} color="#FCD34D"/>
        </TouchableOpacity>
      )}

      {/* PO list */}
      {alerts.slice(0,3).map((po,i)=>{
        const isOD = poStats.overdue?.some(p=>p.id===po.id);
        const diff = po.valid_until?Math.ceil((new Date(po.valid_until)-new Date())/86400000):null;
        const dLabel = diff===null?'':diff<0?`${Math.abs(diff)}d overdue`:diff===0?'Today':`${diff}d left`;
        return (
          <TouchableOpacity key={po.id} style={[pw.poRow,i<Math.min(alerts.length,3)-1&&pw.poRowBorder]} onPress={()=>onPoPress(po.id)} activeOpacity={0.75}>
            <View style={[pw.poAccent,{backgroundColor:isOD?'#F87171':'#FCD34D'}]}/>
            <View style={{flex:1}}>
              <Text style={pw.poNum}>{po.po_number}</Text>
              <Text style={pw.poParty} numberOfLines={1}>{po.party_name||'—'}</Text>
            </View>
            <View style={[pw.poChip,{backgroundColor:isOD?'rgba(248,113,113,0.15)':'rgba(252,211,77,0.12)'}]}>
              <Text style={[pw.poChipTxt,{color:isOD?'#F87171':'#FCD34D'}]}>{dLabel}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
      {poStats&&poStats.count===0&&(
        <View style={{paddingVertical:14,alignItems:'center'}}>
          <Text style={{fontSize:11,color:'rgba(255,255,255,0.25)'}}>No POs this month</Text>
        </View>
      )}
    </View>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [greeting,        setGreeting]       = useState('');
  const [updateInfo,      setUpdateInfo]     = useState(null);
  const [updateProgress,  setUpdateProgress] = useState(null);
  const [stats,           setStats]          = useState(null);
  const [profile,         setProfile]        = useState(null);
  const [recentInvoices,  setRecentInvoices] = useState([]);
  const [topParties,      setTopParties]     = useState([]);
  const [overdueInvCount, setOverdueInvCount]= useState(0);
  const [lowStockCount,   setLowStockCount]  = useState(0);
  const [recentQuotes,    setRecentQuotes]   = useState([]);
  const [monthlyTrend,    setMonthlyTrend]   = useState([]);
  const [loading,         setLoading]        = useState(true);
  const [licenseStatus,   setLicenseStatus]  = useState(null);
  const [licenseDismissed,setLicenseDismissed]= useState(false);
  const [showSearch,      setShowSearch]     = useState(false);
  const [searchQuery,     setSearchQuery]    = useState('');
  const [searchResults,   setSearchResults]  = useState(null);
  const [searching,       setSearching]      = useState(false);
  const now0 = new Date();
  const [poSelectedMonth, setPoSelectedMonth]= useState({ year:now0.getFullYear(), month:now0.getMonth() });
  const [poStats,         setPoStats]        = useState(null);
  const searchRef   = useRef(null);
  const searchTimer = useRef(null);
  const loadingRef  = useRef(false);
  const fadeAnim    = useRef(new Animated.Value(0)).current;

  const load = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const h = new Date().getHours();
    setGreeting(h<12?'Good morning ☀️':h<17?'Good afternoon 👋':'Good evening 🌙');
    try {
      const [data, prof, license] = await Promise.all([DB.getDashboardStats(), DB.getProfile(), getLicenseStatus().catch(()=>null)]);
      setStats(data); setProfile(prof); setLicenseStatus(license);
      const [inv, parties] = await Promise.all([DB.getRecentInvoices(3).catch(()=>[]), DB.getTopParties(3).catch(()=>[])]);
      setRecentInvoices(inv||[]); setTopParties(parties||[]);
      // Overdue invoices count
      try {
        const today = new Date().toISOString().split('T')[0];
        const allSales = await DB.getInvoices({ type:'sale' }).catch(()=>[]);
        const overdue = (allSales||[]).filter(i => i.status!=='paid' && i.due_date && i.due_date < today).length;
        setOverdueInvCount(overdue);
        const allItems = await DB.getItems().catch(()=>[]);
        const lowStock = (allItems||[]).filter(i => i.item_type!=='service' && i.min_stock>0 && i.stock<=i.min_stock).length;
        setLowStockCount(lowStock);
        const quotes = await DB.getQuotations().catch(()=>[]);
        setRecentQuotes((quotes||[]).slice(0,4));
      } catch(_) {}
      try {
        const allPOs = await DB.getPurchaseOrders().catch(()=>[]);
        const posWithTotal = await Promise.all(allPOs.map(async po => {
          try {
            const detail = await DB.getPurchaseOrderDetail(po.id);
            const items  = detail?.items||[];
            const total          = items.reduce((s,it)=>s+(it.qty_ordered||0)*(it.rate||0),0);
            const remainingValue = items.reduce((s,it)=>s+Math.max(0,(it.qty_ordered||0)-(it.qty_delivered||0))*(it.rate||0),0);
            return { ...po, total, remainingValue, items };
          } catch { return { ...po, total:0, remainingValue:0, items:[] }; }
        }));
        computePOStats(posWithTotal, poSelectedMonth);
      } catch(_) {}
      const allInv = await DB.getInvoices({ type:'sale' }).catch(()=>[]);
      const now = new Date();
      const trend = [];
      for (let i=5; i>=0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
        const y=d.getFullYear(), m=d.getMonth();
        const from=`${y}-${String(m+1).padStart(2,'0')}-01`;
        const to=new Date(y,m+1,0).toISOString().split('T')[0];
        const total=(allInv||[]).filter(inv=>inv.date>=from&&inv.date<=to).reduce((s,inv)=>s+(inv.total||0),0);
        trend.push({ label:d.toLocaleDateString('en-IN',{month:'short'}), value:total });
      }
      setMonthlyTrend(trend);
      Animated.timing(fadeAnim, { toValue:1, duration:400, useNativeDriver:true }).start();
    } catch(e) { console.error(e); }
    finally { setLoading(false); loadingRef.current=false; }
  };

  useFocusEffect(useCallback(()=>{ load(); },[]))

  const computePOStats = useCallback((allPOs, { year, month }) => {
    const fromStr = `${year}-${String(month+1).padStart(2,'0')}-01`;
    const lastDay = new Date(year, month+1, 0).getDate();
    const toStr   = `${year}-${String(month+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    const today   = new Date().toISOString().split('T')[0];
    const soon    = new Date(); soon.setDate(soon.getDate()+7);
    const soonStr = soon.toISOString().split('T')[0];
    const monthPOs= (allPOs||[]).filter(po=>po.date>=fromStr&&po.date<=toStr&&po.status!=='completed'&&po.status!=='cancelled');
    const total   = monthPOs.reduce((s,po)=>s+(po.total||0),0);
    const activePOs = (allPOs||[]).filter(po=>po.status==='active'||po.status==='partial');
    const remainingValue = activePOs.reduce((s,po)=>s+(po.remainingValue||0),0);
    const nearDue = (allPOs||[]).filter(po=>(po.status==='active'||po.status==='partial')&&po.valid_until&&po.valid_until>=today&&po.valid_until<=soonStr);
    const overdue = (allPOs||[]).filter(po=>(po.status==='active'||po.status==='partial')&&po.valid_until&&po.valid_until<today);
    setPoStats({ total, count:monthPOs.length, nearDue, overdue, allPOs, remainingValue, activePOs });
  }, []);

  const handlePOMonthChange = useCallback(async (newSel) => {
    setPoSelectedMonth(newSel);
    const allPOs = await DB.getPurchaseOrders().catch(()=>[]);
    const posWithTotal = await Promise.all(allPOs.map(async po => {
      try {
        const detail = await DB.getPurchaseOrderDetail(po.id);
        const items  = detail?.items||[];
        const total          = items.reduce((s,it)=>s+(it.qty_ordered||0)*(it.rate||0),0);
        const remainingValue = items.reduce((s,it)=>s+Math.max(0,(it.qty_ordered||0)-(it.qty_delivered||0))*(it.rate||0),0);
        return { ...po, total, remainingValue, items };
      } catch { return { ...po, total:0, remainingValue:0, items:[] }; }
    }));
    computePOStats(posWithTotal, newSel);
  }, [computePOStats]);

  useEffect(() => {
    if (typeof window==='undefined'||!window.electronAPI) return;
    const cached = window.electronAPI.getUpdateState?.();
    if (cached) {
      if (cached.status==='ready') { setUpdateInfo(cached); setUpdateProgress(null); }
      else if (cached.status==='downloading') { setUpdateInfo({ version:cached.version, notes:cached.notes||'' }); setUpdateProgress(cached.progress??0); }
    }
    const cleanups = [];
    cleanups.push(window.electronAPI.onUpdateDownloading(({ version, notes }) => { setUpdateInfo({ version, notes:notes||'' }); setUpdateProgress(0); }));
    cleanups.push(window.electronAPI.onUpdateProgress(pct => setUpdateProgress(pct)));
    cleanups.push(window.electronAPI.onUpdateReady(data => { setUpdateInfo(data); setUpdateProgress(null); }));
    cleanups.push(window.electronAPI.onUpdateInstallerMissing(() => { setUpdateInfo(null); setUpdateProgress(null); }));
    return () => cleanups.forEach(fn=>fn&&fn());
  }, []);

  const handleSearch = q => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults(null); setSearching(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try { setSearchResults(await DB.globalSearch(q.trim())); }
      catch { setSearchResults({ invoices:[],quotations:[],parties:[],products:[] }); }
      finally { setSearching(false); }
    }, 280);
  };
  const openSearch  = () => { setShowSearch(true); setTimeout(()=>searchRef.current?.focus(),80); };
  const closeSearch = () => { setShowSearch(false); setSearchQuery(''); setSearchResults(null); Keyboard.dismiss(); };
  const goResult = (type, item) => {
    closeSearch();
    if (type==='invoice')   navigation.navigate('InvoicesTab',   { screen:'InvoiceDetail',   params:{ invoiceId:item.id } });
    if (type==='quotation') navigation.navigate('QuotationsTab', { screen:'QuotationDetail', params:{ id:item.id } });
    if (type==='party')     navigation.navigate('PartiesTab',    { screen:'PartyDetail',      params:{ partyId:item.id } });
    if (type==='product')   navigation.navigate('Inventory');
  };

  const monthlySales     = stats?.sales?.total      || 0;
  const monthlyCount     = stats?.sales?.count       || 0;
  const collected        = stats?.collected?.total   || 0;
  const receivables      = stats?.receivables?.total || 0;
  const payables         = stats?.payables?.total    || 0;
  const monthExpenses    = stats?.expenses?.total    || 0;
  const monthPurchases   = stats?.purchases?.total   || 0;
  const netProfit        = monthlySales - monthPurchases - monthExpenses;

  const QUICK = [
    { label:'Invoice',   icon:'file-plus',    color:BRAND,     bg:ACCENT_DIM,              go:()=>navigation.navigate('InvoicesTab',   { screen:'CreateInvoice' }) },
    { label:'Quotation', icon:'clipboard',    color:'#A78BFA', bg:'rgba(167,139,250,0.12)', go:()=>navigation.navigate('QuotationsTab', { screen:'CreateQuotation' }) },
    { label:'New PO',    icon:'shopping-bag', color:'#34D399', bg:'rgba(52,211,153,0.12)',  go:()=>navigation.navigate('More',          { screen:'CreatePO' }) },
    { label:'Party',     icon:'user-plus',    color:'#60A5FA', bg:'rgba(96,165,250,0.12)',  go:()=>navigation.navigate('PartiesTab') },
    { label:'Expense',   icon:'minus-circle', color:'#F87171', bg:'rgba(248,113,113,0.12)', go:()=>navigation.navigate('More',          { screen:'Expenses' }) },
    { label:'Reports',   icon:'bar-chart-2',  color:'#38BDF8', bg:'rgba(56,189,248,0.12)',  go:()=>navigation.navigate('More',          { screen:'Reports' }) },
    { label:'Inventory', icon:'box',          color:'#818CF8', bg:'rgba(129,140,248,0.12)', go:()=>navigation.navigate('Inventory') },
    { label:'Settings',  icon:'settings',     color:'rgba(255,255,255,0.4)', bg:'rgba(255,255,255,0.06)', go:()=>navigation.navigate('More',{ screen:'Settings' }) },
  ];

  const formatDate = ds => {
    if (!ds) return '';
    const d=new Date(ds), t=new Date(), y=new Date(t);
    y.setDate(y.getDate()-1);
    if (d.toDateString()===t.toDateString()) return 'Today';
    if (d.toDateString()===y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN',{ day:'numeric', month:'short' });
  };

  if (loading) {
    return (
      <View style={[s.container,{alignItems:'center',justifyContent:'center'}]}>
        <ActivityIndicator size="large" color={BRAND}/>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop:insets.top }]}>
      <StatusBar style="light"/>
      <Animated.View style={[s.fill, { opacity:fadeAnim }]}>

        {/* ══ TOP BAR ══════════════════════════════════════════════ */}
        <View style={s.topBar}>
          <View style={s.topLeft}>
            <Text style={s.greetTxt}>{greeting}</Text>
            <Text style={s.bizName} numberOfLines={1}>{profile?.name||'My Business'}</Text>
          </View>
          <View style={s.topRight}>
            <TouchableOpacity style={s.topBtn} onPress={openSearch}>
              <Icon name="search" size={16} color="rgba(255,255,255,0.6)"/>
            </TouchableOpacity>
            <TouchableOpacity style={s.topBtn} onPress={()=>navigation.navigate('More',{ screen:'Settings' })}>
              <Icon name="settings" size={16} color="rgba(255,255,255,0.6)"/>
            </TouchableOpacity>
          </View>
        </View>

        {/* Banners */}
        {licenseStatus?.warning && !licenseDismissed && (
          <View style={s.licenseBanner}>
            <Icon name="alert-triangle" size={13} color="#FCD34D"/>
            <Text style={s.licenseTxt}>License expires in {licenseStatus.daysLeft} days</Text>
            <TouchableOpacity style={s.licenseBtn} onPress={()=>Linking.openURL(RENEW_URL)}>
              <Text style={s.licenseBtnTxt}>Renew</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>setLicenseDismissed(true)} style={{padding:4}}>
              <Icon name="x" size={12} color="#FCD34D"/>
            </TouchableOpacity>
          </View>
        )}
        {updateProgress!==null&&updateInfo&&(
          <View style={s.updateDlBanner}>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
              <View style={{flexDirection:'row',alignItems:'center',gap:7}}>
                <Icon name="download" size={13} color="#60A5FA"/>
                <Text style={s.updateDlTitle}>Downloading Locas {updateInfo.version}...</Text>
              </View>
              <Text style={s.updateDlPct}>{updateProgress}%</Text>
            </View>
            <View style={s.updateTrack}><View style={[s.updateFill,{width:`${updateProgress}%`}]}/></View>
            <Text style={s.updateDlSub}>Saving to Downloads. Do not close the app.</Text>
          </View>
        )}
        {updateInfo&&updateProgress===null&&(
          <TouchableOpacity style={s.updateReadyBanner} onPress={()=>window.electronAPI?.installUpdate()} activeOpacity={0.88}>
            <View style={{flexDirection:'row',alignItems:'center',gap:10,flex:1}}>
              <View style={s.updateReadyIcon}><Icon name="package" size={15} color="#fff"/></View>
              <View style={{flex:1}}>
                <Text style={s.updateReadyTitle}>Locas {updateInfo.version} — Ready to Install</Text>
                <Text style={s.updateReadySub}>Tap to open installer and complete the update</Text>
              </View>
            </View>
            <View style={s.updateReadyBtn}>
              <Text style={s.updateReadyBtnTxt}>Install</Text>
              <Icon name="arrow-right" size={12} color="#fff"/>
            </View>
          </TouchableOpacity>
        )}

        {/* ══ MAIN GRID ════════════════════════════════════════════ */}
        <View style={s.grid}>

          {/* ── LEFT COLUMN ── */}
          <View style={s.leftCol}>

            {/* Hero + chart merged */}
            <View style={s.heroCard}>
              <View style={s.heroHeader}>
                <View style={{flex:1}}>
                  <Text style={s.heroEye}>THIS MONTH · SALES</Text>
                  <Text style={s.heroAmt} numberOfLines={1} adjustsFontSizeToFit>{formatINR(monthlySales)}</Text>
                  <View style={{flexDirection:'row',alignItems:'center',gap:6,marginTop:2}}>
                    <Text style={s.heroSub}>{monthlyCount} invoice{monthlyCount!==1?'s':''}</Text>
                    {netProfit !== 0 && (
                      <View style={[s.profitBadge, netProfit < 0 && {backgroundColor:'rgba(248,113,113,0.15)'}]}>
                        <Text style={[s.profitBadgeTxt, netProfit < 0 && {color:'#F87171'}]}>
                          {netProfit >= 0 ? '▲' : '▼'} {formatINRCompact(Math.abs(netProfit))} net
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <Sparkline points={monthlyTrend.map(d=>d.value)} width={68} height={30} color={netProfit>=0?'#4ADE80':'#F87171'}/>
              </View>
              {/* 4 mini stats */}
              <View style={s.heroStats}>
                {[
                  { lbl:'Collected',  val:formatINRCompact(collected),    color:'#4ADE80' },
                  { lbl:'Receivable', val:formatINRCompact(receivables),  color:'#FCD34D' },
                  { lbl:'Expenses',   val:formatINRCompact(monthExpenses),color:'#F87171' },
                  { lbl:'Net',        val:formatINRCompact(netProfit),    color:netProfit>=0?'#4ADE80':'#F87171' },
                ].map((st,i,arr)=>(
                  <React.Fragment key={i}>
                    <View style={s.heroStat}>
                      <Text style={[s.heroStatVal,{color:st.color}]}>{st.val}</Text>
                      <Text style={s.heroStatLbl}>{st.lbl}</Text>
                    </View>
                    {i<arr.length-1&&<View style={s.heroDivider}/>}
                  </React.Fragment>
                ))}
              </View>
              {/* Chart inside hero card */}
              <View style={{marginTop:8}}>
                <AreaChart data={monthlyTrend}/>
              </View>
            </View>

            {/* Quick actions — horizontal single row */}
            <View style={s.qaCard}>
              <View style={s.qaRow}>
                {QUICK.map((a,i)=>(
                  <TouchableOpacity key={i} style={s.qaItem} onPress={a.go} activeOpacity={0.7}>
                    <View style={[s.qaIcon,{backgroundColor:a.bg}]}>
                      <Icon name={a.icon} size={14} color={a.color}/>
                    </View>
                    <Text style={s.qaLabel} numberOfLines={1}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Top parties + recent invoices side by side */}
            <View style={{flexDirection:'row',gap:7,flex:1}}>
              {/* Top parties */}
              <View style={[s.listCard,{flex:1}]}>
                <View style={s.listHead}>
                  <Text style={s.listTitle}>Top Parties</Text>
                  <TouchableOpacity onPress={()=>navigation.navigate('PartiesTab')}><Text style={s.listAction}>See all</Text></TouchableOpacity>
                </View>
                {topParties.length===0?(
                  <Text style={{fontSize:11,color:'rgba(255,255,255,0.2)',paddingVertical:8}}>No parties yet</Text>
                ):topParties.map((p,i)=>{
                  const bal=p.balance||0; const isCredit=bal>0;
                  return (
                    <TouchableOpacity key={p.id} style={[s.row,i<topParties.length-1&&s.rowBorder]} onPress={()=>navigation.navigate('PartiesTab',{screen:'PartyDetail',params:{partyId:p.id}})} activeOpacity={0.75}>
                      <View style={s.avatar}><Text style={s.avatarTxt}>{(p.name||'?')[0].toUpperCase()}</Text></View>
                      <View style={{flex:1}}>
                        <Text style={s.rowName} numberOfLines={1}>{p.name}</Text>
                        <Text style={[s.rowAmtSub,{color:bal===0?'rgba(255,255,255,0.2)':isCredit?'#4ADE80':'#F87171'}]}>{bal===0?'Settled':isCredit?'+'+formatINRCompact(bal):'-'+formatINRCompact(Math.abs(bal))}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Recent invoices */}
              <View style={[s.listCard,{flex:1}]}>
                <View style={s.listHead}>
                  <Text style={s.listTitle}>Recent Invoices</Text>
                  <TouchableOpacity onPress={()=>navigation.navigate('InvoicesTab',{screen:'InvoiceList'})}><Text style={s.listAction}>See all</Text></TouchableOpacity>
                </View>
                {recentInvoices.length===0?(
                  <TouchableOpacity onPress={()=>navigation.navigate('InvoicesTab',{screen:'CreateInvoice'})}>
                    <Text style={{fontSize:11,color:BRAND,paddingVertical:8}}>Create first invoice →</Text>
                  </TouchableOpacity>
                ):recentInvoices.map((inv,i)=>{
                  const isPaid=inv.status==='paid';
                  const isOD=!isPaid&&inv.due_date&&inv.due_date<new Date().toISOString().split('T')[0];
                  const sc=isPaid?{color:'#4ADE80',label:'Paid'}:isOD?{color:'#F87171',label:'Overdue'}:inv.status==='partial'?{color:'#FCD34D',label:'Partial'}:{color:'rgba(255,255,255,0.3)',label:'Unpaid'};
                  return (
                    <TouchableOpacity key={inv.id} style={[s.row,i<recentInvoices.length-1&&s.rowBorder]} onPress={()=>navigation.navigate('InvoicesTab',{screen:'InvoiceDetail',params:{invoiceId:inv.id}})} activeOpacity={0.75}>
                      <View style={{flex:1}}>
                        <Text style={s.rowName} numberOfLines={1}>{inv.invoice_number}</Text>
                        <Text style={s.rowSub} numberOfLines={1}>{inv.party_name||'Walk-in'}</Text>
                      </View>
                      <View style={{alignItems:'flex-end',gap:2}}>
                        <Text style={s.rowAmt}>{formatINRCompact(inv.total)}</Text>
                        <Text style={[s.rowAmtSub,{color:sc.color}]}>{sc.label}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

          </View>

          {/* ── RIGHT COLUMN ── */}
          <View style={s.rightCol}>

            {/* 4 KPI tiles — 2x2 */}
            <View style={s.kpiGrid}>
              {[
                { label:'Outstanding', val:formatINRCompact(receivables), color:'#60A5FA', icon:'file-text',    sub:receivables>0?'To collect':'All clear ✓', go:()=>navigation.navigate('InvoicesTab',{screen:'InvoiceList'}) },
                { label:'Payables',    val:formatINRCompact(payables),    color:'#F87171', icon:'trending-down', sub:'To suppliers',  go:()=>navigation.navigate('PartiesTab') },
                { label:'Open POs',    val:String((poStats?.activePOs||[]).length), color:'#34D399', icon:'shopping-bag', sub:'Active orders', go:()=>navigation.navigate('More',{screen:'PurchaseOrders'}) },
                { label:'Expenses',    val:formatINRCompact(monthExpenses), color:'#FCD34D', icon:'credit-card',  sub:'This month',    go:()=>navigation.navigate('More',{screen:'Expenses'}) },
              ].map((k,i)=>(
                <TouchableOpacity key={i} style={s.kpiTile} onPress={k.go} activeOpacity={0.8}>
                  <View style={[s.kpiDot,{backgroundColor:k.color+'22'}]}><Icon name={k.icon} size={12} color={k.color}/></View>
                  <Text style={[s.kpiVal,{color:k.color}]}>{k.val}</Text>
                  <Text style={s.kpiLbl}>{k.label}</Text>
                  <Text style={s.kpiSub} numberOfLines={1}>{k.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Alert strip — overdue invoices + low stock */}
            <View style={s.alertStrip}>
              <TouchableOpacity style={[s.alertChip, overdueInvCount>0 && s.alertChipRed]} onPress={()=>navigation.navigate('InvoicesTab',{screen:'InvoiceList'})} activeOpacity={0.8}>
                <Icon name="alert-circle" size={12} color={overdueInvCount>0?'#F87171':'rgba(255,255,255,0.3)'}/>
                <Text style={[s.alertChipTxt, overdueInvCount>0 && {color:'#F87171'}]}>{overdueInvCount} Overdue Invoice{overdueInvCount!==1?'s':''}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.alertChip, lowStockCount>0 && s.alertChipYellow]} onPress={()=>navigation.navigate('Inventory')} activeOpacity={0.8}>
                <Icon name="alert-triangle" size={12} color={lowStockCount>0?'#FCD34D':'rgba(255,255,255,0.3)'}/>
                <Text style={[s.alertChipTxt, lowStockCount>0 && {color:'#FCD34D'}]}>{lowStockCount} Low Stock Item{lowStockCount!==1?'s':''}</Text>
              </TouchableOpacity>
            </View>

            {/* Donut + breakdown */}
            <View style={s.donutCard}>
              <Text style={s.donutTitle}>Breakdown · This Month</Text>
              <View style={s.donutBody}>
                <DonutChart collected={collected} outstanding={receivables} expenses={monthExpenses} size={70}/>
                <View style={{flex:1,gap:6}}>
                  {[
                    { color:'#22C55E', label:'Collected',  val:formatINRCompact(collected),     pct: monthlySales>0?Math.round(collected/monthlySales*100):0 },
                    { color:'#F59E0B', label:'Receivable', val:formatINRCompact(receivables),   pct: monthlySales>0?Math.round(receivables/monthlySales*100):0 },
                    { color:'#EF4444', label:'Expenses',   val:formatINRCompact(monthExpenses), pct: monthlySales>0?Math.round(monthExpenses/monthlySales*100):0 },
                  ].map((it,i)=>(
                    <View key={i} style={s.legendRow}>
                      <View style={[s.legendDot,{backgroundColor:it.color}]}/>
                      <Text style={s.legendLbl}>{it.label}</Text>
                      <Text style={[s.legendVal,{color:it.color}]}>{it.val}</Text>
                      <Text style={{fontSize:8,color:'rgba(255,255,255,0.2)',marginLeft:3}}>{it.pct}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* PO Widget */}
            <POWidget
              poStats={poStats}
              selectedMonth={poSelectedMonth}
              onMonthChange={handlePOMonthChange}
              onNavigate={()=>navigation.navigate('More',{screen:'PurchaseOrders'})}
              onPoPress={poId=>navigation.navigate('More',{screen:'PODetail',params:{poId}})}
              onNavigatePOAlerts={()=>navigation.navigate('More',{screen:'POAlerts'})}
              onNavigateBacklog={()=>navigation.navigate('More',{screen:'POBacklog'})}
            />

            {/* Recent Quotations */}
            <View style={[s.listCard,{flex:1}]}>
              <View style={s.listHead}>
                <Text style={s.listTitle}>Quotations</Text>
                <TouchableOpacity onPress={()=>navigation.navigate('QuotationsTab',{screen:'QuotationList'})}><Text style={s.listAction}>See all</Text></TouchableOpacity>
              </View>
              {recentQuotes.length===0?(
                <TouchableOpacity onPress={()=>navigation.navigate('QuotationsTab',{screen:'CreateQuotation'})}>
                  <Text style={{fontSize:11,color:BRAND,paddingVertical:8}}>Create first quotation →</Text>
                </TouchableOpacity>
              ):recentQuotes.map((q,i)=>{
                const isPending  = q.status==='pending'  || !q.status;
                const isAccepted = q.status==='accepted';
                const isConverted= q.status==='converted';
                const isExpired  = q.status==='expired';
                const sc = isConverted ? {color:'#4ADE80',label:'Converted'}
                         : isAccepted  ? {color:'#34D399',label:'Accepted'}
                         : isExpired   ? {color:'#F87171',label:'Expired'}
                         : {color:'#FCD34D',label:'Pending'};
                return (
                  <TouchableOpacity
                    key={q.id}
                    style={[s.row, i<recentQuotes.length-1&&s.rowBorder]}
                    onPress={()=>navigation.navigate('QuotationsTab',{screen:'QuotationDetail',params:{id:q.id}})}
                    activeOpacity={0.75}
                  >
                    <View style={{flex:1}}>
                      <Text style={s.rowName} numberOfLines={1}>{q.quote_number}</Text>
                      <Text style={s.rowSub} numberOfLines={1}>{q.party_name||'—'}</Text>
                    </View>
                    <View style={{alignItems:'flex-end',gap:2}}>
                      <Text style={s.rowAmt}>{formatINRCompact(q.total||0)}</Text>
                      <Text style={[s.rowAmtSub,{color:sc.color}]}>{sc.label}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

          </View>
        </View>
      </Animated.View>

      {/* ── Search modal ── */}
      <Modal visible={showSearch} animationType="fade" transparent onRequestClose={closeSearch}>
        <View style={s.searchOverlay}>
          <View style={[s.searchSheet,{paddingTop:insets.top+8}]}>
            <View style={s.searchHeader}>
              <View style={s.searchInputWrap}>
                <Icon name="search" size={15} color="rgba(255,255,255,0.35)"/>
                <TextInput
                  ref={searchRef}
                  style={s.searchInput}
                  placeholder="Search invoices, parties, products..."
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={searchQuery}
                  onChangeText={handleSearch}
                  autoCapitalize="none" autoCorrect={false}
                />
                {searchQuery.length>0&&(
                  <TouchableOpacity onPress={()=>handleSearch('')}>
                    <Icon name="x" size={14} color="rgba(255,255,255,0.4)"/>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity style={s.searchCancel} onPress={closeSearch}>
                <Text style={s.searchCancelTxt}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={{flex:1}}>
              {searching?(
                <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',paddingVertical:40,gap:10}}>
                  <ActivityIndicator size="small" color={BRAND}/>
                  <Text style={{fontSize:14,color:'rgba(255,255,255,0.4)'}}>Searching...</Text>
                </View>
              ):searchResults?(()=>{
                const total=(searchResults.invoices?.length||0)+(searchResults.quotations?.length||0)+(searchResults.parties?.length||0)+(searchResults.products?.length||0);
                return total===0?(
                  <View style={{alignItems:'center',paddingVertical:48,gap:10}}>
                    <Icon name="search" size={36} color="rgba(255,255,255,0.1)"/>
                    <Text style={{fontSize:14,color:'rgba(255,255,255,0.3)'}}>No results for "{searchQuery}"</Text>
                  </View>
                ):(
                  <>
                    {[
                      {key:'invoices',   type:'invoice',   label:'Invoices',   icon:'file-text', color:'#60A5FA'},
                      {key:'quotations', type:'quotation', label:'Quotations', icon:'clipboard', color:'#A78BFA'},
                      {key:'parties',    type:'party',     label:'Parties',    icon:'users',     color:'#34D399'},
                      {key:'products',   type:'product',   label:'Products',   icon:'package',   color:'#FCD34D'},
                    ].map(({key,type,label,icon,color})=>
                      searchResults[key]?.length>0?(
                        <View key={key} style={{padding:14}}>
                          <Text style={{fontSize:10,fontWeight:'700',color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:0.7,marginBottom:8}}>{label} ({searchResults[key].length})</Text>
                          {searchResults[key].map(item=>{
                            const title=item.invoice_number||item.quote_number||item.name;
                            const sub=type==='invoice'?`${item.party_name||'Walk-in'} · ${formatINR(item.total)}`:type==='quotation'?`${item.party_name||'-'} · ${formatINR(item.total)}`:type==='party'?`${item.phone||''} · ${formatINR(Math.abs(item.balance||0))}`:`₹${item.sale_price} · Stock: ${item.stock||0}`;
                            return (
                              <TouchableOpacity key={`${type}-${item.id}`} style={s.searchResult} onPress={()=>goResult(type,item)}>
                                <View style={[s.searchResultIcon,{backgroundColor:color+'18'}]}><Icon name={icon} size={15} color={color}/></View>
                                <View style={{flex:1}}>
                                  <Text style={s.searchResultTitle} numberOfLines={1}>{title}</Text>
                                  <Text style={s.searchResultSub} numberOfLines={1}>{sub}</Text>
                                </View>
                                <Icon name="chevron-right" size={13} color="rgba(255,255,255,0.2)"/>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ):null
                    )}
                  </>
                );
              })():(
                <View style={{padding:20}}>
                  <Text style={{fontSize:15,fontWeight:'700',color:'rgba(255,255,255,0.7)',marginBottom:16}}>Search across everything</Text>
                  {[
                    {icon:'file-text',color:'#60A5FA',text:'Invoice numbers — INV-0001'},
                    {icon:'clipboard',color:'#A78BFA',text:'Quotation numbers — QUO-0001'},
                    {icon:'users',    color:'#34D399',text:'Party names or phone numbers'},
                    {icon:'package',  color:'#FCD34D',text:'Product names or HSN codes'},
                  ].map((h,i)=>(
                    <View key={i} style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:10}}>
                      <View style={{width:32,height:32,borderRadius:9,backgroundColor:h.color+'18',alignItems:'center',justifyContent:'center'}}>
                        <Icon name={h.icon} size={14} color={h.color}/>
                      </View>
                      <Text style={{fontSize:13,color:'rgba(255,255,255,0.45)'}}>{h.text}</Text>
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

// ── Styles ─────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex:1, backgroundColor:DARK },
  fill:      { flex:1, display:'flex', flexDirection:'column' },

  // Top bar — deep dark
  topBar:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:CARD_BG, paddingHorizontal:14, paddingVertical:8, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.06)' },
  topLeft:   { flex:1 },
  greetTxt:  { fontSize:10, color:'rgba(255,255,255,0.3)', marginBottom:1, letterSpacing:0.2 },
  bizName:   { fontSize:15, fontWeight:'800', color:'#fff' },
  topRight:  { flexDirection:'row', gap:6 },
  topBtn:    { width:30, height:30, borderRadius:8, backgroundColor:'rgba(255,255,255,0.06)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.08)' },

  // Banners
  licenseBanner: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'rgba(252,211,77,0.1)', paddingHorizontal:14, paddingVertical:8, borderBottomWidth:1, borderBottomColor:'rgba(252,211,77,0.2)' },
  licenseTxt:    { flex:1, fontSize:12, fontWeight:'600', color:'#FCD34D' },
  licenseBtn:    { backgroundColor:BRAND, paddingHorizontal:10, paddingVertical:3, borderRadius:6 },
  licenseBtnTxt: { fontSize:11, fontWeight:'700', color:'#fff' },
  updateDlBanner:  { backgroundColor:'rgba(96,165,250,0.08)', paddingHorizontal:14, paddingTop:9, paddingBottom:8, borderBottomWidth:1, borderBottomColor:'rgba(96,165,250,0.15)' },
  updateDlTitle:   { fontSize:12, fontWeight:'700', color:'#60A5FA' },
  updateDlPct:     { fontSize:12, fontWeight:'900', color:'#60A5FA' },
  updateTrack:     { height:4, backgroundColor:'rgba(96,165,250,0.2)', borderRadius:2, overflow:'hidden', marginBottom:5 },
  updateFill:      { height:4, backgroundColor:'#22C55E', borderRadius:2 },
  updateDlSub:     { fontSize:10, color:'rgba(96,165,250,0.6)' },
  updateReadyBanner:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:'#16A34A', paddingHorizontal:14, paddingVertical:10, borderBottomWidth:1, borderBottomColor:'#15803D', gap:10 },
  updateReadyIcon:  { width:30, height:30, borderRadius:15, backgroundColor:'rgba(255,255,255,0.2)', alignItems:'center', justifyContent:'center' },
  updateReadyTitle: { fontSize:12, fontWeight:'700', color:'#fff', marginBottom:1 },
  updateReadySub:   { fontSize:10, color:'rgba(255,255,255,0.75)' },
  updateReadyBtn:   { flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'rgba(0,0,0,0.22)', paddingHorizontal:10, paddingVertical:6, borderRadius:8 },
  updateReadyBtnTxt:{ fontSize:11, fontWeight:'700', color:'#fff' },

  // Grid
  grid:    { flex:1, flexDirection:'row', padding:8, gap:8 },
  leftCol: { flex:1.15, flexDirection:'column', gap:7 },
  rightCol:{ flex:1,    flexDirection:'column', gap:7 },

  // Hero card — compact
  heroCard:   { backgroundColor:CARD_BG, borderRadius:14, padding:12, borderWidth:1, borderColor:'rgba(255,255,255,0.07)' },
  heroHeader: { flexDirection:'row', alignItems:'flex-start', marginBottom:10 },
  heroEye:    { fontSize:8, color:'rgba(255,255,255,0.3)', letterSpacing:1.5, marginBottom:3 },
  heroAmt:    { fontSize:22, fontWeight:'900', color:'#fff', marginBottom:1 },
  heroSub:    { fontSize:9, color:'rgba(255,255,255,0.3)' },
  profitBadge:{ backgroundColor:'rgba(74,222,128,0.12)', paddingHorizontal:6, paddingVertical:2, borderRadius:5 },
  profitBadgeTxt:{ fontSize:9, fontWeight:'700', color:'#4ADE80' },
  heroStats:  { flexDirection:'row', backgroundColor:'rgba(255,255,255,0.04)', borderRadius:8, padding:8 },
  heroStat:   { flex:1, alignItems:'center' },
  heroStatVal:{ fontSize:10, fontWeight:'800', marginBottom:1 },
  heroStatLbl:{ fontSize:7, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:0.4 },
  heroDivider:{ width:1, backgroundColor:'rgba(255,255,255,0.07)' },

  // Chart card — compact
  chartCard: { backgroundColor:CARD_BG, borderRadius:14, padding:10, borderWidth:1, borderColor:'rgba(255,255,255,0.07)' },
  chartHead: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:4 },
  chartTitle:{ fontSize:12, fontWeight:'700', color:'rgba(255,255,255,0.8)' },
  chartSub:  { fontSize:9, color:'rgba(255,255,255,0.25)', textTransform:'uppercase', letterSpacing:0.5 },

  // Quick actions — 1 row of 8, more compact
  qaCard:  { backgroundColor:CARD_BG, borderRadius:14, padding:10, borderWidth:1, borderColor:'rgba(255,255,255,0.07)' },
  qaRow:   { flexDirection:'row', justifyContent:'space-between' },
  qaItem:  { flex:1, alignItems:'center', gap:4 },
  qaIcon:  { width:34, height:34, borderRadius:10, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.06)' },
  qaLabel: { fontSize:7.5, color:'rgba(255,255,255,0.4)', textAlign:'center', fontWeight:'500' },

  // KPI tiles — compact 2x2
  kpiGrid: { flexDirection:'row', flexWrap:'wrap', gap:6 },
  kpiTile: { width:'47.5%', backgroundColor:CARD_BG, borderRadius:12, padding:10, borderWidth:1, borderColor:'rgba(255,255,255,0.07)', gap:2 },
  kpiDot:  { width:24, height:24, borderRadius:7, alignItems:'center', justifyContent:'center', marginBottom:3 },
  kpiVal:  { fontSize:15, fontWeight:'900' },
  kpiLbl:  { fontSize:10, fontWeight:'600', color:'rgba(255,255,255,0.7)' },
  kpiSub:  { fontSize:8, color:'rgba(255,255,255,0.3)' },
  alertStrip:     { flexDirection:'row', gap:6 },
  alertChip:      { flex:1, flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'rgba(255,255,255,0.04)', borderRadius:8, paddingVertical:7, paddingHorizontal:9, borderWidth:1, borderColor:'rgba(255,255,255,0.06)' },
  alertChipRed:   { backgroundColor:'rgba(248,113,113,0.08)', borderColor:'rgba(248,113,113,0.2)' },
  alertChipYellow:{ backgroundColor:'rgba(252,211,77,0.08)', borderColor:'rgba(252,211,77,0.2)' },
  alertChipTxt:   { fontSize:10, fontWeight:'600', color:'rgba(255,255,255,0.3)', flex:1 },

  // Donut — compact
  donutCard:  { backgroundColor:CARD_BG, borderRadius:14, padding:10, borderWidth:1, borderColor:'rgba(255,255,255,0.07)' },
  donutTitle: { fontSize:9, fontWeight:'700', color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:0.8, marginBottom:8 },
  donutBody:  { flexDirection:'row', alignItems:'center', gap:10 },
  legendRow:  { flexDirection:'row', alignItems:'center', gap:6 },
  legendDot:  { width:6, height:6, borderRadius:3 },
  legendLbl:  { flex:1, fontSize:10, color:'rgba(255,255,255,0.45)' },
  legendVal:  { fontSize:10, fontWeight:'700', color:'rgba(255,255,255,0.7)' },

  // Shared list card — compact, flex to fill
  listCard:{ flex:1, backgroundColor:CARD_BG, borderRadius:14, padding:10, borderWidth:1, borderColor:'rgba(255,255,255,0.07)' },
  listHead:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8 },
  listTitle:{ fontSize:9, fontWeight:'700', color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:1 },
  listAction:{ fontSize:10, color:BRAND, fontWeight:'600' },
  row:      { flexDirection:'row', alignItems:'center', paddingVertical:6, gap:8 },
  rowBorder:{ borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.05)' },
  rowName:  { fontSize:11, fontWeight:'700', color:'rgba(255,255,255,0.85)' },
  rowSub:   { fontSize:9, color:'rgba(255,255,255,0.3)', marginTop:1 },
  rowAmt:   { fontSize:11, fontWeight:'800', color:'rgba(255,255,255,0.75)' },
  rowAmtSub:{ fontSize:9, color:'rgba(255,255,255,0.3)' },
  avatar:   { width:28, height:28, borderRadius:8, backgroundColor:ACCENT_DIM, alignItems:'center', justifyContent:'center', flexShrink:0 },
  avatarTxt:{ fontSize:13, fontWeight:'800', color:BRAND },
  invDot:   { width:26, height:26, borderRadius:8, alignItems:'center', justifyContent:'center', borderWidth:1, flexShrink:0 },

  // Search
  searchOverlay:    { flex:1, backgroundColor:'rgba(0,0,0,0.7)' },
  searchSheet:      { flex:1, backgroundColor:DARK },
  searchHeader:     { flexDirection:'row', alignItems:'center', gap:10, paddingHorizontal:14, paddingBottom:10, backgroundColor:CARD_BG, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.06)' },
  searchInputWrap:  { flex:1, flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'rgba(255,255,255,0.06)', borderRadius:10, paddingHorizontal:12, paddingVertical:9, borderWidth:1, borderColor:'rgba(255,255,255,0.08)' },
  searchInput:      { flex:1, fontSize:14, color:'#fff', paddingVertical:0 },
  searchCancel:     { paddingLeft:4, paddingVertical:8 },
  searchCancelTxt:  { fontSize:14, fontWeight:'600', color:BRAND },
  searchResult:     { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:CARD_BG, borderRadius:12, padding:11, marginBottom:6, borderWidth:1, borderColor:'rgba(255,255,255,0.06)' },
  searchResultIcon: { width:34, height:34, borderRadius:9, alignItems:'center', justifyContent:'center', flexShrink:0 },
  searchResultTitle:{ fontSize:13, fontWeight:'600', color:'rgba(255,255,255,0.85)' },
  searchResultSub:  { fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:1 },
});

// ── PO Widget Styles ───────────────────────────────────────────────
const pw = StyleSheet.create({
  card:       { backgroundColor:CARD_BG, borderRadius:14, padding:10, borderWidth:1, borderColor:'rgba(255,255,255,0.07)' },
  header:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:10 },
  iconWrap:   { width:26, height:26, borderRadius:8, backgroundColor:ACCENT_DIM, alignItems:'center', justifyContent:'center' },
  title:      { fontSize:10, fontWeight:'700', color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:1 },
  badge:      { backgroundColor:BRAND, borderRadius:10, paddingHorizontal:5, paddingVertical:1, minWidth:18, alignItems:'center' },
  badgeTxt:   { fontSize:9, fontWeight:'900', color:'#fff' },
  seeAllBtn:  { flexDirection:'row', alignItems:'center', gap:3 },
  seeAllTxt:  { fontSize:11, color:BRAND, fontWeight:'600' },

  monthRow:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:'rgba(255,255,255,0.04)', borderRadius:10, paddingVertical:7, paddingHorizontal:10, marginBottom:10 },
  monthArrow: { padding:3 },
  monthTxt:   { fontSize:12, fontWeight:'600', color:'rgba(255,255,255,0.7)' },

  statsRow:   { flexDirection:'row', backgroundColor:'rgba(255,255,255,0.04)', borderRadius:10, padding:10, marginBottom:10 },
  statCell:   { flex:1, alignItems:'center' },
  statDiv:    { width:1, backgroundColor:'rgba(255,255,255,0.07)', marginVertical:2 },
  statVal:    { fontSize:14, fontWeight:'900', marginBottom:2 },
  statLbl:    { fontSize:8, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:0.4 },

  alertRow:   { flexDirection:'row', alignItems:'center', gap:7, backgroundColor:'rgba(248,113,113,0.08)', borderRadius:9, padding:9, marginBottom:6, borderWidth:1, borderColor:'rgba(248,113,113,0.18)' },
  alertTxt:   { flex:1, fontSize:11, fontWeight:'500' },

  poRow:      { flexDirection:'row', alignItems:'center', gap:8, paddingVertical:9 },
  poRowBorder:{ borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.05)' },
  poAccent:   { width:3, height:32, borderRadius:2, flexShrink:0 },
  poNum:      { fontSize:12, fontWeight:'700', color:'rgba(255,255,255,0.85)' },
  poParty:    { fontSize:10, color:'rgba(255,255,255,0.35)', marginTop:1 },
  poChip:     { paddingHorizontal:7, paddingVertical:3, borderRadius:7 },
  poChipTxt:  { fontSize:9, fontWeight:'700' },
});
