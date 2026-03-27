import React, { useState, useCallback } from 'react';
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

const W_EXPANDED  = 210;
const W_COLLAPSED = 56;

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

// ── Inline SVG icons ──────────────────────────────────────────────
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

// ── Inject global CSS once ────────────────────────────────────────
function injectCSS() {
  if (Platform.OS !== 'web') return;
  let el = document.getElementById('locas-layout');
  if (!el) {
    el = document.createElement('style');
    el.id = 'locas-layout';
    document.head.appendChild(el);
  }
  el.textContent = `
    html, body, #root { height: 100% !important; margin: 0 !important; overflow: hidden !important; }
    #locas-sidebar { transition: width 0.2s ease; }
    #locas-scene {
      left: ${W_COLLAPSED}px !important;
      transition: left 0.2s ease !important;
    }
  `;
}

function setSidebarWidth(w) {
  if (Platform.OS !== 'web') return;
  const sidebar = document.getElementById('locas-sidebar');
  if (sidebar) sidebar.style.width = w + 'px';
  const scene = document.getElementById('locas-scene');
  if (scene) {
    scene.style.setProperty('left', w + 'px', 'important');
    scene.style.transition = 'left 0.2s ease';
  }
}

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

// ── Desktop sidebar — hover to expand, CSS drives everything ───────
function DesktopSidebar({ state, navigation }) {
  const [pinned, setPinned]   = useState(false); // user clicked to pin open
  const [hovered, setHovered] = useState(false);

  const expanded = pinned || hovered;
  const w = expanded ? W_EXPANDED : W_COLLAPSED;

  const activeTabName = MOBILE_TABS[state.index]?.name;
  const isActive = (item) => item.screen ? activeTabName === 'More' : activeTabName === item.tab;
  const go = (item) => {
    if (item.screen) navigation.navigate(item.tab, { screen: item.screen });
    else navigation.navigate(item.tab);
  };

  // Update CSS whenever width changes
  

  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    setSidebarWidth(w);
  }, [w]);

  const sidebarWebStyle = {
    position: 'fixed',
    top: 0, left: 0, bottom: 0,
    width: W_COLLAPSED, // start collapsed, CSS transition handles rest
    backgroundColor: '#111827',
    zIndex: 1000,
    borderRight: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'width 0.2s ease',
  };

  return (
    <div
      id="locas-sidebar"
      style={sidebarWebStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Logo area */}
      <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8, minHeight: 56, overflow: 'hidden' }}>
        {/* Orange box with text logo */}
        <div style={{
          minWidth: 32, height: 32, borderRadius: 6, flexShrink: 0,
          backgroundColor: '#FF6B00', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: expanded ? '0 10px' : '0',
          transition: 'padding 0.2s ease, min-width 0.2s ease',
        }}>
          <span style={{
            color: '#fff', fontWeight: 800, fontSize: expanded ? 16 : 18,
            letterSpacing: expanded ? 0.5 : 0,
            whiteSpace: 'nowrap',
          }}>
            {expanded ? 'Locas.' : 'L'}
          </span>
        </div>
        {/* Pin button */}
        {expanded && (
          <div
            onClick={() => setPinned(v => !v)}
            style={{ cursor: 'pointer', opacity: 0.4, flexShrink: 0, marginLeft: 'auto' }}
            title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
          >
            <SvgIcon name={pinned ? 'chevron-left' : 'chevron-right'} size={14} color="#fff" strokeWidth={2} />
          </div>
        )}
      </div>

      {/* New Invoice button */}
      <div style={{ padding: '12px 10px 6px' }}>
        <div
          onClick={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            backgroundColor: '#FF6B00', borderRadius: 6,
            padding: expanded ? '8px 12px' : '8px 0',
            cursor: 'pointer', justifyContent: expanded ? 'flex-start' : 'center',
            transition: 'padding 0.2s ease',
          }}
        >
          <SvgIcon name="plus" size={15} color="#fff" strokeWidth={2.5} />
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', opacity: expanded ? 1 : 0, transition: 'opacity 0.15s', overflow: 'hidden' }}>
            New Invoice
          </span>
        </div>
      </div>

      <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', margin: '4px 12px' }} />

      {/* Nav items */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingTop: 4, paddingBottom: 4 }}>
        {SIDEBAR_ITEMS.map(item => {
          const active = isActive(item);
          return (
            <div
              key={item.name}
              onClick={() => go(item)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', margin: '1px 6px',
                borderRadius: 6, cursor: 'pointer', position: 'relative',
                backgroundColor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                transition: 'background-color 0.15s',
                overflow: 'hidden',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {/* Active left bar */}
              {active && (
                <div style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, borderRadius: 2, backgroundColor: '#FF6B00' }} />
              )}
              {/* Icon */}
              <div style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <SvgIcon name={item.icon} size={16} color={active ? '#fff' : 'rgba(255,255,255,0.4)'} strokeWidth={active ? 2 : 1.5} />
              </div>
              {/* Label */}
              <span style={{
                fontSize: 13, fontWeight: active ? 600 : 400,
                color: active ? '#fff' : 'rgba(255,255,255,0.45)',
                whiteSpace: 'nowrap', overflow: 'hidden',
                opacity: expanded ? 1 : 0,
                transition: 'opacity 0.15s ease',
              }}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Smart tab bar ─────────────────────────────────────────────────
function SmartTabBar(props) {
  const isWide = useIsWide();
  return isWide ? <DesktopSidebar {...props} /> : <MobileTabBar {...props} />;
}

// ── Root ──────────────────────────────────────────────────────────
export default function AppNavigator() {
  const isWide = Platform.OS === 'web' && Dimensions.get('window').width >= 768;

  React.useEffect(() => {
    if (!isWide || Platform.OS !== 'web') return;
    injectCSS();
    // After a brief delay, find and tag the scene container
    setTimeout(() => {
      // The scene container is a fixed div that isn't the sidebar
      const allFixed = Array.from(document.querySelectorAll('*')).filter(el => {
        const s = window.getComputedStyle(el);
        return s.position === 'fixed' && el.id !== 'locas-sidebar';
      });
      // Find the one that covers most of the screen (scene container)
      const scene = allFixed.find(el => {
        const r = el.getBoundingClientRect();
        return r.width > 400 && r.height > 400;
      });
      if (scene) {
        scene.id = 'locas-scene';
        // Force correct left immediately (overrides sceneContainerStyle inline)
        scene.style.setProperty('left', W_COLLAPSED + 'px', 'important');
        scene.style.transition = 'left 0.2s ease';
      }
    }, 300);
  }, []);

  return (
    <Tab.Navigator
      tabBar={props => <SmartTabBar {...props} />}
      screenOptions={{ headerShown: false }}
      sceneContainerStyle={isWide ? {
        position: 'fixed',
        top: 0, right: 0, bottom: 0,
        left: W_COLLAPSED,
        overflow: 'hidden',
      } : {}}
    >
      <Tab.Screen name="Dashboard"   component={DashboardScreen} />
      <Tab.Screen name="InvoicesTab" component={InvoiceStack} />
      <Tab.Screen name="PartiesTab"  component={PartiesStack} />
      <Tab.Screen name="Inventory"   component={InventoryScreen} />
      <Tab.Screen name="More"        component={MoreStack} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  mobileBar: {
    backgroundColor: COLORS.card,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    ...SHADOW.md,
  },
  fab: {
    position: 'absolute', top: -24, alignSelf: 'center',
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 99, ...SHADOW.brand,
    borderWidth: 3, borderColor: COLORS.card,
  },
  mobileRow:     { flexDirection: 'row', paddingTop: 10, paddingHorizontal: 4 },
  tabItem:       { flex: 1, alignItems: 'center', gap: 3, paddingBottom: 2 },
  iconPill:      { width: 42, height: 28, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  iconPillActive:{ backgroundColor: COLORS.primaryLight },
  tabLabel:      { fontSize: 10, fontWeight: FONTS.medium, color: COLORS.textMute },
  tabLabelActive:{ color: COLORS.primary, fontWeight: FONTS.bold },
});