import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Image, Linking, Animated, Platform, Dimensions,
  ActivityIndicator, TextInput, Modal, Keyboard,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from '../../utils/Icon';
import * as DB from '../../db';
import { formatINRCompact, formatINR } from '../../utils/gst';
import { checkForUpdate, performUpdate } from '../../utils/updateChecker';
import { getLicenseStatus } from '../../utils/licenseSystem';

// URLs (update these)
const RENEW_URL = 'https://your-website.com/renew';

const { width } = Dimensions.get('window');
const isDesktop = Platform.OS === 'web' && width > 900;
const cardWidth = (width - 48) / 2;

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState(null);
  const [profile, setProfile] = useState(null);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [topParties, setTopParties] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const searchInputRef = useRef(null);
  const searchTimeout = useRef(null);

  // Banners
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [licenseDismissed, setLicenseDismissed] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ═══════════════════════════════════════════════════════════════════════════
  // LOAD DATA
  // ═══════════════════════════════════════════════════════════════════════════

  const load = async () => {
    try {
      // Load all data with safe fallbacks
      const [data, prof, license] = await Promise.all([
        DB.getDashboardStats?.() || Promise.resolve({}),
        DB.getProfile?.() || Promise.resolve(null),
        getLicenseStatus?.() || Promise.resolve(null),
      ]);

      setStats(data || {});
      setProfile(prof);
      setLicenseStatus(license);

      // Load optional data
      try {
        if (DB.getRecentInvoices) {
          const invoices = await DB.getRecentInvoices(5);
          setRecentInvoices(invoices || []);
        }
      } catch (_) {}

      try {
        if (DB.getTopParties) {
          const parties = await DB.getTopParties(5);
          setTopParties(parties || []);
        }
      } catch (_) {}

      try {
        if (DB.getLowStockProducts) {
          const stock = await DB.getLowStockProducts(5);
          setLowStock(stock || []);
        }
      } catch (_) {}

      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  // Check for updates
  useEffect(() => {
    (async () => {
      try {
        const result = await checkForUpdate?.();
        if (result?.hasUpdate) setUpdateInfo(result);
      } catch (_) {}
    })();
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH
  // ═══════════════════════════════════════════════════════════════════════════

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (!query.trim()) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        if (DB.globalSearch) {
          const results = await DB.globalSearch(query.trim());
          setSearchResults(results);
        } else {
          setSearchResults({ invoices: [], quotations: [], parties: [], products: [] });
        }
      } catch (e) {
        console.error('Search error:', e);
        setSearchResults({ invoices: [], quotations: [], parties: [], products: [] });
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const openSearchModal = () => {
    setShowSearchModal(true);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const closeSearchModal = () => {
    setShowSearchModal(false);
    setSearchQuery('');
    setSearchResults(null);
    Keyboard.dismiss();
  };

  const handleResultPress = (type, item) => {
    closeSearchModal();
    switch (type) {
      case 'invoice':
        navigation.navigate('InvoicesTab', { screen: 'InvoiceDetail', params: { invoiceId: item.id } });
        break;
      case 'quotation':
        navigation.navigate('QuotationsTab', { screen: 'QuotationDetail', params: { id: item.id } });
        break;
      case 'party':
        navigation.navigate('PartiesTab', { screen: 'PartyDetail', params: { partyId: item.id } });
        break;
      case 'product':
        navigation.navigate('Inventory');
        break;
    }
  };

  const getTotalResults = () => {
    if (!searchResults) return 0;
    return (searchResults.invoices?.length || 0) + (searchResults.quotations?.length || 0) +
           (searchResults.parties?.length || 0) + (searchResults.products?.length || 0);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleUpdate = async () => {
    setUpdateLoading(true);
    await performUpdate?.(updateInfo);
    setUpdateLoading(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const salesGrowth = stats?.lastMonthSales > 0
    ? Math.round(((stats?.monthSales - stats?.lastMonthSales) / stats?.lastMonthSales) * 100)
    : 0;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH RESULT ITEM
  // ═══════════════════════════════════════════════════════════════════════════

  const SearchResultItem = ({ type, item }) => {
    const config = {
      invoice: { icon: 'file-text', color: '#3B82F6', label: 'INVOICE', title: item.invoice_number, subtitle: `${item.party_name || 'Cash Sale'} • ${formatINR(item.total)}` },
      quotation: { icon: 'clipboard', color: '#8B5CF6', label: 'QUOTE', title: item.quote_number, subtitle: `${item.party_name || 'No Party'} • ${formatINR(item.total)}` },
      party: { icon: 'user', color: '#10B981', label: 'PARTY', title: item.name, subtitle: `${item.phone || 'No phone'} • Balance: ${formatINR(Math.abs(item.balance || 0))}` },
      product: { icon: 'package', color: '#F59E0B', label: 'PRODUCT', title: item.name, subtitle: `₹${item.price} • Stock: ${item.stock || 0}` },
    }[type];

    return (
      <TouchableOpacity style={styles.searchResultItem} onPress={() => handleResultPress(type, item)}>
        <View style={[styles.searchResultIcon, { backgroundColor: `${config.color}15` }]}>
          <Icon name={config.icon} size={18} color={config.color} />
        </View>
        <View style={styles.searchResultContent}>
          <View style={styles.searchResultHeader}>
            <Text style={styles.searchResultTitle} numberOfLines={1}>{config.title}</Text>
            <View style={[styles.searchResultLabel, { backgroundColor: `${config.color}15` }]}>
              <Text style={[styles.searchResultLabelText, { color: config.color }]}>{config.label}</Text>
            </View>
          </View>
          <Text style={styles.searchResultSubtitle} numberOfLines={1}>{config.subtitle}</Text>
        </View>
        <Icon name="chevron-right" size={18} color="#D1D5DB" />
      </TouchableOpacity>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#FF6B00" />
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <View style={[styles.container, { paddingTop: isDesktop ? 0 : insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      {!isDesktop && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoWrap}>
              <Image source={require('../../../assets/icon.png')} style={styles.logoImg} resizeMode="contain" />
            </View>
            <View>
              <Text style={styles.greeting}>{greeting}</Text>
              <Text style={styles.bizName} numberOfLines={1}>{profile?.name || 'LOCAS'}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('More', { screen: 'Settings' })}>
              <Icon name="settings" size={20} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B00" />}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* Search Bar */}
          <TouchableOpacity style={styles.searchBar} onPress={openSearchModal} activeOpacity={0.8}>
            <Icon name="search" size={18} color="#9CA3AF" />
            <Text style={styles.searchPlaceholder}>Search invoices, parties, products...</Text>
          </TouchableOpacity>

          {/* License Banner */}
          {licenseStatus?.warning && !licenseDismissed && (
            <View style={styles.licenseBanner}>
              <View style={styles.bannerLeft}>
                <Icon name="alert-triangle" size={16} color="#F59E0B" />
                <Text style={styles.licenseText}>License expires in {licenseStatus.daysLeft} days</Text>
              </View>
              <View style={styles.bannerActions}>
                <TouchableOpacity style={styles.licenseRenewBtn} onPress={() => Linking.openURL(RENEW_URL)}>
                  <Text style={styles.licenseRenewText}>Renew</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setLicenseDismissed(true)}>
                  <Icon name="x" size={16} color="#92400E" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Update Banner */}
          {updateInfo?.hasUpdate && (
            <View style={styles.updateBanner}>
              <View style={styles.bannerLeft}>
                <Icon name="download-cloud" size={16} color="#fff" />
                <Text style={styles.updateText}>Update v{updateInfo.latestVersion} available</Text>
              </View>
              <TouchableOpacity style={styles.updateBtn} onPress={handleUpdate} disabled={updateLoading}>
                {updateLoading ? <ActivityIndicator size="small" color="#FF6B00" /> : <Text style={styles.updateBtnText}>Update</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* Low Stock Alert */}
          {lowStock.length > 0 && (
            <TouchableOpacity style={styles.alertBanner} onPress={() => navigation.navigate('More', { screen: 'Products' })}>
              <View style={styles.bannerLeft}>
                <Icon name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.alertText}>{lowStock.length} products low on stock</Text>
              </View>
              <Icon name="chevron-right" size={16} color="#DC2626" />
            </TouchableOpacity>
          )}

          {/* Revenue Card */}
          <View style={styles.revenueCard}>
            <View style={styles.revenueHeader}>
              <Text style={styles.revenueLabel}>This Month's Revenue</Text>
              {salesGrowth !== 0 && (
                <View style={[styles.growthBadge, salesGrowth < 0 && styles.growthBadgeNeg]}>
                  <Icon name={salesGrowth >= 0 ? 'trending-up' : 'trending-down'} size={12} color={salesGrowth >= 0 ? '#10B981' : '#EF4444'} />
                  <Text style={[styles.growthText, salesGrowth < 0 && styles.growthTextNeg]}>{salesGrowth >= 0 ? '+' : ''}{salesGrowth}%</Text>
                </View>
              )}
            </View>
            <Text style={styles.revenueValue}>{formatINR(stats?.monthSales || 0)}</Text>
            <View style={styles.revenueStats}>
              <View style={styles.revenueStat}>
                <Text style={styles.revenueStatLabel}>Collected</Text>
                <Text style={[styles.revenueStatValue, { color: '#10B981' }]}>{formatINR(stats?.monthCollected || 0)}</Text>
              </View>
              <View style={styles.revenueStatDivider} />
              <View style={styles.revenueStat}>
                <Text style={styles.revenueStatLabel}>Pending</Text>
                <Text style={[styles.revenueStatValue, { color: '#F59E0B' }]}>{formatINR(stats?.monthPending || 0)}</Text>
              </View>
              <View style={styles.revenueStatDivider} />
              <View style={styles.revenueStat}>
                <Text style={styles.revenueStatLabel}>Invoices</Text>
                <Text style={styles.revenueStatValue}>{stats?.monthInvoices || 0}</Text>
              </View>
            </View>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <TouchableOpacity style={[styles.statCard, { backgroundColor: '#EFF6FF' }]} onPress={() => navigation.navigate('InvoicesTab')}>
              <View style={[styles.statIcon, { backgroundColor: '#3B82F6' }]}><Icon name="file-text" size={18} color="#fff" /></View>
              <Text style={styles.statValue}>{stats?.todayInvoices || 0}</Text>
              <Text style={styles.statLabel}>Today's Invoices</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.statCard, { backgroundColor: '#ECFDF5' }]} onPress={() => navigation.navigate('More', { screen: 'Reports' })}>
              <View style={[styles.statIcon, { backgroundColor: '#10B981' }]}><Icon name="trending-up" size={18} color="#fff" /></View>
              <Text style={styles.statValue}>{formatINRCompact(stats?.todaySales || 0)}</Text>
              <Text style={styles.statLabel}>Today's Sales</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.statCard, { backgroundColor: '#FFFBEB' }]} onPress={() => navigation.navigate('PartiesTab')}>
              <View style={[styles.statIcon, { backgroundColor: '#F59E0B' }]}><Icon name="clock" size={18} color="#fff" /></View>
              <Text style={styles.statValue}>{formatINRCompact(stats?.totalPending || 0)}</Text>
              <Text style={styles.statLabel}>Total Pending</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.statCard, { backgroundColor: '#F5F3FF' }]} onPress={() => navigation.navigate('PartiesTab')}>
              <View style={[styles.statIcon, { backgroundColor: '#8B5CF6' }]}><Icon name="users" size={18} color="#fff" /></View>
              <Text style={styles.statValue}>{stats?.totalParties || 0}</Text>
              <Text style={styles.statLabel}>Total Parties</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActionsScroll}>
            {[
              { label: 'New Invoice', icon: 'plus', color: '#FF6B00', onPress: () => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' }) },
              { label: 'Quotation', icon: 'clipboard', color: '#8B5CF6', onPress: () => navigation.navigate('QuotationsTab', { screen: 'CreateQuotation' }) },
              { label: 'Add Party', icon: 'user-plus', color: '#10B981', onPress: () => navigation.navigate('PartiesTab') },
              { label: 'Products', icon: 'package', color: '#3B82F6', onPress: () => navigation.navigate('Inventory') },
              { label: 'Expenses', icon: 'credit-card', color: '#06B6D4', onPress: () => navigation.navigate('More', { screen: 'Expenses' }) },
              { label: 'Reports', icon: 'bar-chart-2', color: '#F59E0B', onPress: () => navigation.navigate('More', { screen: 'Reports' }) },
            ].map((action, i) => (
              <TouchableOpacity key={i} style={styles.quickAction} onPress={action.onPress}>
                <View style={[styles.quickActionIcon, { backgroundColor: action.color }]}>
                  <Icon name={action.icon} size={22} color="#fff" />
                </View>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Recent Invoices */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Invoices</Text>
            <TouchableOpacity onPress={() => navigation.navigate('InvoicesTab')}>
              <Text style={styles.seeAllBtn}>See All</Text>
            </TouchableOpacity>
          </View>
          {recentInvoices.length > 0 ? (
            <View style={styles.listCard}>
              {recentInvoices.map((inv, idx) => (
                <TouchableOpacity
                  key={inv.id}
                  style={[styles.invoiceRow, idx < recentInvoices.length - 1 && styles.rowBorder]}
                  onPress={() => navigation.navigate('InvoicesTab', { screen: 'InvoiceDetail', params: { invoiceId: inv.id } })}
                >
                  <View style={styles.invoiceLeft}>
                    <Text style={styles.invoiceNumber}>{inv.invoice_number}</Text>
                    <Text style={styles.invoiceParty} numberOfLines={1}>{inv.party_name || 'Cash Sale'}</Text>
                  </View>
                  <View style={styles.invoiceRight}>
                    <Text style={styles.invoiceAmount}>{formatINR(inv.total)}</Text>
                    <View style={styles.invoiceMeta}>
                      <Text style={styles.invoiceDate}>{formatDate(inv.date)}</Text>
                      <View style={[styles.statusDot, inv.status === 'paid' && { backgroundColor: '#10B981' }, inv.status === 'partial' && { backgroundColor: '#F59E0B' }, inv.status === 'unpaid' && { backgroundColor: '#EF4444' }]} />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Icon name="file-text" size={32} color="#D1D5DB" />
              <Text style={styles.emptyText}>No invoices yet</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })}>
                <Text style={styles.emptyBtnText}>Create First Invoice</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Top Parties */}
          {topParties.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Top Outstanding</Text>
                <TouchableOpacity onPress={() => navigation.navigate('PartiesTab')}>
                  <Text style={styles.seeAllBtn}>See All</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.listCard}>
                {topParties.map((party, idx) => (
                  <TouchableOpacity
                    key={party.id}
                    style={[styles.partyRow, idx < topParties.length - 1 && styles.rowBorder]}
                    onPress={() => navigation.navigate('PartiesTab', { screen: 'PartyDetail', params: { partyId: party.id } })}
                  >
                    <View style={styles.partyAvatar}>
                      <Text style={styles.partyInitial}>{(party.name || 'P')[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.partyInfo}>
                      <Text style={styles.partyName} numberOfLines={1}>{party.name}</Text>
                      <Text style={styles.partyPhone}>{party.phone || 'No phone'}</Text>
                    </View>
                    <View style={styles.partyBalance}>
                      <Text style={[styles.partyAmount, party.balance > 0 && { color: '#EF4444' }]}>{formatINR(Math.abs(party.balance || 0))}</Text>
                      <Text style={styles.partyBalanceLabel}>{party.balance > 0 ? 'To Receive' : party.balance < 0 ? 'To Pay' : 'Settled'}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Business Summary */}
          <Text style={styles.sectionTitle}>Business Summary</Text>
          <View style={styles.summaryGrid}>
            {[
              { icon: 'trending-up', color: '#10B981', value: formatINRCompact(stats?.totalSales || 0), label: 'All Time Sales' },
              { icon: 'file-text', color: '#3B82F6', value: stats?.totalInvoices || 0, label: 'Total Invoices' },
              { icon: 'package', color: '#8B5CF6', value: stats?.totalProducts || 0, label: 'Products' },
              { icon: 'calendar', color: '#F59E0B', value: stats?.avgInvoiceValue ? formatINRCompact(stats.avgInvoiceValue) : '₹0', label: 'Avg Invoice' },
            ].map((item, i) => (
              <View key={i} style={[styles.summaryItem, i === 3 && { borderBottomWidth: 0 }]}>
                <Icon name={item.icon} size={20} color={item.color} />
                <View style={styles.summaryItemContent}>
                  <Text style={styles.summaryItemValue}>{item.value}</Text>
                  <Text style={styles.summaryItemLabel}>{item.label}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ height: 100 }} />
        </Animated.View>
      </ScrollView>

      {/* Search Modal */}
      <Modal visible={showSearchModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeSearchModal}>
        <View style={[styles.searchModal, { paddingTop: insets.top }]}>
          <View style={styles.searchModalHeader}>
            <View style={styles.searchInputContainer}>
              <Icon name="search" size={18} color="#9CA3AF" />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Search invoices, parties, products..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={handleSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => handleSearch('')}>
                  <Icon name="x-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.searchCancelBtn} onPress={closeSearchModal}>
              <Text style={styles.searchCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.searchResults} keyboardShouldPersistTaps="handled">
            {searching ? (
              <View style={styles.searchLoading}>
                <ActivityIndicator size="small" color="#FF6B00" />
                <Text style={styles.searchLoadingText}>Searching...</Text>
              </View>
            ) : searchResults ? (
              getTotalResults() > 0 ? (
                <>
                  {searchResults.invoices?.length > 0 && (
                    <View style={styles.searchSection}>
                      <Text style={styles.searchSectionTitle}>Invoices ({searchResults.invoices.length})</Text>
                      {searchResults.invoices.map(item => <SearchResultItem key={`inv-${item.id}`} type="invoice" item={item} />)}
                    </View>
                  )}
                  {searchResults.quotations?.length > 0 && (
                    <View style={styles.searchSection}>
                      <Text style={styles.searchSectionTitle}>Quotations ({searchResults.quotations.length})</Text>
                      {searchResults.quotations.map(item => <SearchResultItem key={`quo-${item.id}`} type="quotation" item={item} />)}
                    </View>
                  )}
                  {searchResults.parties?.length > 0 && (
                    <View style={styles.searchSection}>
                      <Text style={styles.searchSectionTitle}>Parties ({searchResults.parties.length})</Text>
                      {searchResults.parties.map(item => <SearchResultItem key={`par-${item.id}`} type="party" item={item} />)}
                    </View>
                  )}
                  {searchResults.products?.length > 0 && (
                    <View style={styles.searchSection}>
                      <Text style={styles.searchSectionTitle}>Products ({searchResults.products.length})</Text>
                      {searchResults.products.map(item => <SearchResultItem key={`pro-${item.id}`} type="product" item={item} />)}
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.noResults}>
                  <Icon name="search" size={48} color="#E5E7EB" />
                  <Text style={styles.noResultsText}>No results found</Text>
                  <Text style={styles.noResultsHint}>Try different keywords</Text>
                </View>
              )
            ) : (
              <View style={styles.searchHints}>
                <Text style={styles.searchHintsTitle}>Search for</Text>
                {[
                  { icon: 'file-text', color: '#3B82F6', text: 'Invoice numbers (INV-0001)' },
                  { icon: 'clipboard', color: '#8B5CF6', text: 'Quotation numbers (QUO-0001)' },
                  { icon: 'user', color: '#10B981', text: 'Party names or phone numbers' },
                  { icon: 'package', color: '#F59E0B', text: 'Product names or SKU' },
                ].map((hint, i) => (
                  <View key={i} style={styles.searchHintItem}>
                    <Icon name={hint.icon} size={16} color={hint.color} />
                    <Text style={styles.searchHintText}>{hint.text}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#1F2937', paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  logoImg: { width: 28, height: 28 },
  greeting: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  bizName: { fontSize: 17, fontWeight: '700', color: '#fff', maxWidth: 180 },
  headerBtn: { padding: 8 },
  scroll: { padding: 16 },

  // Search Bar
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16, gap: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  searchPlaceholder: { fontSize: 14, color: '#9CA3AF', flex: 1 },

  // Banners
  licenseBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FEF3C7', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FCD34D' },
  updateBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FF6B00', padding: 12, borderRadius: 12, marginBottom: 12 },
  alertBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FEF2F2', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  bannerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  licenseText: { fontSize: 13, fontWeight: '500', color: '#92400E' },
  updateText: { fontSize: 13, fontWeight: '500', color: '#fff' },
  alertText: { fontSize: 13, fontWeight: '500', color: '#DC2626' },
  licenseRenewBtn: { backgroundColor: '#F59E0B', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  licenseRenewText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  updateBtn: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  updateBtnText: { fontSize: 12, fontWeight: '700', color: '#FF6B00' },

  // Revenue Card
  revenueCard: { backgroundColor: '#1F2937', borderRadius: 16, padding: 20, marginBottom: 16 },
  revenueHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  revenueLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  growthBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  growthBadgeNeg: { backgroundColor: 'rgba(239,68,68,0.15)' },
  growthText: { fontSize: 12, fontWeight: '600', color: '#10B981' },
  growthTextNeg: { color: '#EF4444' },
  revenueValue: { fontSize: 32, fontWeight: '800', color: '#fff', marginBottom: 16 },
  revenueStats: { flexDirection: 'row', alignItems: 'center' },
  revenueStat: { flex: 1, alignItems: 'center' },
  revenueStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
  revenueStatValue: { fontSize: 14, fontWeight: '700', color: '#fff' },
  revenueStatDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)' },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  statCard: { width: cardWidth, padding: 14, borderRadius: 14 },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 20, fontWeight: '800', color: '#1F2937', marginBottom: 2 },
  statLabel: { fontSize: 11, color: '#6B7280' },

  // Sections
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  seeAllBtn: { fontSize: 13, fontWeight: '600', color: '#FF6B00' },

  // Quick Actions
  quickActionsScroll: { marginBottom: 20, marginHorizontal: -16, paddingHorizontal: 16 },
  quickAction: { alignItems: 'center', marginRight: 16, width: 70 },
  quickActionIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickActionLabel: { fontSize: 11, color: '#6B7280', textAlign: 'center' },

  // List
  listCard: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 20 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  invoiceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  invoiceLeft: { flex: 1 },
  invoiceNumber: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  invoiceParty: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  invoiceRight: { alignItems: 'flex-end' },
  invoiceAmount: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  invoiceMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  invoiceDate: { fontSize: 11, color: '#9CA3AF' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D1D5DB' },

  // Party
  partyRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  partyAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  partyInitial: { fontSize: 16, fontWeight: '700', color: '#6B7280' },
  partyInfo: { flex: 1 },
  partyName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  partyPhone: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  partyBalance: { alignItems: 'flex-end' },
  partyAmount: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  partyBalanceLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },

  // Empty
  emptyCard: { backgroundColor: '#fff', borderRadius: 14, padding: 32, alignItems: 'center', marginBottom: 20 },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginTop: 12, marginBottom: 16 },
  emptyBtn: { backgroundColor: '#FF6B00', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  emptyBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  // Summary
  summaryGrid: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden' },
  summaryItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12 },
  summaryItemContent: { flex: 1 },
  summaryItemValue: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  summaryItemLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  // Search Modal
  searchModal: { flex: 1, backgroundColor: '#F9FAFB' },
  searchModalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', gap: 12 },
  searchInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#1F2937' },
  searchCancelBtn: { paddingVertical: 8, paddingLeft: 4 },
  searchCancelText: { fontSize: 15, fontWeight: '500', color: '#FF6B00' },
  searchResults: { flex: 1, padding: 16 },
  searchLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 8 },
  searchLoadingText: { fontSize: 14, color: '#6B7280' },
  searchSection: { marginBottom: 20 },
  searchSectionTitle: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, gap: 12 },
  searchResultIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  searchResultContent: { flex: 1 },
  searchResultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  searchResultTitle: { fontSize: 14, fontWeight: '600', color: '#1F2937', flex: 1 },
  searchResultLabel: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  searchResultLabelText: { fontSize: 9, fontWeight: '700' },
  searchResultSubtitle: { fontSize: 12, color: '#6B7280' },
  noResults: { alignItems: 'center', paddingVertical: 48 },
  noResultsText: { fontSize: 16, fontWeight: '600', color: '#6B7280', marginTop: 16 },
  noResultsHint: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
  searchHints: { paddingVertical: 16 },
  searchHintsTitle: { fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 16 },
  searchHintItem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  searchHintText: { fontSize: 14, color: '#6B7280' },
});