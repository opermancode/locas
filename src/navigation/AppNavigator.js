import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, Dimensions, ScrollView, Image,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { COLORS, RADIUS, FONTS, SHADOW } from '../theme';

import DashboardScreen   from '../screens/Dashboard/DashboardScreen';
import InvoiceListScreen from '../screens/Invoice/InvoiceListScreen';
import CreateInvoice     from '../screens/Invoice/CreateInvoice';
import InvoiceDetail     from '../screens/Invoice/InvoiceDetail';
import PartiesScreen     from '../screens/Parties/PartiesScreen';
import PartyDetail       from '../screens/Parties/PartyDetail';
import InventoryScreen   from '../screens/Inventory/InventoryScreen';
import ExpensesScreen    from '../screens/Expenses/ExpensesScreen';
import ReportsScreen     from '../screens/Reports/ReportsScreen';
import SettingsScreen    from '../screens/Settings/SettingsScreen';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// ── Stacks ────────────────────────────────────────────────────────
function InvoiceStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="InvoiceList"   component={InvoiceListScreen} />
      <Stack.Screen name="CreateInvoice" component={CreateInvoice} />
      <Stack.Screen name="InvoiceDetail" component={InvoiceDetail} />
    </Stack.Navigator>
  );
}
function PartiesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PartiesList" component={PartiesScreen} />
      <Stack.Screen name="PartyDetail" component={PartyDetail} />
    </Stack.Navigator>
  );
}
function MoreStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Expenses" component={ExpensesScreen} />
      <Stack.Screen name="Reports"  component={ReportsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}

// ── Wide screen hook ──────────────────────────────────────────────
function useIsWide() {
  const [wide, setWide] = useState(() =>
    Platform.OS === 'web' && Dimensions.get('window').width >= 768
  );
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setWide(window.width >= 768);
    });
    return () => sub?.remove();
  }, []);
  return wide;
}

// ── Inline SVG icons — work in Electron without font loading ──────
const SVG = {
  home:           'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z||M9 22V12h6v10',
  'file-text':    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z||M14 2v6h6||M16 13H8||M16 17H8||M10 9H8',
  users:          'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2||M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z||M23 21v-2a4 4 0 0 0-3-3.87||M16 3.13a4 4 0 0 1 0 7.75',
  package:        'M21 10V6a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 1 6v12a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 23 18v-4||M3.27 6.96L12 12.01l8.73-5.05||M12 22.08V12',
  'credit-card':  'M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z||M1 10h22',
  'bar-chart-2':  'M18 20V10||M12 20V4||M6 20v-6',
  settings:       'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z||M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  plus:           'M12 5v14||M5 12h14',
  grid:           'M3 3h7v7H3z||M14 3h7v7h-7z||M14 14h7v7h-7z||M3 14h7v7H3z',
  'chevron-left': 'M15 18l-6-6 6-6',
  'chevron-right':'M9 18l6-6-6-6',
};

function SvgIcon({ name, size = 16, color = '#fff', strokeWidth = 1.5 }) {
  const paths = (SVG[name] || '').split('||').filter(Boolean);
  if (!paths.length) return null;
  return React.createElement('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: color,
    strokeWidth: String(strokeWidth),
    strokeLinecap: 'round', strokeLinejoin: 'round',
    style: { display: 'block', flexShrink: 0 },
  }, ...paths.map((d, i) => React.createElement('path', { key: i, d })));
}

function NavIcon({ name, size, color, strokeWidth }) {
  if (Platform.OS === 'web') return <SvgIcon name={name} size={size} color={color} strokeWidth={strokeWidth} />;
  return <Feather name={name} size={size} color={color} />;
}

// ── Nav config ────────────────────────────────────────────────────
const MOBILE_TABS = [
  { name: 'Dashboard',   label: 'Home',     icon: 'home',      idx: 0 },
  { name: 'InvoicesTab', label: 'Invoices', icon: 'file-text', idx: 1 },
  { name: 'PartiesTab',  label: 'Parties',  icon: 'users',     idx: 2 },
  { name: 'Inventory',   label: 'Items',    icon: 'package',   idx: 3 },
  { name: 'More',        label: 'More',     icon: 'grid',      idx: 4 },
];

const SIDEBAR_ITEMS = [
  { name: 'Dashboard',   label: 'Home',     icon: 'home',        tab: 'Dashboard',   screen: null       },
  { name: 'InvoicesTab', label: 'Invoices', icon: 'file-text',   tab: 'InvoicesTab', screen: null       },
  { name: 'PartiesTab',  label: 'Parties',  icon: 'users',       tab: 'PartiesTab',  screen: null       },
  { name: 'Inventory',   label: 'Items',    icon: 'package',     tab: 'Inventory',   screen: null       },
  { name: 'Expenses',    label: 'Expenses', icon: 'credit-card', tab: 'More',        screen: 'Expenses' },
  { name: 'Reports',     label: 'Reports',  icon: 'bar-chart-2', tab: 'More',        screen: 'Reports'  },
  { name: 'Settings',    label: 'Settings', icon: 'settings',    tab: 'More',        screen: 'Settings' },
];

