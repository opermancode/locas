import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Animated, Platform, Dimensions,
  ActivityIndicator, TextInput, Modal, Keyboard, Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from '../../utils/Icon';
import * as DB from '../../db';
import { formatINRCompact, formatINR } from '../../utils/gst';
import { getLicenseStatus } from '../../utils/licenseSystem';
import { COLORS, RADIUS, FONTS } from '../../theme';

const RENEW_URL = 'https://your-website.com/renew';
const BRAND = '#FF6B00';

function useIsWide() {
  const [wide, setWide] = useState(Platform.OS === 'web' && Dimensions.get('window').width >= 900);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const sub = Dimensions.addEventListener('change', ({ window }) => setWide(window.width >= 900));
    return () => sub?.remove();
  }, []);
  return wide;
}

// ── Tiny SVG bar chart (pure RN, no lib needed) ───────────────────
function MiniBarChart({ data = [], color = BRAND, height = 52 }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const BAR_W = 18, GAP = 6;
  const totalW = data.length * (BAR_W + GAP) - GAP;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, width: totalW }}>
      {data.map((d, i) => {
        const h = Math.max(3, Math.round((d.value / max) * height));
        return (
          <View key={i} style={{ alignItems: 'center', marginRight: i < data.length - 1 ? GAP : 0 }}>
            <View style={{
              width: BAR_W, height: h,
              backgroundColor: i === data.length - 1 ? color : color + '55',
              borderRadius: 4,
            }} />
          </View>
        );
      })}
    </View>
  );
}

// ── Donut chart (SVG via inline HTML on web, fallback rings on native) ─
function DonutChart({ collected, outstanding, expenses, size = 100 }) {
  const total = collected + outstanding + expenses || 1;
  const segments = [
    { value: collected,   color: '#22C55E' },
    { value: outstanding, color: '#F59E0B' },
    { value: expenses,    color: '#EF4444' },
  ];

  if (Platform.OS !== 'web') {
    // Native fallback: stacked rings
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {segments.map((seg, i) => {
          const ringSize = size - i * 14;
          return (
            <View key={i} style={{
              position: 'absolute',
              width: ringSize, height: ringSize, borderRadius: ringSize / 2,
              borderWidth: 5, borderColor: seg.color + (seg.value === 0 ? '22' : 'CC'),
            }} />
          );
        })}
      </View>
    );
  }

  // Web: SVG donut
  const cx = size / 2, cy = size / 2, r = size / 2 - 10, stroke = 14;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const arcs = segments.map(seg => {
    const dash = (seg.value / total) * circumference;
    const arc = { dash, offset, color: seg.color };
    offset += dash;
    return arc;
  });

  const svgHtml = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#F1F5F9" stroke-width="${stroke}"/>
    ${arcs.map(a => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${a.color}" stroke-width="${stroke}"
      stroke-dasharray="${a.dash} ${circumference - a.dash}"
      stroke-dashoffset="${-a.offset + circumference * 0.25}"
      transform="rotate(-90 ${cx} ${cy})"/>`).join('')}
  </svg>`;

  return React.createElement('div', {
    style: { width: size, height: size },
    dangerouslySetInnerHTML: { __html: svgHtml },
  });
}

// ── Sparkline for hero card ────────────────────────────────────────
function Sparkline({ points = [], width = 120, height = 36, color = '#4ADE80' }) {
  if (points.length < 2) return null;
  if (Platform.OS !== 'web') return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const step  = width / (points.length - 1);
  const coords = points.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });
  const pathD = `M${coords.join(' L')}`;
  const fillD = `M${coords[0]} L${coords.join(' L')} L${width},${height} L0,${height} Z`;
  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <path d="${fillD}" fill="${color}22"/>
    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
  return React.createElement('div', {
    style: { width, height },
    dangerouslySetInnerHTML: { __html: svg },
  });
}

