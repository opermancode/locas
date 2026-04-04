import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Animated, Platform, Dimensions,
  ActivityIndicator, TextInput, Modal, Keyboard, Image, Linking,
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

export default function DashboardScreen({ navigation }) {
  const insets   = useSafeAreaInsets();
  const isWide   = useIsWide();

  const [stats, setStats]               = useState(null);
  const [profile, setProfile]           = useState(null);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [topParties, setTopParties]     = useState([]);
  const [lowStock, setLowStock]         = useState([]);
  const [openPOs, setOpenPOs]           = useState([]);
  const [refreshing, setRefreshing]     = useState(false);
  const [loading, setLoading]           = useState(true);
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [licenseDismissed, setLicenseDismissed] = useState(false);

  // Search
  const [searchQuery, setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching]       = useState(false);
  const [showSearch, setShowSearch]     = useState(false);
  const searchRef  = useRef(null);
  const searchTimer = useRef(null);
  const fadeAnim   = useRef(new Animated.Value(0)).current;

  const load = async () => {
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
      setOpenPOs((pos || []).slice(0, 4));

      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  // Search
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

  const openSearch = () => {
    setShowSearch(true);
    setTimeout(() => searchRef.current?.focus(), 80);
  };
  const closeSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults(null);
    Keyboard.dismiss();
  };
  const goResult = (type, item) => {
    closeSearch();
    if (type === 'invoice')   navigation.navigate('InvoicesTab', { screen: 'InvoiceDetail', params: { invoiceId: item.id } });
    if (type === 'quotation') navigation.navigate('QuotationsTab', { screen: 'QuotationDetail', params: { id: item.id } });
    if (type === 'party')     navigation.navigate('PartiesTab', { screen: 'PartyDetail', params: { partyId: item.id } });
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

  // Pull real values from the correct getDashboardStats shape
  const monthlySales   = stats?.sales?.total        || 0;
  const monthlyCount   = stats?.sales?.count         || 0;
  const collected      = stats?.collected?.total     || 0;
  const receivables    = stats?.receivables?.total   || 0;
  const payables       = stats?.payables?.total      || 0;
  const monthExpenses  = stats?.expenses?.total      || 0;
  const netProfit      = monthlySales - monthExpenses;
  const topCustomers   = stats?.topCustomers         || [];

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }

  const MainContent = (
    <Animated.View style={{ opacity: fadeAnim }}>

      {/* ── Greeting + search ── */}
      <View style={s.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.greetTxt}>{greeting} 👋</Text>
          <Text style={s.bizName} numberOfLines={1}>{profile?.name || 'My Business'}</Text>
        </View>
        <TouchableOpacity style={s.searchTrigger} onPress={openSearch}>
          <Icon name="search" size={18} color={COLORS.textSub} />
        </TouchableOpacity>
        <TouchableOpacity
          style={s.settingsBtn}
          onPress={() => navigation.navigate('More', { screen: 'Settings' })}
        >
          <Icon name="settings" size={18} color={COLORS.textSub} />
        </TouchableOpacity>
      </View>

      {/* ── Banners ── */}
      {licenseStatus?.warning && !licenseDismissed && (
        <View style={s.bannerWarn}>
          <Icon name="alert-triangle" size={14} color="#92400E" />
          <Text style={s.bannerWarnTxt}>License expires in {licenseStatus.daysLeft} days</Text>
          <TouchableOpacity style={s.bannerRenewBtn} onPress={() => Linking.openURL(RENEW_URL)}>
            <Text style={s.bannerRenewTxt}>Renew</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setLicenseDismissed(true)} style={{ padding: 2 }}>
            <Icon name="x" size={14} color="#92400E" />
          </TouchableOpacity>
        </View>
      )}
      {lowStock.length > 0 && (
        <TouchableOpacity style={s.bannerDanger} onPress={() => navigation.navigate('Inventory')}>
          <Icon name="alert-circle" size={14} color="#991B1B" />
          <Text style={s.bannerDangerTxt}>{lowStock.length} item{lowStock.length > 1 ? 's' : ''} running low on stock</Text>
          <Icon name="chevron-right" size={14} color="#991B1B" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
      )}

      {/* ── This month hero card ── */}
      <View style={s.heroCard}>
        <View style={s.heroTop}>
          <View>
            <Text style={s.heroLabel}>This month's sales</Text>
            <Text style={s.heroAmt}>{formatINR(monthlySales)}</Text>
            <Text style={s.heroSub}>{monthlyCount} invoice{monthlyCount !== 1 ? 's' : ''} this month</Text>
          </View>
          <View style={s.heroBadge}>
            <Icon name="trending-up" size={20} color={BRAND} />
          </View>
        </View>

        <View style={s.heroRow}>
          <HeroStat label="Collected"  value={formatINRCompact(collected)}   color="#4ADE80" />
          <View style={s.heroDiv} />
          <HeroStat label="Receivable" value={formatINRCompact(receivables)} color="#FCD34D" />
          <View style={s.heroDiv} />
          <HeroStat label="Expenses"   value={formatINRCompact(monthExpenses)} color="#F87171" />
          <View style={s.heroDiv} />
          <HeroStat label="Net"        value={formatINRCompact(netProfit)}   color={netProfit >= 0 ? '#4ADE80' : '#F87171'} />
        </View>
      </View>

      {/* ── KPI grid — 4 tiles ── */}
      <View style={s.kpiGrid}>
        <TouchableOpacity style={[s.kpiTile, { borderTopColor: '#3B82F6' }]} onPress={() => navigation.navigate('InvoicesTab')}>
          <View style={[s.kpiIcon, { backgroundColor: '#EFF6FF' }]}>
            <Icon name="file-text" size={17} color="#3B82F6" />
          </View>
          <Text style={s.kpiAmt}>{formatINRCompact(receivables)}</Text>
          <Text style={s.kpiLbl}>Outstanding</Text>
          <Text style={s.kpiSub}>Tap to view invoices</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.kpiTile, { borderTopColor: '#8B5CF6' }]} onPress={() => navigation.navigate('PartiesTab')}>
          <View style={[s.kpiIcon, { backgroundColor: '#F5F3FF' }]}>
            <Icon name="users" size={17} color="#8B5CF6" />
          </View>
          <Text style={s.kpiAmt}>{topParties.length}</Text>
          <Text style={s.kpiLbl}>Top Parties</Text>
          <Text style={s.kpiSub}>By outstanding balance</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.kpiTile, { borderTopColor: '#10B981' }]} onPress={() => navigation.navigate('QuotationsTab')}>
          <View style={[s.kpiIcon, { backgroundColor: '#ECFDF5' }]}>
            <Icon name="clipboard" size={17} color="#10B981" />
          </View>
          <Text style={s.kpiAmt}>{openPOs.length}</Text>
          <Text style={s.kpiLbl}>Open POs</Text>
          <Text style={s.kpiSub}>Purchase orders active</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.kpiTile, { borderTopColor: '#F59E0B' }]} onPress={() => navigation.navigate('More', { screen: 'Expenses' })}>
          <View style={[s.kpiIcon, { backgroundColor: '#FFFBEB' }]}>
            <Icon name="credit-card" size={17} color="#F59E0B" />
          </View>
          <Text style={s.kpiAmt}>{formatINRCompact(monthExpenses)}</Text>
          <Text style={s.kpiLbl}>Expenses</Text>
          <Text style={s.kpiSub}>This month</Text>
        </TouchableOpacity>
      </View>

      {/* ── Quick actions ── */}
      <SectionHeader title="Quick Actions" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.qaScroll}>
        {[
          { label: 'New Invoice',  icon: 'file-plus',   color: BRAND,      bg: '#FFF0E6', onPress: () => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' }) },
          { label: 'New Quotation', icon: 'clipboard',  color: '#8B5CF6',  bg: '#F5F3FF', onPress: () => navigation.navigate('QuotationsTab', { screen: 'CreateQuotation' }) },
          { label: 'New PO',       icon: 'package',     color: '#10B981',  bg: '#ECFDF5', onPress: () => navigation.navigate('More', { screen: 'PurchaseOrders' }) },
          { label: 'Add Party',    icon: 'user-plus',   color: '#3B82F6',  bg: '#EFF6FF', onPress: () => navigation.navigate('PartiesTab') },
          { label: 'Add Expense',  icon: 'minus-circle', color: '#EF4444', bg: '#FEF2F2', onPress: () => navigation.navigate('More', { screen: 'Expenses' }) },
          { label: 'Inventory',    icon: 'box',         color: '#6366F1',  bg: '#EEF2FF', onPress: () => navigation.navigate('Inventory') },
          { label: 'Reports',      icon: 'bar-chart-2', color: '#0EA5E9',  bg: '#F0F9FF', onPress: () => navigation.navigate('More', { screen: 'Reports' }) },
          { label: 'Settings',     icon: 'settings',    color: '#64748B',  bg: '#F1F5F9', onPress: () => navigation.navigate('More', { screen: 'Settings' }) },
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

        {/* LEFT: Recent invoices + Top customers */}
        <View style={isWide ? s.wideLeft : null}>

          {/* Recent invoices */}
          <SectionHeader
            title="Recent Invoices"
            action="See all"
            onAction={() => navigation.navigate('InvoicesTab')}
          />
          <View style={s.tableCard}>
            {/* Table header */}
            <View style={s.tHead}>
              <Text style={[s.tHLabel, { flex: 1.4 }]}>Invoice</Text>
              <Text style={[s.tHLabel, { flex: 2 }]}>Customer</Text>
              <Text style={[s.tHLabel, { flex: 1.1, textAlign: 'right' }]}>Amount</Text>
              <Text style={[s.tHLabel, { flex: 0.9, textAlign: 'center' }]}>Status</Text>
            </View>

            {recentInvoices.length === 0 ? (
              <View style={s.emptyRow}>
                <Icon name="file-text" size={22} color={COLORS.textMute} />
                <Text style={s.emptyTxt}>No invoices yet</Text>
                <TouchableOpacity
                  style={s.emptyAction}
                  onPress={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })}
                >
                  <Text style={s.emptyActionTxt}>Create first invoice →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              recentInvoices.map((inv, i) => {
                const isPaid = inv.status === 'paid';
                const isOverdue = !isPaid && inv.due_date && inv.due_date < new Date().toISOString().split('T')[0];
                const statusCfg = isPaid
                  ? { bg: '#D1FAE5', text: '#065F46', label: 'Paid' }
                  : isOverdue
                  ? { bg: '#FECACA', text: '#7F1D1D', label: 'Overdue' }
                  : inv.status === 'partial'
                  ? { bg: '#FEF3C7', text: '#92400E', label: 'Partial' }
                  : { bg: '#FEE2E2', text: '#991B1B', label: 'Unpaid' };

                return (
                  <TouchableOpacity
                    key={inv.id}
                    style={[s.tRow, i % 2 === 0 && s.tRowEven]}
                    onPress={() => navigation.navigate('InvoicesTab', { screen: 'InvoiceDetail', params: { invoiceId: inv.id } })}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1.4 }}>
                      <Text style={s.tInvNum} numberOfLines={1}>{inv.invoice_number}</Text>
                      <Text style={s.tDate}>{formatDate(inv.date)}</Text>
                    </View>
                    <Text style={[s.tCell, { flex: 2 }]} numberOfLines={1}>
                      {inv.party_name || 'Walk-in'}
                    </Text>
                    <Text style={[s.tAmt, { flex: 1.1 }]} numberOfLines={1}>
                      {formatINR(inv.total)}
                    </Text>
                    <View style={{ flex: 0.9, alignItems: 'center' }}>
                      <View style={[s.pill, { backgroundColor: statusCfg.bg }]}>
                        <Text style={[s.pillTxt, { color: statusCfg.text }]}>{statusCfg.label}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Top customers this month */}
          {topCustomers.length > 0 && (
            <>
              <SectionHeader title="Top Customers This Month" />
              <View style={s.tableCard}>
                <View style={s.tHead}>
                  <Text style={[s.tHLabel, { flex: 2 }]}>Customer</Text>
                  <Text style={[s.tHLabel, { flex: 1, textAlign: 'right' }]}>Sales</Text>
                </View>
                {topCustomers.map((c, i) => (
                  <View key={i} style={[s.tRow, i % 2 === 0 && s.tRowEven]}>
                    <View style={[s.customerDot, { backgroundColor: BRAND }]}>
                      <Text style={s.customerDotTxt}>{(c.party_name || '?')[0].toUpperCase()}</Text>
                    </View>
                    <Text style={[s.tCell, { flex: 2, marginLeft: 8 }]} numberOfLines={1}>{c.party_name || 'Unknown'}</Text>
                    <Text style={[s.tAmt, { flex: 1 }]}>{formatINR(c.total)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* RIGHT: Outstanding parties + Open POs + Low stock */}
        <View style={isWide ? s.wideRight : null}>

          {/* Outstanding parties */}
          {topParties.length > 0 && (
            <>
              <SectionHeader
                title="Outstanding Balances"
                action="See all"
                onAction={() => navigation.navigate('PartiesTab')}
              />
              <View style={s.listCard}>
                {topParties.map((p, i) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[s.partyRow, i < topParties.length - 1 && s.rowBorder]}
                    onPress={() => navigation.navigate('PartiesTab', { screen: 'PartyDetail', params: { partyId: p.id } })}
                    activeOpacity={0.75}
                  >
                    <View style={s.partyAvatar}>
                      <Text style={s.partyAvatarTxt}>{(p.name || 'P')[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.partyName} numberOfLines={1}>{p.name}</Text>
                      {p.phone ? <Text style={s.partySub}>{p.phone}</Text> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[s.partyAmt, p.balance > 0 && { color: COLORS.danger }]}>
                        {formatINR(Math.abs(p.balance || 0))}
                      </Text>
                      <Text style={s.partyLbl}>{p.balance > 0 ? 'To receive' : 'To pay'}</Text>
                    </View>
                    <Icon name="chevron-right" size={14} color={COLORS.textMute} style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Open Purchase Orders */}
          {openPOs.length > 0 && (
            <>
              <SectionHeader
                title="Open Purchase Orders"
                action="See all"
                onAction={() => navigation.navigate('More', { screen: 'PurchaseOrders' })}
              />
              <View style={s.listCard}>
                {openPOs.map((po, i) => (
                  <TouchableOpacity
                    key={po.id}
                    style={[s.poRow, i < openPOs.length - 1 && s.rowBorder]}
                    onPress={() => navigation.navigate('More', { screen: 'PODetail', params: { poId: po.id } })}
                    activeOpacity={0.75}
                  >
                    <View style={s.poIcon}>
                      <Icon name="package" size={14} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.poNum} numberOfLines={1}>{po.po_number}</Text>
                      <Text style={s.poParty} numberOfLines={1}>{po.party_name}</Text>
                    </View>
                    <View style={[s.pill, po.status === 'partial'
                      ? { backgroundColor: '#FEF3C7' }
                      : { backgroundColor: '#DBEAFE' }
                    ]}>
                      <Text style={[s.pillTxt, po.status === 'partial'
                        ? { color: '#92400E' }
                        : { color: '#1E40AF' }
                      ]}>
                        {po.status === 'partial' ? 'Partial' : 'Active'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Low Stock */}
          {lowStock.length > 0 && (
            <>
              <SectionHeader
                title="Low Stock Alert"
                action="View all"
                onAction={() => navigation.navigate('Inventory')}
              />
              <View style={s.listCard}>
                {lowStock.map((item, i) => {
                  const pct = item.min_stock > 0 ? Math.min(1, item.stock / item.min_stock) : 0;
                  return (
                    <View key={item.id} style={[s.stockRow, i < lowStock.length - 1 && s.rowBorder]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.stockName} numberOfLines={1}>{item.name}</Text>
                        <View style={s.stockBar}>
                          <View style={[s.stockFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: pct < 0.3 ? COLORS.danger : COLORS.warning }]} />
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

      {/* ── Global Search Modal ── */}
      <Modal visible={showSearch} animationType="fade" transparent onRequestClose={closeSearch}>
        <View style={s.searchOverlay}>
          <View style={[s.searchSheet, { paddingTop: insets.top + 8 }]}>
            {/* Search input */}
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
                  const total = (searchResults.invoices?.length || 0) +
                    (searchResults.quotations?.length || 0) +
                    (searchResults.parties?.length || 0) +
                    (searchResults.products?.length || 0);
                  return total === 0 ? (
                    <View style={s.searchEmpty}>
                      <Icon name="search" size={36} color={COLORS.border} />
                      <Text style={s.searchEmptyTxt}>No results for "{searchQuery}"</Text>
                    </View>
                  ) : (
                    <>
                      {[
                        { key: 'invoices',   type: 'invoice',   label: 'Invoices',   icon: 'file-text', color: '#3B82F6' },
                        { key: 'quotations', type: 'quotation', label: 'Quotations', icon: 'clipboard', color: '#8B5CF6' },
                        { key: 'parties',    type: 'party',     label: 'Parties',    icon: 'users',     color: '#10B981' },
                        { key: 'products',   type: 'product',   label: 'Products',   icon: 'package',   color: '#F59E0B' },
                      ].map(({ key, type, label, icon, color }) =>
                        searchResults[key]?.length > 0 ? (
                          <View key={key} style={s.searchSection}>
                            <Text style={s.searchSectionTitle}>{label} ({searchResults[key].length})</Text>
                            {searchResults[key].map(item => {
                              const title = item.invoice_number || item.quote_number || item.name;
                              const sub = type === 'invoice'   ? `${item.party_name || 'Walk-in'} · ${formatINR(item.total)}`
                                        : type === 'quotation' ? `${item.party_name || 'No party'} · ${formatINR(item.total)}`
                                        : type === 'party'     ? `${item.phone || ''} · Bal: ${formatINR(Math.abs(item.balance || 0))}`
                                        : `₹${item.price} · Stock: ${item.stock || 0}`;
                              return (
                                <TouchableOpacity
                                  key={`${type}-${item.id}`}
                                  style={s.searchResultRow}
                                  onPress={() => goResult(type, item)}
                                >
                                  <View style={[s.searchResultIcon, { backgroundColor: color + '18' }]}>
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
                    { icon: 'file-text', color: '#3B82F6', text: 'Invoice numbers — INV-0001' },
                    { icon: 'clipboard', color: '#8B5CF6', text: 'Quotation numbers — QUO-0001' },
                    { icon: 'users',     color: '#10B981', text: 'Party names or phone numbers' },
                    { icon: 'package',   color: '#F59E0B', text: 'Product names or HSN codes' },
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

// ── Sub-components ──────────────────────────────────────────────
function SectionHeader({ title, action, onAction }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={s.sectionAction}>{action} →</Text>
        </TouchableOpacity>
      )}
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

// ── Styles ──────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:    { padding: 16 },
  scrollWide:{ padding: 24 },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 14, borderRadius: RADIUS.lg,
    marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  greetTxt: { fontSize: 12, color: COLORS.textMute, marginBottom: 1 },
  bizName:  { fontSize: 17, fontWeight: FONTS.black, color: COLORS.text, maxWidth: 220 },
  searchTrigger: { width: 38, height: 38, borderRadius: 10, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  settingsBtn:   { width: 38, height: 38, borderRadius: 10, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },

  // Banners
  bannerWarn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF3C7', borderRadius: RADIUS.md,
    padding: 11, marginBottom: 10,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  bannerWarnTxt:  { flex: 1, fontSize: 12, fontWeight: FONTS.medium, color: '#92400E' },
  bannerRenewBtn: { backgroundColor: '#F59E0B', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  bannerRenewTxt: { fontSize: 11, fontWeight: FONTS.bold, color: '#fff' },
  bannerDanger: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: RADIUS.md,
    padding: 11, marginBottom: 10,
    borderWidth: 1, borderColor: '#FECACA',
  },
  bannerDangerTxt: { flex: 1, fontSize: 12, fontWeight: FONTS.medium, color: '#991B1B' },

  // Hero card
  heroCard: {
    backgroundColor: '#0F172A', borderRadius: RADIUS.xl,
    padding: 20, marginBottom: 14,
  },
  heroTop:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  heroLabel:{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  heroAmt:  { fontSize: 30, fontWeight: FONTS.black, color: '#fff', marginBottom: 2 },
  heroSub:  { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  heroBadge:{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,107,0,0.15)', alignItems: 'center', justifyContent: 'center' },
  heroRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: RADIUS.md, padding: 12 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatVal: { fontSize: 13, fontWeight: FONTS.bold, marginBottom: 2 },
  heroStatLbl: { fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.4 },
  heroDiv:  { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.08)' },

  // KPI grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  kpiTile: {
    flex: 1, minWidth: '45%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
    borderTopWidth: 3,
  },
  kpiIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  kpiAmt:  { fontSize: 18, fontWeight: FONTS.black, color: COLORS.text, marginBottom: 2 },
  kpiLbl:  { fontSize: 12, fontWeight: FONTS.semibold, color: COLORS.text, marginBottom: 1 },
  kpiSub:  { fontSize: 10, color: COLORS.textMute },

  // Quick actions
  qaScroll: { paddingBottom: 4, gap: 10, marginBottom: 14 },
  qaItem:   { alignItems: 'center', width: 72 },
  qaIcon:   { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  qaLabel:  { fontSize: 10, color: COLORS.textSub, textAlign: 'center', fontWeight: FONTS.medium, lineHeight: 13 },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 6 },
  sectionTitle:  { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text },
  sectionAction: { fontSize: 12, color: BRAND, fontWeight: FONTS.semibold },

  // Wide layout
  wideColumns: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  wideLeft:    { flex: 1.5 },
  wideRight:   { flex: 1 },

  // Table card
  tableCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden', marginBottom: 14,
  },
  tHead: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tHLabel: { fontSize: 10, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.5 },
  tRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tRowEven:{ backgroundColor: '#FAFBFF' },
  tInvNum: { fontSize: 13, fontWeight: FONTS.bold, color: BRAND },
  tDate:   { fontSize: 10, color: COLORS.textMute, marginTop: 1 },
  tCell:   { fontSize: 13, color: COLORS.text },
  tAmt:    { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.text, textAlign: 'right' },
  customerDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  customerDotTxt: { fontSize: 11, fontWeight: FONTS.black, color: '#fff' },

  // List card
  listCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden', marginBottom: 14,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },

  // Party rows
  partyRow:      { flexDirection: 'row', alignItems: 'center', padding: 12 },
  partyAvatar:   { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  partyAvatarTxt:{ fontSize: 14, fontWeight: FONTS.black, color: BRAND },
  partyName:     { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.text },
  partySub:      { fontSize: 11, color: COLORS.textMute, marginTop: 1 },
  partyAmt:      { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.text },
  partyLbl:      { fontSize: 10, color: COLORS.textMute, marginTop: 1 },

  // PO rows
  poRow:   { flexDirection: 'row', alignItems: 'center', padding: 12 },
  poIcon:  { width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  poNum:   { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.text },
  poParty: { fontSize: 11, color: COLORS.textMute, marginTop: 1 },

  // Stock rows
  stockRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  stockName:{ fontSize: 13, fontWeight: FONTS.medium, color: COLORS.text, marginBottom: 6 },
  stockBar: { height: 4, backgroundColor: COLORS.border, borderRadius: 2, overflow: 'hidden' },
  stockFill:{ height: 4, borderRadius: 2 },
  stockQty: { fontSize: 13, fontWeight: FONTS.bold },
  stockMin: { fontSize: 10, color: COLORS.textMute, marginTop: 1 },

  // Pills
  pill:    { paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.full },
  pillTxt: { fontSize: 9, fontWeight: FONTS.black, letterSpacing: 0.3 },

  // Empty
  emptyRow:    { padding: 28, alignItems: 'center', gap: 8 },
  emptyTxt:    { fontSize: 13, color: COLORS.textMute },
  emptyAction: { marginTop: 4 },
  emptyActionTxt: { fontSize: 13, color: BRAND, fontWeight: FONTS.semibold },

  // Search modal
  searchOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  searchSheet:   { flex: 1, backgroundColor: COLORS.bg },
  searchHeader:  {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingBottom: 10,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  searchInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.bg, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput:     { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 0 },
  searchCancel:    { paddingLeft: 4, paddingVertical: 8 },
  searchCancelTxt: { fontSize: 14, fontWeight: FONTS.semibold, color: BRAND },
  searchLoading:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10 },
  searchLoadingTxt:{ fontSize: 14, color: COLORS.textSub },
  searchEmpty:     { alignItems: 'center', paddingVertical: 48, gap: 10 },
  searchEmptyTxt:  { fontSize: 14, color: COLORS.textMute },
  searchSection:   { padding: 14 },
  searchSectionTitle: { fontSize: 10, fontWeight: FONTS.bold, color: COLORS.textMute, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 },
  searchResultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    padding: 11, marginBottom: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchResultIcon:  { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  searchResultTitle: { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.text },
  searchResultSub:   { fontSize: 11, color: COLORS.textMute, marginTop: 1 },
  searchHints:     { padding: 20 },
  searchHintsTitle:{ fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 16 },
  searchHintRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  searchHintTxt:   { fontSize: 13, color: COLORS.textSub },
});