// ── Mobile bottom tab bar ─────────────────────────────────────────
function MobileTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.mobileBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>
      <View style={styles.mobileRow}>
        {MOBILE_TABS.map(tab => {
          const focused = state.index === tab.idx;
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabItem}
              onPress={() => navigation.navigate(tab.name)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconPill, focused && styles.iconPillActive]}>
                <Feather name={tab.icon} size={18} color={focused ? COLORS.primary : COLORS.textMute} />
              </View>
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Desktop full layout (sidebar + screen side by side) ───────────
function DesktopLayout({ state, navigation, descriptors }) {
  const [collapsed, setCollapsed] = useState(false);
  const activeTabName = MOBILE_TABS[state.index]?.name;

  const isActive = (item) =>
    item.screen ? activeTabName === 'More' : activeTabName === item.tab;

  const go = (item) => {
    if (item.screen) navigation.navigate(item.tab, { screen: item.screen });
    else navigation.navigate(item.tab);
  };

  const activeRoute     = state.routes[state.index];
  const activeDescriptor = descriptors[activeRoute.key];

  return (
    <View style={styles.desktopRoot}>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>

        {/* Logo — icon.png is landscape, show it wide at top */}
        <View style={styles.logoArea}>
          {collapsed ? (
            // Collapsed: just show a square crop / initial
            <View style={styles.logoIconOnly}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logoIconImg}
                resizeMode="cover"
              />
            </View>
          ) : (
            // Expanded: wide logo image
            <Image
              source={require('../../assets/icon.png')}
              style={styles.logoFull}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity onPress={() => setCollapsed(v => !v)} style={styles.collapseBtn}>
            <NavIcon
              name={collapsed ? 'chevron-right' : 'chevron-left'}
              size={13} color="rgba(255,255,255,0.35)" strokeWidth={2}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* New Invoice CTA */}
        <View style={styles.ctaWrap}>
          <TouchableOpacity
            style={[styles.newBtn, collapsed && styles.newBtnCollapsed]}
            onPress={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })}
            activeOpacity={0.85}
          >
            <NavIcon name="plus" size={14} color="#fff" strokeWidth={2.5} />
            {!collapsed && <Text style={styles.newBtnText}>New Invoice</Text>}
          </TouchableOpacity>
        </View>

        {/* Nav items */}
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 6 }}>
          {SIDEBAR_ITEMS.map(item => {
            const active = isActive(item);
            return (
              <TouchableOpacity
                key={item.name}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => go(item)}
                activeOpacity={0.75}
              >
                {active && <View style={styles.activeBar} />}
                <View style={styles.navIconWrap}>
                  <NavIcon
                    name={item.icon} size={16}
                    color={active ? '#fff' : 'rgba(255,255,255,0.4)'}
                    strokeWidth={active ? 2 : 1.5}
                  />
                </View>
                {!collapsed && (
                  <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                    {item.label}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Main content ─────────────────────────────────────────── */}
      <View style={styles.content}>
        {activeDescriptor.render()}
      </View>

    </View>
  );
}

// ── Smart tab bar ─────────────────────────────────────────────────
function SmartTabBar(props) {
  const isWide = useIsWide();
  return isWide ? <DesktopLayout {...props} /> : <MobileTabBar {...props} />;
}

// ── Root ──────────────────────────────────────────────────────────
export default function AppNavigator() {
  return (
    <Tab.Navigator
      tabBar={props => <SmartTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard"   component={DashboardScreen} />
      <Tab.Screen name="InvoicesTab" component={InvoiceStack} />
      <Tab.Screen name="PartiesTab"  component={PartiesStack} />
      <Tab.Screen name="Inventory"   component={InventoryScreen} />
      <Tab.Screen name="More"        component={MoreStack} />
    </Tab.Navigator>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // Desktop root — sidebar left, content right
  desktopRoot: { flex: 1, flexDirection: 'row', backgroundColor: COLORS.bg },
  content:     { flex: 1, backgroundColor: COLORS.bg },

  // Sidebar
  sidebar: {
    width: 200,
    backgroundColor: '#111827',   // Very dark — matches Datadog
    flexDirection: 'column',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
  },
  sidebarCollapsed: { width: 56 },

  // Logo area
  logoArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 8,
  },
  logoFull: {
    flex: 1,
    height: 28,
  },
  logoIconOnly: {
    width: 28, height: 28,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: COLORS.primary,
  },
  logoIconImg: {
    // Show left portion of the landscape logo (the "L" in Locas)
    width: 70, height: 28,
    marginLeft: -2,
  },
  collapseBtn: {
    width: 20, height: 20,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 12,
  },

  // New Invoice button
  ctaWrap: { paddingHorizontal: 10, paddingTop: 12, paddingBottom: 4 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: COLORS.primary,
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 6,
  },
  newBtnCollapsed: { justifyContent: 'center', paddingHorizontal: 0 },
  newBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 12 },

  // Nav items — Datadog style: tight, icon left, label right
  navItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 12,
    marginHorizontal: 6, marginVertical: 1,
    borderRadius: 6, gap: 10,
    position: 'relative', overflow: 'hidden',
  },
  navItemActive: { backgroundColor: 'rgba(255,255,255,0.08)' },
  activeBar: {
    position: 'absolute', left: 0, top: 5, bottom: 5,
    width: 3, borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
  navIconWrap: {
    width: 20, height: 20,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  navLabel: {
    flex: 1, fontSize: 13, fontWeight: FONTS.medium,
    color: 'rgba(255,255,255,0.4)',
  },
  navLabelActive: {
    color: '#fff',
    fontWeight: FONTS.semibold,
  },

  // Mobile bottom bar
  mobileBar: {
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOW.md,
  },
  fab: {
    position: 'absolute',
    top: -24, alignSelf: 'center',
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 99,
    ...SHADOW.brand,
    borderWidth: 3, borderColor: COLORS.card,
  },
  mobileRow:     { flexDirection: 'row', paddingTop: 10, paddingHorizontal: 4 },
  tabItem:       { flex: 1, alignItems: 'center', gap: 3, paddingBottom: 2 },
  iconPill:      { width: 42, height: 28, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  iconPillActive:{ backgroundColor: COLORS.primaryLight },
  tabLabel:      { fontSize: 10, fontWeight: FONTS.medium, color: COLORS.textMute },
  tabLabelActive:{ color: COLORS.primary, fontWeight: FONTS.bold },
});
