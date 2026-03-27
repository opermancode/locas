import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, Dimensions, Image, ScrollView,
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

// ── Tab config ────────────────────────────────────────────────────
const TABS = [
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

// ── Detect wide screen INSIDE a component (safe — not at module level) ──
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

// ── Mobile: bottom tab bar ────────────────────────────────────────
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
        {TABS.map(tab => {
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

// ── Desktop: sidebar — rendered as the tabBar prop ────────────────
// IMPORTANT: the Tab.Navigator still manages all screens normally.
// The sidebar just replaces the visual tab bar — it doesn't change
// how React Navigation renders screens. This keeps it stable.
function DesktopSidebar({ state, navigation }) {
  const [collapsed, setCollapsed] = useState(false);
  const activeTabName = TABS[state.index]?.name;

  const isActive = (item) => {
    if (item.screen) return activeTabName === 'More';
    return activeTabName === item.tab;
  };

  const go = (item) => {
    if (item.screen) {
      navigation.navigate(item.tab, { screen: item.screen });
    } else {
      navigation.navigate(item.tab);
    }
  };

  return (
    <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>

      {/* Brand */}
      <View style={styles.sidebarHeader}>
        <View style={styles.logoBox}>
          <Text style={styles.logoLetter}>L</Text>
        </View>
        {!collapsed && (
          <View style={{ flex: 1 }}>
            <Text style={styles.brandName}>LOCAS</Text>
            <Text style={styles.brandSub}>Smart Billing</Text>
          </View>
        )}
        <TouchableOpacity onPress={() => setCollapsed(v => !v)} style={styles.collapseBtn}>
          <Feather
            name={collapsed ? 'chevron-right' : 'chevron-left'}
            size={14}
            color="rgba(255,255,255,0.4)"
          />
        </TouchableOpacity>
      </View>

      {/* New Invoice */}
      <View style={{ paddingHorizontal: 12, paddingTop: 14, paddingBottom: 6 }}>
        <TouchableOpacity
          style={[styles.newBtn, collapsed && styles.newBtnCollapsed]}
          onPress={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={15} color="#fff" />
          {!collapsed && <Text style={styles.newBtnText}>New Invoice</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {/* Nav */}
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
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
              <View style={[styles.navIcon, active && styles.navIconActive]}>
                <Feather
                  name={item.icon}
                  size={16}
                  color={active ? COLORS.primary : 'rgba(255,255,255,0.5)'}
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

      {/* Footer */}
      {!collapsed && (
        <View style={styles.sidebarFooter}>
          <Text style={styles.footerText}>Locas Billing</Text>
        </View>
      )}
    </View>
  );
}

// ── Smart tab bar: sidebar on desktop, bottom bar on mobile ───────
function SmartTabBar(props) {
  const isWide = useIsWide();
  if (isWide) {
    return <DesktopSidebar {...props} />;
  }
  return <MobileTabBar {...props} />;
}

// ── Root navigator ────────────────────────────────────────────────
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

  // Sidebar
  sidebar: {
    width: 220,
    backgroundColor: COLORS.secondary,
    flexDirection: 'column',
    flex: 1,
  },
  sidebarCollapsed: {
    width: 64,
  },

  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 20, paddingBottom: 16,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  logoBox: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  logoLetter: { fontSize: 18, fontWeight: FONTS.black, color: '#fff', lineHeight: 22 },
  brandName:  { fontSize: 14, fontWeight: FONTS.black, color: '#fff', letterSpacing: 3 },
  brandSub:   { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 },
  collapseBtn: {
    width: 22, height: 22, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexShrink: 0,
  },

  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    ...SHADOW.brand,
  },
  newBtnCollapsed: { justifyContent: 'center', paddingHorizontal: 0 },
  newBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 14, marginVertical: 4,
  },

  navItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 14,
    marginHorizontal: 8, marginVertical: 1,
    borderRadius: RADIUS.md, gap: 10,
    position: 'relative', overflow: 'hidden',
  },
  navItemActive: { backgroundColor: 'rgba(255,107,0,0.1)' },
  activeBar: {
    position: 'absolute', left: 0, top: 6, bottom: 6,
    width: 3, borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
  navIcon: {
    width: 30, height: 30, borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  navIconActive:  { backgroundColor: 'rgba(255,107,0,0.15)' },
  navLabel:       { flex: 1, fontSize: 13, fontWeight: FONTS.medium, color: 'rgba(255,255,255,0.45)' },
  navLabelActive: { color: COLORS.primary, fontWeight: FONTS.semibold },

  sidebarFooter: {
    paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  footerText: { fontSize: 10, color: 'rgba(255,255,255,0.2)', fontWeight: FONTS.medium },
});