// ── Sales Line Chart — responsive width, white bg ─────────────
function SalesLineChart({ data = [] }) {
  const W = 400, H = 130, PAD = { l: 36, r: 12, t: 18, b: 28 };
  const cW = W - PAD.l - PAD.r;
  const cH = H - PAD.t - PAD.b;

  if (!data.length || data.every(d => d.value === 0)) {
    if (Platform.OS !== 'web') return null;
    return React.createElement('div', {
      style: { width: '100%', height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    }, React.createElement('span', { style: { fontSize: 11, color: '#94A3B8' } }, 'No data yet'));
  }

  const max   = Math.max(...data.map(d => d.value), 1);
  const yTick = (v) => (PAD.t + (1 - v / max) * cH).toFixed(1);
  const xTick = (i) => (PAD.l + (i / Math.max(data.length - 1, 1)) * cW).toFixed(1);

  const pts = data.map((d, i) => ({ x: parseFloat(xTick(i)), y: parseFloat(yTick(d.value)), ...d }));
  const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const fillD = `${lineD} L${pts[pts.length-1].x},${PAD.t + cH} L${PAD.l},${PAD.t + cH} Z`;

  // Native: simple bars
  if (Platform.OS !== 'web') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 5, paddingHorizontal: 4, marginTop: 8 }}>
        {data.map((d, i) => {
          const barH = Math.max(3, Math.round((d.value / max) * 72));
          const isLast = i === data.length - 1;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ width: '65%', height: barH, backgroundColor: isLast ? BRAND : BRAND + '44', borderRadius: 3 }} />
              <Text style={{ fontSize: 8, color: COLORS.textMute, marginTop: 4 }}>{d.label}</Text>
            </View>
          );
        })}
      </View>
    );
  }

  // Y-axis labels
  const yLabels = [0, 0.5, 1].map(v => ({
    y: yTick(v * max),
    label: v === 0 ? '0' : v === 1 ? (max >= 1000 ? (max/1000).toFixed(0)+'K' : max.toFixed(0)) : (max/2 >= 1000 ? (max/2000).toFixed(0)+'K' : (max/2).toFixed(0)),
  }));

  const svgHtml = `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${BRAND}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${BRAND}" stop-opacity="0.01"/>
      </linearGradient>
    </defs>
    ${yLabels.map(l => `
      <line x1="${PAD.l}" y1="${l.y}" x2="${W - PAD.r}" y2="${l.y}" stroke="#F1F5F9" stroke-width="1"/>
      <text x="${PAD.l - 4}" y="${parseFloat(l.y) + 3}" text-anchor="end" font-size="8" fill="#94A3B8">${l.label}</text>
    `).join('')}
    <path d="${fillD}" fill="url(#g)"/>
    <path d="${lineD}" fill="none" stroke="${BRAND}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${pts.map((p, i) => {
      const isLast = i === pts.length - 1;
      const fmt = p.value >= 1000 ? (p.value/1000).toFixed(1)+'K' : p.value > 0 ? p.value.toFixed(0) : '';
      return `
        ${isLast ? `<circle cx="${p.x}" cy="${p.y}" r="8" fill="${BRAND}1A"/>` : ''}
        <circle cx="${p.x}" cy="${p.y}" r="${isLast ? 4 : 2.5}" fill="${isLast ? BRAND : '#fff'}" stroke="${BRAND}" stroke-width="1.5"/>
        ${fmt && isLast ? `<text x="${p.x}" y="${p.y - 9}" text-anchor="middle" font-size="8" font-weight="700" fill="${BRAND}">${fmt}</text>` : ''}
        <text x="${p.x}" y="${H - 4}" text-anchor="middle" font-size="8" fill="#94A3B8">${p.label}</text>
      `;
    }).join('')}
  </svg>`;

  return React.createElement('div', {
    style: { width: '100%', height: H },
    dangerouslySetInnerHTML: { __html: svgHtml },
  });
}

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const isWide = useIsWide();

  const [stats,          setStats]          = useState(null);
  const [profile,        setProfile]        = useState(null);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [topParties,     setTopParties]     = useState([]);
  const [lowStock,       setLowStock]       = useState([]);
  const [openPOs,        setOpenPOs]        = useState([]);
  const [monthlyTrend,   setMonthlyTrend]   = useState([]); // last 6 months
  const [refreshing,     setRefreshing]     = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [licenseStatus,  setLicenseStatus]  = useState(null);
  const [licenseDismissed, setLicenseDismissed] = useState(false);

  // Search
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching,     setSearching]     = useState(false);
  const [showSearch,    setShowSearch]    = useState(false);
  const searchRef   = useRef(null);
  const searchTimer = useRef(null);
  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const loadingRef  = useRef(false);

  const load = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const [data, prof, license] = await Promise.all([
        DB.getDashboardStats(),
        DB.getProfile(),
        getLicenseStatus().catch(() => null),
      ]);
      setStats(data);
      setProfile(prof);
      setLicenseStatus(license);

      const [inv, parties, stock, pos] = await Promise.all([
        DB.getRecentInvoices(6).catch(() => []),
        DB.getTopParties(5).catch(() => []),
        DB.getLowStockProducts(5).catch(() => []),
        DB.getPurchaseOrders({ status: 'active' }).catch(() => []),
      ]);
      setRecentInvoices(inv || []);
      setTopParties(parties || []);
      setLowStock(stock || []);
      setOpenPOs((pos || []).slice(0, 5));

      // Build last-6-months trend from invoices
      try {
        const allInv = await DB.getInvoices({ type: 'sale' });
        const now = new Date();
        const trend = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const y = d.getFullYear(), m = d.getMonth();
          const from = `${y}-${String(m+1).padStart(2,'0')}-01`;
          const to   = new Date(y, m+1, 0).toISOString().split('T')[0];
          const total = (allInv || [])
            .filter(inv => inv.date >= from && inv.date <= to && inv.type === 'sale')
            .reduce((s, inv) => s + (inv.total || 0), 0);
          trend.push({
            label: d.toLocaleDateString('en-IN', { month: 'short' }),
            value: total,
          });
        }
        setMonthlyTrend(trend);
      } catch (_) {}

      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setRefreshing(false);
      setLoading(false);
      loadingRef.current = false;
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleSearch = (q) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults(null); setSearching(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await DB.globalSearch(q.trim());
        setSearchResults(r);
      } catch (_) {
        setSearchResults({ invoices: [], quotations: [], parties: [], products: [] });
      } finally { setSearching(false); }
    }, 280);
  };

  const openSearch = () => { setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 80); };
  const closeSearch = () => { setShowSearch(false); setSearchQuery(''); setSearchResults(null); Keyboard.dismiss(); };
  const goResult = (type, item) => {
    closeSearch();
    if (type === 'invoice')   navigation.navigate('InvoicesTab',   { screen: 'InvoiceDetail',   params: { invoiceId: item.id } });
    if (type === 'quotation') navigation.navigate('QuotationsTab', { screen: 'QuotationDetail', params: { id: item.id } });
    if (type === 'party')     navigation.navigate('PartiesTab',    { screen: 'PartyDetail',      params: { partyId: item.id } });
    if (type === 'product')   navigation.navigate('Inventory');
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const formatDate = (ds) => {
    if (!ds) return '';
    const d = new Date(ds), t = new Date();
    const y = new Date(t); y.setDate(y.getDate() - 1);
    if (d.toDateString() === t.toDateString()) return 'Today';
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const monthlySales  = stats?.sales?.total       || 0;
  const monthlyCount  = stats?.sales?.count        || 0;
  const collected     = stats?.collected?.total    || 0;
  const receivables   = stats?.receivables?.total  || 0;
  const payables      = stats?.payables?.total     || 0;
  const monthExpenses = stats?.expenses?.total     || 0;
  const netProfit     = monthlySales - monthExpenses;
  const topCustomers  = stats?.topCustomers        || [];

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }

  const MainContent = (
    <Animated.View style={{ opacity: fadeAnim }}>

      {/* ── Top bar ── */}
      <View style={s.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.greetTxt}>{greeting} 👋</Text>
          <Text style={s.bizName} numberOfLines={1}>{profile?.name || 'My Business'}</Text>
        </View>
        <TouchableOpacity style={s.topBtn} onPress={openSearch}>
          <Icon name="search" size={18} color={COLORS.textSub} />
        </TouchableOpacity>
        <TouchableOpacity style={s.topBtn} onPress={() => navigation.navigate('More', { screen: 'Settings' })}>
          <Icon name="settings" size={18} color={COLORS.textSub} />
        </TouchableOpacity>
      </View>

      {/* ── Alert banners ── */}
      {licenseStatus?.warning && !licenseDismissed && (
        <View style={s.bannerWarn}>
          <Icon name="alert-triangle" size={14} color="#92400E" />
          <Text style={s.bannerTxt}>License expires in {licenseStatus.daysLeft} days</Text>
          <TouchableOpacity style={s.bannerBtn} onPress={() => Linking.openURL(RENEW_URL)}>
            <Text style={s.bannerBtnTxt}>Renew</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setLicenseDismissed(true)} style={{ padding: 4 }}>
            <Icon name="x" size={14} color="#92400E" />
          </TouchableOpacity>
        </View>
      )}
      {lowStock.length > 0 && (
        <TouchableOpacity style={s.bannerDanger} onPress={() => navigation.navigate('Inventory')}>
          <Icon name="alert-circle" size={14} color="#991B1B" />
          <Text style={s.bannerDangerTxt}>{lowStock.length} item{lowStock.length > 1 ? 's' : ''} running low</Text>
          <Icon name="chevron-right" size={14} color="#991B1B" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
      )}

      {/* ── Hero card with sparkline ── */}
      <View style={s.heroCard}>
        <View style={s.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.heroLabel}>This Month · Sales</Text>
            <Text style={s.heroAmt}>{formatINR(monthlySales)}</Text>
            <Text style={s.heroSub}>{monthlyCount} invoice{monthlyCount !== 1 ? 's' : ''}</Text>
          </View>
          {monthlyTrend.length > 1 && (
            <View style={{ alignItems: 'flex-end', justifyContent: 'flex-end' }}>
              <Sparkline
                points={monthlyTrend.map(d => d.value)}
                width={100} height={40}
                color={netProfit >= 0 ? '#4ADE80' : '#F87171'}
              />
              <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>6-month trend</Text>
            </View>
          )}
        </View>

        {/* Stats row */}
        <View style={s.heroStats}>
          <HeroStat label="Collected"  value={formatINRCompact(collected)}    color="#4ADE80" />
          <View style={s.heroDiv} />
          <HeroStat label="Receivable" value={formatINRCompact(receivables)}  color="#FCD34D" />
          <View style={s.heroDiv} />
          <HeroStat label="Expenses"   value={formatINRCompact(monthExpenses)} color="#F87171" />
          <View style={s.heroDiv} />
          <HeroStat label="Net Profit" value={formatINRCompact(netProfit)} color={netProfit >= 0 ? '#4ADE80' : '#F87171'} />
        </View>
      </View>

      {/* ── Trend + breakdown row ── */}
      <View style={s.chartsRow}>

        {/* Sales trend card — takes left 60% */}
        <View style={s.trendCard}>
          <View style={s.trendCardHeader}>
            <View>
              <Text style={s.trendCardTitle}>Sales Trend</Text>
              <Text style={s.trendCardSub}>Last 6 months</Text>
            </View>
            {monthlyTrend.length > 0 && (() => {
              const last = monthlyTrend[monthlyTrend.length-1]?.value || 0;
              const prev = monthlyTrend[monthlyTrend.length-2]?.value || 0;
              const up   = last >= prev;
              return (
                <View style={[s.trendBadge, { backgroundColor: up ? '#F0FDF4' : '#FEF2F2' }]}>
                  <Text style={[s.trendBadgeTxt, { color: up ? '#16A34A' : '#DC2626' }]}>
                    {up ? '↑' : '↓'} {formatINRCompact(last)}
                  </Text>
                </View>
              );
            })()}
          </View>
          <SalesLineChart data={monthlyTrend} />
        </View>

        {/* Right col — breakdown donut — takes right 40% */}
        <View style={s.breakdownCard}>
          <Text style={s.donutTitle}>Breakdown</Text>
          <View style={s.donutRow}>
            <DonutChart collected={collected} outstanding={receivables} expenses={monthExpenses} size={70} />
            <View style={s.donutLegend}>
              {[
                { color:'#22C55E', label:'Collected',  value: formatINRCompact(collected) },
                { color:'#F59E0B', label:'Receivable', value: formatINRCompact(receivables) },
                { color:'#EF4444', label:'Expenses',   value: formatINRCompact(monthExpenses) },
              ].map((item, i) => (
                <View key={i} style={s.donutLegendRow}>
                  <View style={[s.donutDot, { backgroundColor: item.color }]} />
                  <Text style={s.donutLegendLabel} numberOfLines={1}>{item.label}</Text>
                  <Text style={s.donutLegendVal}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* ── 3 mini stat cards full width row ── */}
      <View style={s.miniStatsRow}>
        <View style={[s.statMiniCard, { borderTopColor: netProfit >= 0 ? '#16A34A' : '#DC2626' }]}>
          <Icon name={netProfit >= 0 ? 'trending-up' : 'trending-down'} size={14} color={netProfit >= 0 ? '#16A34A' : '#DC2626'} />
          <Text style={s.statMiniLbl}>Net Profit</Text>
          <Text style={[s.statMiniVal, { color: netProfit >= 0 ? '#16A34A' : '#DC2626' }]}>
            {formatINRCompact(Math.abs(netProfit))}
          </Text>
        </View>
        <View style={[s.statMiniCard, { borderTopColor: '#3B82F6' }]}>
          <Icon name="check-circle" size={14} color="#3B82F6" />
          <Text style={s.statMiniLbl}>Collection Rate</Text>
          <Text style={[s.statMiniVal, { color: '#3B82F6' }]}>
            {monthlySales > 0 ? Math.round((collected / monthlySales) * 100) : 0}%
          </Text>
        </View>
        <View style={[s.statMiniCard, { borderTopColor: '#10B981' }]}>
          <Icon name="shopping-bag" size={14} color="#10B981" />
          <Text style={s.statMiniLbl}>Open POs</Text>
          <Text style={[s.statMiniVal, { color: '#10B981' }]}>{openPOs.length}</Text>
        </View>
        <View style={[s.statMiniCard, { borderTopColor: BRAND }]}>
          <Icon name="file-text" size={14} color={BRAND} />
          <Text style={s.statMiniLbl}>Invoices</Text>
          <Text style={[s.statMiniVal, { color: BRAND }]}>{monthlyCount}</Text>
        </View>
      </View>

      {/* ── KPI tiles ── */}
      <View style={s.kpiGrid}>
        {/* Outstanding */}
        <TouchableOpacity style={[s.kpiTile, { borderTopColor: '#3B82F6' }]}
          onPress={() => navigation.navigate('InvoicesTab', { screen: 'InvoiceList' })}>
          <View style={[s.kpiIcon, { backgroundColor: '#EFF6FF' }]}>
            <Icon name="file-text" size={17} color="#3B82F6" />
          </View>
          <Text style={s.kpiAmt}>{formatINRCompact(receivables)}</Text>
          <Text style={s.kpiLbl}>Outstanding</Text>
          <Text style={s.kpiSub}>{receivables > 0 ? 'Tap to view' : 'All clear ✓'}</Text>
        </TouchableOpacity>

        {/* Payables */}
        <TouchableOpacity style={[s.kpiTile, { borderTopColor: '#EF4444' }]}
          onPress={() => navigation.navigate('PartiesTab')}>
          <View style={[s.kpiIcon, { backgroundColor: '#FEF2F2' }]}>
            <Icon name="trending-down" size={17} color="#EF4444" />
          </View>
          <Text style={s.kpiAmt}>{formatINRCompact(payables)}</Text>
          <Text style={s.kpiLbl}>Payables</Text>
          <Text style={s.kpiSub}>To suppliers</Text>
        </TouchableOpacity>

        {/* Open POs — ✅ FIXED: now navigates to PurchaseOrders, not QuotationsTab */}
        <TouchableOpacity style={[s.kpiTile, { borderTopColor: '#10B981' }]}
          onPress={() => navigation.navigate('More', { screen: 'PurchaseOrders' })}>
          <View style={[s.kpiIcon, { backgroundColor: '#ECFDF5' }]}>
            <Icon name="shopping-bag" size={17} color="#10B981" />
          </View>
          <Text style={s.kpiAmt}>{openPOs.length}</Text>
          <Text style={s.kpiLbl}>Open POs</Text>
          <Text style={s.kpiSub}>Purchase orders active</Text>
        </TouchableOpacity>

        {/* Expenses */}
        <TouchableOpacity style={[s.kpiTile, { borderTopColor: '#F59E0B' }]}
          onPress={() => navigation.navigate('More', { screen: 'Expenses' })}>
          <View style={[s.kpiIcon, { backgroundColor: '#FFFBEB' }]}>
            <Icon name="credit-card" size={17} color="#F59E0B" />
          </View>
          <Text style={s.kpiAmt}>{formatINRCompact(monthExpenses)}</Text>
          <Text style={s.kpiLbl}>Expenses</Text>
          <Text style={s.kpiSub}>This month</Text>
        </TouchableOpacity>
      </View>

      {/* ── Quick actions ── */}
      <SH title="Quick Actions" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.qaScroll}>
        {[
          { label: 'New Invoice',   icon: 'file-plus',    color: BRAND,      bg: '#FFF0E6', onPress: () => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' }) },
          { label: 'New Quotation', icon: 'clipboard',    color: '#8B5CF6',  bg: '#F5F3FF', onPress: () => navigation.navigate('QuotationsTab', { screen: 'CreateQuotation' }) },
          { label: 'New PO',        icon: 'shopping-bag', color: '#10B981',  bg: '#ECFDF5', onPress: () => navigation.navigate('More', { screen: 'PurchaseOrders' }) },
          { label: 'Add Party',     icon: 'user-plus',    color: '#3B82F6',  bg: '#EFF6FF', onPress: () => navigation.navigate('PartiesTab') },
          { label: 'Add Expense',   icon: 'minus-circle', color: '#EF4444',  bg: '#FEF2F2', onPress: () => navigation.navigate('More', { screen: 'Expenses' }) },
          { label: 'Inventory',     icon: 'box',          color: '#6366F1',  bg: '#EEF2FF', onPress: () => navigation.navigate('Inventory') },
          { label: 'Reports',       icon: 'bar-chart-2',  color: '#0EA5E9',  bg: '#F0F9FF', onPress: () => navigation.navigate('More', { screen: 'Reports' }) },
          { label: 'Settings',      icon: 'settings',     color: '#64748B',  bg: '#F1F5F9', onPress: () => navigation.navigate('More', { screen: 'Settings' }) },
        ].map((a, i) => (
          <TouchableOpacity key={i} style={s.qaItem} onPress={a.onPress} activeOpacity={0.75}>
            <View style={[s.qaIcon, { backgroundColor: a.bg }]}>
              <Icon name={a.icon} size={20} color={a.color} />
            </View>
            <Text style={s.qaLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Two-column layout on wide screens ── */}
      <View style={isWide ? s.wideColumns : null}>

        {/* LEFT column */}
        <View style={isWide ? s.wideLeft : null}>

          {/* Recent invoices table */}
          <SH title="Recent Invoices" action="See all" onAction={() => navigation.navigate('InvoicesTab', { screen: 'InvoiceList' })} />
          <View style={s.tableCard}>
            <View style={s.thead}>
              <Text style={[s.th, { flex: 1.4 }]}>Invoice</Text>
              <Text style={[s.th, { flex: 2 }]}>Customer</Text>
              <Text style={[s.th, { flex: 1.1, textAlign: 'right' }]}>Amount</Text>
              <Text style={[s.th, { flex: 0.9, textAlign: 'center' }]}>Status</Text>
            </View>
            {recentInvoices.length === 0 ? (
              <View style={s.emptyRow}>
                <Icon name="file-text" size={22} color={COLORS.textMute} />
                <Text style={s.emptyTxt}>No invoices yet</Text>
                <TouchableOpacity style={s.emptyAction} onPress={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })}>
                  <Text style={s.emptyActionTxt}>Create first invoice →</Text>
                </TouchableOpacity>
              </View>
            ) : recentInvoices.map((inv, i) => {
              const isPaid = inv.status === 'paid';
              const isOD   = !isPaid && inv.due_date && inv.due_date < new Date().toISOString().split('T')[0];
              const sc     = isPaid ? { bg:'#D1FAE5', text:'#065F46', label:'Paid' }
                           : isOD  ? { bg:'#FECACA', text:'#7F1D1D', label:'Overdue' }
                           : inv.status === 'partial' ? { bg:'#FEF3C7', text:'#92400E', label:'Partial' }
                           : { bg:'#FEE2E2', text:'#991B1B', label:'Unpaid' };
              return (
                <TouchableOpacity key={inv.id} style={[s.trow, i%2===0 && s.trowEven]}
                  onPress={() => navigation.navigate('InvoicesTab', { screen: 'InvoiceDetail', params: { invoiceId: inv.id } })}
                  activeOpacity={0.75}>
                  <View style={{ flex: 1.4 }}>
                    <Text style={s.invNum} numberOfLines={1}>{inv.invoice_number}</Text>
                    <Text style={s.invDate}>{formatDate(inv.date)}</Text>
                  </View>
                  <Text style={[s.td, { flex: 2 }]} numberOfLines={1}>{inv.party_name || 'Walk-in'}</Text>
                  <Text style={[s.tdAmt, { flex: 1.1 }]}>{formatINR(inv.total)}</Text>
                  <View style={{ flex: 0.9, alignItems: 'center' }}>
                    <View style={[s.pill, { backgroundColor: sc.bg }]}>
                      <Text style={[s.pillTxt, { color: sc.text }]}>{sc.label}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Top customers */}
          {topCustomers.length > 0 && (
            <>
              <SH title="Top Customers This Month" />
              <View style={s.tableCard}>
                <View style={s.thead}>
                  <Text style={[s.th, { flex: 2 }]}>Customer</Text>
                  <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Sales</Text>
                </View>
                {topCustomers.map((c, i) => (
                  <View key={i} style={[s.trow, i%2===0 && s.trowEven]}>
                    <View style={s.custDot}><Text style={s.custDotTxt}>{(c.party_name||'?')[0].toUpperCase()}</Text></View>
                    <Text style={[s.td, { flex: 2, marginLeft: 8 }]} numberOfLines={1}>{c.party_name || 'Unknown'}</Text>
                    <Text style={[s.tdAmt, { flex: 1 }]}>{formatINR(c.total)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* RIGHT column */}
        <View style={isWide ? s.wideRight : null}>

          {/* Outstanding balances */}
          {topParties.length > 0 && (
            <>
              <SH title="Outstanding Balances" action="See all" onAction={() => navigation.navigate('PartiesTab')} />
              <View style={s.listCard}>
                {topParties.map((p, i) => (
                  <TouchableOpacity key={p.id}
                    style={[s.partyRow, i < topParties.length-1 && s.rowBorder]}
                    onPress={() => navigation.navigate('PartiesTab', { screen: 'PartyDetail', params: { partyId: p.id } })}
                    activeOpacity={0.75}>
                    <View style={s.partyAvatar}><Text style={s.partyAvatarTxt}>{(p.name||'P')[0].toUpperCase()}</Text></View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.partyName} numberOfLines={1}>{p.name}</Text>
                      {p.phone ? <Text style={s.partySub}>{p.phone}</Text> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[s.partyAmt, p.balance > 0 && { color: COLORS.danger }]}>{formatINR(Math.abs(p.balance || 0))}</Text>
                      <Text style={s.partyLbl}>{p.balance > 0 ? 'To receive' : 'To pay'}</Text>
                    </View>
                    <Icon name="chevron-right" size={14} color={COLORS.textMute} style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Open POs */}
          {openPOs.length > 0 && (
            <>
              <SH title="Open Purchase Orders" action="See all"
                onAction={() => navigation.navigate('More', { screen: 'PurchaseOrders' })} />
              <View style={s.listCard}>
                {openPOs.map((po, i) => (
                  <TouchableOpacity key={po.id}
                    style={[s.poRow, i < openPOs.length-1 && s.rowBorder]}
                    onPress={() => navigation.navigate('More', { screen: 'PODetail', params: { poId: po.id } })}
                    activeOpacity={0.75}>
                    <View style={s.poIcon}><Icon name="shopping-bag" size={14} color={COLORS.primary} /></View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.poNum} numberOfLines={1}>{po.po_number}</Text>
                      <Text style={s.poParty} numberOfLines={1}>{po.party_name}</Text>
                    </View>
                    <View style={[s.pill, po.status==='partial' ? { backgroundColor:'#FEF3C7' } : { backgroundColor:'#DBEAFE' }]}>
                      <Text style={[s.pillTxt, po.status==='partial' ? { color:'#92400E' } : { color:'#1E40AF' }]}>
                        {po.status === 'partial' ? 'Partial' : 'Active'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Low stock */}
          {lowStock.length > 0 && (
            <>
              <SH title="Low Stock Alert" action="View all" onAction={() => navigation.navigate('Inventory')} />
              <View style={s.listCard}>
                {lowStock.map((item, i) => {
                  const pct = item.min_stock > 0 ? Math.min(1, item.stock / item.min_stock) : 0;
                  return (
                    <View key={item.id} style={[s.stockRow, i < lowStock.length-1 && s.rowBorder]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.stockName} numberOfLines={1}>{item.name}</Text>
                        <View style={s.stockBar}>
                          <View style={[s.stockFill, { width: `${Math.round(pct*100)}%`, backgroundColor: pct < 0.3 ? COLORS.danger : COLORS.warning }]} />
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                        <Text style={[s.stockQty, { color: COLORS.danger }]}>{item.stock} {item.unit}</Text>
                        <Text style={s.stockMin}>min {item.min_stock}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </View>

      <View style={{ height: 60 }} />
    </Animated.View>
  );

  return (
    <View style={[s.container, { paddingTop: isWide ? 0 : insets.top }]}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={BRAND} />}
        contentContainerStyle={[s.scroll, isWide && s.scrollWide]}
        keyboardShouldPersistTaps="handled"
      >
        {MainContent}
      </ScrollView>

      {/* ── Search Modal ── */}
      <Modal visible={showSearch} animationType="fade" transparent onRequestClose={closeSearch}>
        <View style={s.searchOverlay}>
          <View style={[s.searchSheet, { paddingTop: insets.top + 8 }]}>
            <View style={s.searchHeader}>
              <View style={s.searchInputWrap}>
                <Icon name="search" size={16} color={COLORS.textMute} />
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
                    <Icon name="x" size={15} color={COLORS.textMute} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity style={s.searchCancel} onPress={closeSearch}>
                <Text style={s.searchCancelTxt}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
              {searching ? (
                <View style={s.searchLoading}>
                  <ActivityIndicator size="small" color={BRAND} />
                  <Text style={s.searchLoadingTxt}>Searching...</Text>
                </View>
              ) : searchResults ? (
                (() => {
                  const total = (searchResults.invoices?.length || 0) + (searchResults.quotations?.length || 0) +
                    (searchResults.parties?.length || 0) + (searchResults.products?.length || 0);
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
                                        : type==='quotation' ? `${item.party_name||'No party'} · ${formatINR(item.total)}`
                                        : type==='party'     ? `${item.phone||''} · Bal: ${formatINR(Math.abs(item.balance||0))}`
                                        : `₹${item.sale_price} · Stock: ${item.stock||0}`;
                              return (
                                <TouchableOpacity key={`${type}-${item.id}`} style={s.searchResult} onPress={() => goResult(type, item)}>
                                  <View style={[s.searchResultIcon, { backgroundColor: color+'18' }]}>
                                    <Icon name={icon} size={16} color={color} />
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={s.searchResultTitle} numberOfLines={1}>{title}</Text>
                                    <Text style={s.searchResultSub} numberOfLines={1}>{sub}</Text>
                                  </View>
                                  <Icon name="chevron-right" size={14} color={COLORS.border} />
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
                      <Icon name={h.icon} size={15} color={h.color} />
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

// ── Sub-components ─────────────────────────────────────────────────
function SH({ title, action, onAction }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action && <TouchableOpacity onPress={onAction}><Text style={s.sectionAction}>{action} →</Text></TouchableOpacity>}
    </View>
  );
}
function HeroStat({ label, value, color }) {
  return (
    <View style={s.heroStat}>
      <Text style={[s.heroStatVal, { color }]}>{value}</Text>
      <Text style={s.heroStatLbl}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center:    { alignItems: 'center', justifyContent: 'center' },
  scroll:    { padding: 14 },
  scrollWide:{ padding: 22 },

  topBar:   { flexDirection:'row', alignItems:'center', backgroundColor:COLORS.card, padding:13, borderRadius:RADIUS.lg, marginBottom:10, borderWidth:1, borderColor:COLORS.border },
  greetTxt: { fontSize:11, color:COLORS.textMute, marginBottom:1 },
  bizName:  { fontSize:17, fontWeight:FONTS.black, color:COLORS.text, maxWidth:220 },
  topBtn:   { width:38, height:38, borderRadius:10, backgroundColor:COLORS.bg, alignItems:'center', justifyContent:'center', marginLeft:7 },

  // Banners
  bannerWarn:    { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#FEF3C7', borderRadius:RADIUS.md, padding:10, marginBottom:8, borderWidth:1, borderColor:'#FDE68A' },
  bannerTxt:     { flex:1, fontSize:12, fontWeight:FONTS.medium, color:'#92400E' },
  bannerBtn:     { backgroundColor:'#F59E0B', paddingHorizontal:10, paddingVertical:4, borderRadius:6 },
  bannerBtnTxt:  { fontSize:11, fontWeight:FONTS.bold, color:'#fff' },
  bannerDanger:  { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#FEF2F2', borderRadius:RADIUS.md, padding:10, marginBottom:8, borderWidth:1, borderColor:'#FECACA' },
  bannerDangerTxt:{ flex:1, fontSize:12, fontWeight:FONTS.medium, color:'#991B1B' },

  // Hero card
  heroCard:    { backgroundColor:'#0F172A', borderRadius:RADIUS.xl, padding:18, marginBottom:12 },
  heroTop:     { flexDirection:'row', alignItems:'flex-start', marginBottom:18 },
  heroLabel:   { fontSize:11, color:'rgba(255,255,255,0.45)', marginBottom:4 },
  heroAmt:     { fontSize:28, fontWeight:FONTS.black, color:'#fff', marginBottom:2 },
  heroSub:     { fontSize:11, color:'rgba(255,255,255,0.4)' },
  heroStats:   { flexDirection:'row', backgroundColor:'rgba(255,255,255,0.05)', borderRadius:RADIUS.md, padding:12 },
  heroStat:    { flex:1, alignItems:'center' },
  heroStatVal: { fontSize:12, fontWeight:FONTS.bold, marginBottom:2 },
  heroStatLbl: { fontSize:8, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:0.4 },
  heroDiv:     { width:1, height:28, backgroundColor:'rgba(255,255,255,0.08)' },

  // Charts row — trend (left) + breakdown (right)
  chartsRow:       { flexDirection:'row', gap:10, marginBottom:10, alignItems:'stretch' },

  // Trend card — flex:1.6 so it takes ~60% of row
  trendCard:       { flex:1.6, backgroundColor:COLORS.card, borderRadius:RADIUS.xl, padding:14, borderWidth:1, borderColor:COLORS.border, overflow:'hidden' },
  trendCardHeader: { flexDirection:'row', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 },
  trendCardTitle:  { fontSize:13, fontWeight:FONTS.bold, color:COLORS.text },
  trendCardSub:    { fontSize:10, color:COLORS.textMute, marginTop:2 },
  trendBadge:      { paddingHorizontal:8, paddingVertical:3, borderRadius:RADIUS.full },
  trendBadgeTxt:   { fontSize:11, fontWeight:FONTS.bold },

  // Breakdown card — flex:1 so it takes ~40% of row
  breakdownCard:   { flex:1, backgroundColor:COLORS.card, borderRadius:RADIUS.xl, padding:12, borderWidth:1, borderColor:COLORS.border },
  donutTitle:      { fontSize:12, fontWeight:FONTS.bold, color:COLORS.text, marginBottom:8 },
  donutRow:        { flexDirection:'row', alignItems:'center', gap:8 },
  donutLegend:     { flex:1, gap:6 },
  donutLegendRow:  { flexDirection:'row', alignItems:'center', gap:5 },
  donutDot:        { width:7, height:7, borderRadius:4, flexShrink:0 },
  donutLegendLabel:{ flex:1, fontSize:10, color:COLORS.textSub },
  donutLegendVal:  { fontSize:10, fontWeight:FONTS.bold, color:COLORS.text },

  // Mini stats — 4 cards full-width row below charts
  miniStatsRow:  { flexDirection:'row', gap:8, marginBottom:12 },
  statMiniCard:  { flex:1, backgroundColor:COLORS.card, borderRadius:RADIUS.lg, padding:10, borderWidth:1, borderColor:COLORS.border, borderTopWidth:2.5, gap:5 },
  statMiniLbl:   { fontSize:9, color:COLORS.textMute, textTransform:'uppercase', letterSpacing:0.3 },
  statMiniVal:   { fontSize:14, fontWeight:FONTS.black },

  // KPI grid
  kpiGrid: { flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:12 },
  kpiTile: { flex:1, minWidth:'45%', backgroundColor:COLORS.card, borderRadius:RADIUS.lg, padding:14, borderWidth:1, borderColor:COLORS.border, borderTopWidth:3 },
  kpiIcon: { width:34, height:34, borderRadius:9, alignItems:'center', justifyContent:'center', marginBottom:10 },
  kpiAmt:  { fontSize:18, fontWeight:FONTS.black, color:COLORS.text, marginBottom:2 },
  kpiLbl:  { fontSize:12, fontWeight:FONTS.semibold, color:COLORS.text, marginBottom:1 },
  kpiSub:  { fontSize:10, color:COLORS.textMute },

  // Quick actions
  qaScroll: { paddingBottom:4, gap:10, marginBottom:12 },
  qaItem:   { alignItems:'center', width:70 },
  qaIcon:   { width:52, height:52, borderRadius:14, alignItems:'center', justifyContent:'center', marginBottom:6 },
  qaLabel:  { fontSize:10, color:COLORS.textSub, textAlign:'center', fontWeight:FONTS.medium, lineHeight:13 },

  // Section header
  sectionHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:7, marginTop:6 },
  sectionTitle:  { fontSize:14, fontWeight:FONTS.bold, color:COLORS.text },
  sectionAction: { fontSize:12, color:BRAND, fontWeight:FONTS.semibold },

  // Wide layout
  wideColumns: { flexDirection:'row', gap:16, alignItems:'flex-start' },
  wideLeft:    { flex:1.5 },
  wideRight:   { flex:1 },

  // Table card
  tableCard: { backgroundColor:COLORS.card, borderRadius:RADIUS.lg, borderWidth:1, borderColor:COLORS.border, overflow:'hidden', marginBottom:12 },
  thead:     { flexDirection:'row', backgroundColor:'#F8FAFC', paddingHorizontal:12, paddingVertical:8, borderBottomWidth:1, borderBottomColor:COLORS.border },
  th:        { fontSize:10, fontWeight:FONTS.bold, color:COLORS.textMute, textTransform:'uppercase', letterSpacing:0.5 },
  trow:      { flexDirection:'row', alignItems:'center', paddingHorizontal:12, paddingVertical:10, borderBottomWidth:1, borderBottomColor:COLORS.border },
  trowEven:  { backgroundColor:'#FAFBFF' },
  invNum:    { fontSize:13, fontWeight:FONTS.bold, color:BRAND },
  invDate:   { fontSize:10, color:COLORS.textMute, marginTop:1 },
  td:        { fontSize:13, color:COLORS.text },
  tdAmt:     { fontSize:13, fontWeight:FONTS.bold, color:COLORS.text, textAlign:'right' },
  custDot:   { width:26, height:26, borderRadius:13, backgroundColor:BRAND+'22', alignItems:'center', justifyContent:'center', flexShrink:0 },
  custDotTxt:{ fontSize:11, fontWeight:FONTS.black, color:BRAND },

  // List card
  listCard:  { backgroundColor:COLORS.card, borderRadius:RADIUS.lg, borderWidth:1, borderColor:COLORS.border, overflow:'hidden', marginBottom:12 },
  rowBorder: { borderBottomWidth:1, borderBottomColor:COLORS.border },

  partyRow:      { flexDirection:'row', alignItems:'center', padding:12 },
  partyAvatar:   { width:36, height:36, borderRadius:18, backgroundColor:COLORS.primaryLight, alignItems:'center', justifyContent:'center', flexShrink:0 },
  partyAvatarTxt:{ fontSize:14, fontWeight:FONTS.black, color:BRAND },
  partyName:     { fontSize:13, fontWeight:FONTS.semibold, color:COLORS.text },
  partySub:      { fontSize:11, color:COLORS.textMute, marginTop:1 },
  partyAmt:      { fontSize:13, fontWeight:FONTS.bold, color:COLORS.text },
  partyLbl:      { fontSize:10, color:COLORS.textMute, marginTop:1 },

  poRow:   { flexDirection:'row', alignItems:'center', padding:12 },
  poIcon:  { width:32, height:32, borderRadius:8, backgroundColor:COLORS.primaryLight, alignItems:'center', justifyContent:'center', flexShrink:0 },
  poNum:   { fontSize:13, fontWeight:FONTS.bold, color:COLORS.text },
  poParty: { fontSize:11, color:COLORS.textMute, marginTop:1 },

  stockRow:  { flexDirection:'row', alignItems:'center', padding:12 },
  stockName: { fontSize:13, fontWeight:FONTS.medium, color:COLORS.text, marginBottom:6 },
  stockBar:  { height:4, backgroundColor:COLORS.border, borderRadius:2, overflow:'hidden' },
  stockFill: { height:4, borderRadius:2 },
  stockQty:  { fontSize:13, fontWeight:FONTS.bold },
  stockMin:  { fontSize:10, color:COLORS.textMute, marginTop:1 },

  pill:    { paddingHorizontal:7, paddingVertical:3, borderRadius:RADIUS.full },
  pillTxt: { fontSize:9, fontWeight:FONTS.black, letterSpacing:0.3 },

  emptyRow:      { padding:28, alignItems:'center', gap:8 },
  emptyTxt:      { fontSize:13, color:COLORS.textMute },
  emptyAction:   { marginTop:4 },
  emptyActionTxt:{ fontSize:13, color:BRAND, fontWeight:FONTS.semibold },

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
  searchResultIcon:  { width:36, height:36, borderRadius:9, alignItems:'center', justifyContent:'center', flexShrink:0 },
  searchResultTitle: { fontSize:13, fontWeight:FONTS.semibold, color:COLORS.text },
  searchResultSub:   { fontSize:11, color:COLORS.textMute, marginTop:1 },
  searchHints:       { padding:20 },
  searchHintsTitle:  { fontSize:15, fontWeight:FONTS.bold, color:COLORS.text, marginBottom:16 },
  searchHintRow:     { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:8 },
  searchHintTxt:     { fontSize:13, color:COLORS.textSub },
});