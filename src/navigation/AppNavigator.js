import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, Dimensions, Image, ScrollView,
} from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

// ─── Detect if we're on a wide screen (web/desktop) ──────────────
// Uses Dimensions so it responds to window resize on web
function useIsWide() {
  const [wide, setWide] = useState(
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

// ─── NAV ITEMS ────────────────────────────────────────────────────
const NAV_ITEMS = [
  { name: 'Dashboard',   label: 'Home',     icon: 'home',       idx: 0 },
  { name: 'InvoicesTab', label: 'Invoices', icon: 'file-text',  idx: 1 },
  { name: 'PartiesTab',  label: 'Parties',  icon: 'users',      idx: 2 },
  { name: 'Inventory',   label: 'Items',    icon: 'package',    idx: 3 },
  { name: 'More',        label: 'More',     icon: 'menu',       idx: 4 },
];

// Full nav items for sidebar (More expands into its children)
const SIDEBAR_ITEMS = [
  { name: 'Dashboard',   label: 'Home',       icon: 'home'       },
  { name: 'InvoicesTab', label: 'Invoices',   icon: 'file-text'  },
  { name: 'PartiesTab',  label: 'Parties',    icon: 'users'      },
  { name: 'Inventory',   label: 'Items',      icon: 'package'    },
  { name: 'Expenses',    label: 'Expenses',   icon: 'credit-card', stack: 'More' },
  { name: 'Reports',     label: 'Reports',    icon: 'bar-chart-2', stack: 'More' },
  { name: 'Settings',    label: 'Settings',   icon: 'settings',    stack: 'More' },
];

// ─── Stacks ───────────────────────────────────────────────────────
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

// ─── MOBILE: bottom tab bar ───────────────────────────────────────
function MobileTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      <View style={styles.bottomRow}>
        {NAV_ITEMS.map(tab => {
          const focused = state.index === tab.idx;
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabItem}
              onPress={() => navigation.navigate(tab.name)}
              activeOpacity={0.7}
            >
              <View style={[styles.tabPill, focused && styles.tabPillActive]}>
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

// ─── DESKTOP/WEB: left sidebar ────────────────────────────────────
function DesktopLayout({ state, navigation, descriptors }) {
  const [collapsed, setCollapsed] = useState(false);
  const activeTab = NAV_ITEMS[state.index]?.name;

  return (
    <View style={styles.desktopRoot}>
      {/* Sidebar */}
      <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>
        {/* Logo / brand */}
        <View style={styles.sidebarHeader}>
          <View style={styles.sidebarLogo}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.sidebarLogoImg}
              resizeMode="contain"
            />
          </View>
          {!collapsed && (
            <View style={{ flex: 1 }}>
              <Text style={styles.sidebarBrand}>LOCAS</Text>
              <Text style={styles.sidebarTagline}>Smart Billing</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => setCollapsed(c => !c)} style={styles.collapseBtn}>
            <Feather name={collapsed ? 'chevron-right' : 'chevron-left'} size={16} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>

        {/* New Invoice button */}
        <TouchableOpacity
          style={[styles.sidebarNewBtn, collapsed && styles.sidebarNewBtnCollapsed]}
          onPress={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={16} color="#fff" />
          {!collapsed && <Text style={styles.sidebarNewBtnText}>New Invoice</Text>}
        </TouchableOpacity>

        <View style={styles.sidebarDivider} />

        {/* Nav items */}
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {SIDEBAR_ITEMS.map(item => {
            const isActive = item.stack
              ? activeTab === 'More'
              : activeTab === item.name;

            return (
              <TouchableOpacity
                key={item.name}
                style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
                onPress={() => {
                  if (item.stack) {
                    navigation.navigate(item.stack, { screen: item.name });
                  } else {
                    navigation.navigate(item.name);
                  }
                }}
                activeOpacity={0.75}
              >
                <View style={[styles.sidebarIcon, isActive && styles.sidebarIconActive]}>
                  <Feather
                    name={item.icon}
                    size={16}
                    color={isActive ? COLORS.primary : 'rgba(255,255,255,0.5)'}
                  />
                </View>
                {!collapsed && (
                  <Text style={[styles.sidebarLabel, isActive && styles.sidebarLabelActive]}>
                    {item.label}
                  </Text>
                )}
                {isActive && !collapsed && <View style={styles.activeIndicator} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Bottom of sidebar */}
        <View style={styles.sidebarFooter}>
          <View style={styles.sidebarDivider} />
          <TouchableOpacity
            style={styles.sidebarItem}
            onPress={() => navigation.navigate('More', { screen: 'Settings' })}
            activeOpacity={0.75}
          >
            <View style={styles.sidebarIcon}>
              <Feather name="settings" size={16} color="rgba(255,255,255,0.5)" />
            </View>
            {!collapsed && <Text style={styles.sidebarLabel}>Settings</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main content */}
      <View style={styles.desktopContent}>
        {descriptors[state.routes[state.index].key].render()}
      </View>
    </View>
  );
}

// ─── Root navigator ───────────────────────────────────────────────
export default function AppNavigator() {
  const isWide = useIsWide();

  if (isWide) {
    // Desktop/Web: render sidebar layout
    return (
      <Tab.Navigator
        tabBar={props => <DesktopLayout {...props} />}
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

  // Mobile: render bottom tabs
  return (
    <Tab.Navigator
      tabBar={props => <MobileTabBar {...props} />}
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

// ─── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // ── Mobile bottom bar ──────────────────────────────────────────
  bottomBar: {
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOW.md,
  },
  fab: {
    position: 'absolute',
    top: -24,
    alignSelf: 'center',
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 99,
    ...SHADOW.brand,
    borderWidth: 3, borderColor: COLORS.card,
  },
  bottomRow:     { flexDirection: 'row', paddingTop: 10, paddingHorizontal: 4 },
  tabItem:       { flex: 1, alignItems: 'center', gap: 3, paddingBottom: 2 },
  tabPill:       { width: 42, height: 28, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  tabPillActive: { backgroundColor: COLORS.primaryLight },
  tabLabel:      { fontSize: 10, fontWeight: FONTS.medium, color: COLORS.textMute },
  tabLabelActive:{ color: COLORS.primary, fontWeight: FONTS.bold },

  // ── Desktop sidebar layout ──────────────────────────────────────
  desktopRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
  },

  sidebar: {
    width: 220,
    backgroundColor: COLORS.secondary,
    flexDirection: 'column',
    ...SHADOW.lg,
    // Ensure sidebar sits above content
    zIndex: 10,
  },
  sidebarCollapsed: {
    width: 64,
  },

  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 18,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  sidebarLogo: {
    width: 32, height: 32, borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  sidebarLogoImg: { width: 24, height: 24 },
  sidebarBrand:   { fontSize: 13, fontWeight: FONTS.black, color: '#fff', letterSpacing: 3 },
  sidebarTagline: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 },
  collapseBtn: {
    width: 24, height: 24, borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexShrink: 0,
  },

  sidebarNewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginTop: 14, marginBottom: 4,
    backgroundColor: COLORS.primary,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    ...SHADOW.brand,
  },
  sidebarNewBtnCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    marginHorizontal: 10,
  },
  sidebarNewBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },

  sidebarDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 8,
    marginHorizontal: 12,
  },

  sidebarItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, paddingHorizontal: 12,
    marginHorizontal: 8, marginVertical: 1,
    borderRadius: RADIUS.md,
    position: 'relative',
  },
  sidebarItemActive: {
    backgroundColor: 'rgba(255,107,0,0.12)',
  },
  sidebarIcon: {
    width: 32, height: 32, borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  sidebarIconActive: {
    backgroundColor: 'rgba(255,107,0,0.15)',
  },
  sidebarLabel: {
    flex: 1, fontSize: 13, fontWeight: FONTS.medium,
    color: 'rgba(255,255,255,0.55)',
  },
  sidebarLabelActive: {
    color: COLORS.primary,
    fontWeight: FONTS.semibold,
  },
  activeIndicator: {
    width: 3, height: 16, borderRadius: 2,
    backgroundColor: COLORS.primary,
    position: 'absolute', right: 4,
  },

  sidebarFooter: {
    paddingBottom: 12,
  },

  // Main content area
  desktopContent: {
    flex: 1,
    overflow: 'hidden',
  },
});