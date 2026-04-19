import React, { useState, useCallback } from 'react';
  import {
    View, Text, TouchableOpacity, StyleSheet,
    Platform, Dimensions,
  } from 'react-native';
  import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
  import { createStackNavigator } from '@react-navigation/stack';
  import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  import QuotationListScreen   from '../screens/Quotation/QuotationListScreen';
  import CreateQuotation       from '../screens/Quotation/CreateQuotation';
  import QuotationDetailScreen from '../screens/Quotation/QuotationDetailScreen';
  import POListScreen     from '../screens/PurchaseOrder/POListScreen';
  import CreatePOScreen   from '../screens/PurchaseOrder/CreatePOScreen';
  import PODetailScreen   from '../screens/PurchaseOrder/PODetailScreen';
  import POAlertsScreen   from '../screens/PurchaseOrder/POAlertsScreen';
  import HelpSupportScreen from '../screens/Support/HelpSupportScreen';

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
  function QuotationStack() {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="QuotationList"   component={QuotationListScreen} />
        <Stack.Screen name="CreateQuotation" component={CreateQuotation} />
        <Stack.Screen name="QuotationDetail" component={QuotationDetailScreen} />
      </Stack.Navigator>
    );
  }
  function POStack() {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="POList"     component={POListScreen} />
        <Stack.Screen name="CreatePO"   component={CreatePOScreen} />
        <Stack.Screen name="PODetail"   component={PODetailScreen} />
        <Stack.Screen name="POAlerts"   component={POAlertsScreen} />
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
        <Stack.Screen name="Expenses"        component={ExpensesScreen} />
        <Stack.Screen name="Reports"         component={ReportsScreen} />
        <Stack.Screen name="Settings"        component={SettingsScreen} />
        <Stack.Screen name="PurchaseOrders"  component={POListScreen} />
        <Stack.Screen name="CreatePO"        component={CreatePOScreen} />
        <Stack.Screen name="PODetail"        component={PODetailScreen} />
        <Stack.Screen name="POAlerts"        component={POAlertsScreen} />
        <Stack.Screen name="HelpSupport"     component={HelpSupportScreen} />
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

  const SVG = {
    home:            'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z||M9 22V12h6v10',
    'file-text':     'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z||M14 2v6h6||M16 13H8||M16 17H8||M10 9H8',
    clipboard:       'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2||M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z||M12 11h4||M12 16h4||M8 11h.01||M8 16h.01',
    users:           'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2||M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z||M23 21v-2a4 4 0 0 0-3-3.87||M16 3.13a4 4 0 0 1 0 7.75',
    package:         'M16.5 9.4l-9-5.19||M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z||M3.27 6.96L12 12.01l8.73-5.05||M12 22.08V12',
    'credit-card':   'M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z||M1 10h22',
    'bar-chart-2':   'M18 20V10||M12 20V4||M6 20v-6',
    settings:        'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z||M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
    plus:            'M12 5v14||M5 12h14',
    grid:            'M3 3h7v7H3z||M14 3h7v7h-7z||M14 14h7v7h-7z||M3 14h7v7H3z',
    'chevron-left':  'M15 18l-6-6 6-6',
    'chevron-right': 'M9 18l6-6-6-6',
    'shopping-bag':  'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z||M3 6h18||M16 10a4 4 0 0 1-8 0',
    'help-circle':   'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z||M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3||M12 17h.01',
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
    if (Platform.OS === 'web') {
      return <SvgIcon name={name} size={size} color={color} strokeWidth={strokeWidth} />;
    }
    const { Feather } = require('@expo/vector-icons');
    return <Feather name={name} size={size} color={color} />;
  }

  const MOBILE_TABS = [
    { name: 'Dashboard',     label: 'Home',     icon: 'home',      idx: 0 },
    { name: 'InvoicesTab',   label: 'Invoices', icon: 'file-text', idx: 1 },
    { name: 'QuotationsTab', label: 'Quotes',   icon: 'clipboard', idx: 2 },
    { name: 'PartiesTab',    label: 'Parties',  icon: 'users',     idx: 3 },
    { name: 'More',          label: 'More',     icon: 'grid',      idx: 4 },
  ];

  const SIDEBAR_ITEMS = [
    { name: 'Dashboard',     label: 'Home',       icon: 'home',        tab: 'Dashboard',     screen: null       },
    { name: 'InvoicesTab',   label: 'Invoices',   icon: 'file-text',   tab: 'InvoicesTab',   screen: null       },
    { name: 'PartiesTab',    label: 'Parties',    icon: 'users',       tab: 'PartiesTab',    screen: null       },
    { name: 'Inventory',     label: 'Items',      icon: 'package',     tab: 'Inventory',     screen: null       },
    { name: 'Expenses',      label: 'Expenses',   icon: 'credit-card', tab: 'More',          screen: 'Expenses' },
    { name: 'Reports',       label: 'Reports',    icon: 'bar-chart-2', tab: 'More',          screen: 'Reports'  },
    { name: 'PurchaseOrders',label: 'PO Orders',  icon: 'shopping-bag',tab: 'More',          screen: 'PurchaseOrders' },
    { name: 'QuotationsTab', label: 'Quotations', icon: 'clipboard',   tab: 'QuotationsTab', screen: null       },
    { name: 'Settings',      label: 'Settings',   icon: 'settings',    tab: 'More',          screen: 'Settings' },
  ];

  const SIDEBAR_FOOTER = { name: 'HelpSupport', label: 'Help & Support', icon: 'help-circle', tab: 'More', screen: 'HelpSupport' };

  // Quick-action flyout menus shown on hover when sidebar is collapsed
  const SIDEBAR_FLYOUTS = {
    InvoicesTab: [
      { label: 'New Invoice',   icon: 'plus',     tab: 'InvoicesTab',   screen: 'CreateInvoice',   primary: true },
    ],
    PartiesTab: [
      { label: 'Create Party',  icon: 'plus',     tab: 'PartiesTab',    screen: 'PartiesList',     primary: true, params: { openAdd: true } },
    ],
    Inventory: [
      { label: 'Create Item',   icon: 'plus',     tab: 'Inventory',     screen: null,              primary: true, params: { openAdd: true } },
    ],
    PurchaseOrders: [
      { label: 'New PO',        icon: 'plus',           tab: 'More',    screen: 'CreatePO',        primary: true },
      { label: 'PO Alerts',     icon: 'alert-triangle', tab: 'More',    screen: 'POAlerts'         },
    ],
    QuotationsTab: [
      { label: 'New Quotation', icon: 'plus',     tab: 'QuotationsTab', screen: 'CreateQuotation', primary: true },
    ],
  };

  function MobileTabBar({ state, navigation }) {
    const insets = useSafeAreaInsets();
    return (
      <View style={[styles.mobileBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })}
          activeOpacity={0.85}
        >
          <NavIcon name="plus" size={24} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={styles.mobileRow}>
          {MOBILE_TABS.map(tab => {
            const focused = state.index === tab.idx;
            return (
              <TouchableOpacity
                key={tab.name}
                style={styles.tabItem}
                onPress={() => {
                  const screenMap = {
                    InvoicesTab:   'InvoiceList',
                    QuotationsTab: 'QuotationList',
                    PartiesTab:    'PartiesList',
                  };
                  const initial = screenMap[tab.name];
                  if (initial) navigation.navigate(tab.name, { screen: initial });
                  else navigation.navigate(tab.name);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.iconPill, focused && styles.iconPillActive]}>
                  <NavIcon name={tab.icon} size={18} color={focused ? COLORS.primary : COLORS.textMute} />
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

  function DesktopSidebar({ state, navigation, onWidthChange }) {
    const [pinned,      setPinned]      = useState(false);
    const [hovered,     setHovered]     = useState(false);
    const [flyoutItem,  setFlyoutItem]  = useState(null); // item.name with open flyout
    const [flyoutY,     setFlyoutY]     = useState(0);    // top position of flyout

    const expanded = pinned || hovered;
    const w = expanded ? W_EXPANDED : W_COLLAPSED;

    const activeTabName = MOBILE_TABS[state.index]?.name;
    const moreRoute = state.routes?.find(r => r.name === 'More');
    const activeMoreScreen = moreRoute?.state?.routes?.[moreRoute.state.index ?? 0]?.name ?? null;

    const isActive = (item) => {
      if (item.screen) return activeTabName === 'More' && activeMoreScreen === item.screen;
      return activeTabName === item.tab;
    };

    const go = (item) => {
      setFlyoutItem(null);
      if (item.tab === 'Inventory') {
        // Inventory is a tab screen (not a stack), params go directly
        navigation.navigate('Inventory', item.params);
      } else if (item.screen) {
        navigation.navigate(item.tab, { screen: item.screen, params: item.params });
      } else {
        const screenMap = { InvoicesTab:'InvoiceList', QuotationsTab:'QuotationList', PartiesTab:'PartiesList' };
        const initialScreen = screenMap[item.tab];
        if (initialScreen) navigation.navigate(item.tab, { screen: initialScreen, params: item.params });
        else navigation.navigate(item.tab, item.params);
      }
    };

    React.useEffect(() => { onWidthChange(w); }, [w]);

    const sidebarWebStyle = {
      position: 'fixed', top: 0, left: 0, bottom: 0, width: w,
      backgroundColor: '#111827', zIndex: 1000,
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', transition: 'width 0.2s ease',
    };

    const renderNavItem = (item, idx) => {
      const active    = isActive(item);
      const flyouts   = SIDEBAR_FLYOUTS[item.name];
      const hasFlyout = flyouts && flyouts.length > 0;
      const isFlying  = flyoutItem === item.name;

      return (
        <div
          key={item.name}
          style={{ position: 'relative' }}
          onMouseEnter={(e) => {
            if (hasFlyout) {
              const rect = e.currentTarget.getBoundingClientRect();
              setFlyoutY(rect.top);
              setFlyoutItem(item.name);
            }
          }}
          onMouseLeave={() => setFlyoutItem(null)}
        >
          {/* Nav row */}
          <div
            onClick={() => go(item)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', margin: '1px 6px',
              borderRadius: 6, cursor: 'pointer', position: 'relative',
              backgroundColor: active ? 'rgba(255,255,255,0.08)' : isFlying ? 'rgba(255,255,255,0.05)' : 'transparent',
              transition: 'background-color 0.15s',
            }}
          >
            {active && (
              <div style={{ position:'absolute', left:0, top:6, bottom:6, width:3, borderRadius:2, backgroundColor:'#FF6B00' }} />
            )}
            <div style={{ width:20, height:20, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <SvgIcon name={item.icon} size={16} color={active ? '#fff' : isFlying ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)'} strokeWidth={active ? 2 : 1.5} />
            </div>
            <span style={{
              fontSize:13, fontWeight: active ? 600 : 400,
              color: active ? '#fff' : isFlying ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.45)',
              whiteSpace:'nowrap', overflow:'hidden', flex:1,
              opacity: expanded ? 1 : 0, transition:'opacity 0.15s ease',
            }}>
              {item.label}
            </span>
            {expanded && hasFlyout && (
              <div style={{ opacity: isFlying ? 1 : 0.3, transition:'opacity 0.15s', flexShrink:0 }}>
                <SvgIcon name="chevron-right" size={11} color="rgba(255,255,255,0.4)" strokeWidth={2} />
              </div>
            )}
          </div>

          {/* no inline flyout — rendered at sidebar root to avoid clipping */}
        </div>
      );
    }

    return (
      <div
        style={sidebarWebStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setFlyoutItem(null); }}
      >
        <style>{`@keyframes flyoutIn { from { opacity:0; } to { opacity:1; } }`}</style>
        {/* ── LOGO AREA ── */}
        <div style={{
          padding: '0 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center',
          height: 56, overflow: 'hidden',
          gap: 10,
        }}>
          {/* Icon square — always visible */}
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            backgroundColor: '#FF6B00',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 15, lineHeight: 1 }}>L</span>
          </div>

          {/* Wordmark — only when expanded */}
          <span style={{
            color: '#fff', fontWeight: 700, fontSize: 15,
            letterSpacing: '-0.3px', whiteSpace: 'nowrap',
            opacity: expanded ? 1 : 0,
            transition: 'opacity 0.15s ease',
            overflow: 'hidden',
          }}>
            Locas<span style={{ color: '#FF6B00' }}>.</span>
          </span>

          {/* Pin toggle — far right, only when expanded */}
          {expanded && (
            <div
              onClick={() => setPinned(v => !v)}
              style={{ cursor: 'pointer', opacity: 0.35, flexShrink: 0, marginLeft: 'auto' }}
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
              cursor: 'pointer', justifyContent: 'center',
              transition: 'padding 0.2s ease',
            }}
          >
            <SvgIcon name="plus" size={15} color="#fff" strokeWidth={2.5} />
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', opacity: expanded ? 1 : 0, maxWidth: expanded ? 120 : 0, transition: 'opacity 0.15s, max-width 0.2s', overflow: 'hidden' }}>
              New Invoice
            </span>
          </div>
        </div>

        <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', margin: '4px 12px' }} />

        {/* Nav items */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingTop: 4, paddingBottom: 4 }}>
          {SIDEBAR_ITEMS.map((item, idx) => renderNavItem(item, idx))}
        </div>

        {/* ── Root-level flyout — not clipped by sidebar overflow ── */}
        {flyoutItem && (() => {
          const activeFlying = SIDEBAR_ITEMS.find(i => i.name === flyoutItem) || (SIDEBAR_FOOTER.name === flyoutItem ? SIDEBAR_FOOTER : null);
          const flyouts = SIDEBAR_FLYOUTS[flyoutItem];
          if (!activeFlying || !flyouts) return null;
          return (
            <div
              style={{
                position: 'fixed',
                left: w + 6,
                top: flyoutY,
                zIndex: 3000,
                backgroundColor: '#161D2F',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                minWidth: 160,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                overflow: 'hidden',
                animation: 'flyoutIn 0.12s ease',
              }}
              onMouseEnter={() => setFlyoutItem(flyoutItem)}
              onMouseLeave={() => setFlyoutItem(null)}
            >
              {flyouts.map((f, fi) => (
                <div
                  key={fi}
                  onClick={() => go(f)}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: f.primary ? 600 : 400,
                    color: f.primary ? '#FF7A24' : 'rgba(255,255,255,0.75)',
                    borderTop: fi === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                    transition: 'background 0.1s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {f.label}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Footer */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 6px' }}>
          {(() => {
            const item = SIDEBAR_FOOTER;
            const active = isActive(item);
            return (
              <div
                onClick={() => go(item)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 6, cursor: 'pointer', position: 'relative',
                  backgroundColor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = active ? 'rgba(255,255,255,0.08)' : 'transparent'; }}
              >
                {active && (
                  <div style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, borderRadius: 2, backgroundColor: '#FF6B00' }} />
                )}
                <div style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <SvgIcon name={item.icon} size={16} color={active ? '#fff' : 'rgba(255,255,255,0.4)'} strokeWidth={active ? 2 : 1.5} />
                </div>
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
          })()}
        </div>
      </div>
    );
  }

  function SmartTabBar({ onWidthChange, ...props }) {
    const isWide = useIsWide();
    if (isWide) return <DesktopSidebar {...props} onWidthChange={onWidthChange} />;
    return <MobileTabBar {...props} />;
  }

  export default function AppNavigator({ licenseStatus }) {
    const isWide = useIsWide();
    const [sidebarW, setSidebarW] = useState(W_COLLAPSED);

    const handleWidthChange = useCallback((w) => {
      setSidebarW(w);
    }, []);

    return (
      <Tab.Navigator
        tabBar={props => (
          <SmartTabBar
            {...props}
            onWidthChange={isWide ? handleWidthChange : undefined}
          />
        )}
        screenOptions={{ headerShown: false }}
        sceneContainerStyle={isWide ? {
          position: 'fixed',
          top: 0, right: 0, bottom: 0,
          left: sidebarW,
          overflow: 'hidden',
          transition: 'left 0.2s ease',
        } : {}}
      >
        <Tab.Screen name="Dashboard"     component={DashboardScreen} />
        <Tab.Screen name="InvoicesTab"   component={InvoiceStack} />
        <Tab.Screen name="QuotationsTab" component={QuotationStack} />
        <Tab.Screen name="PartiesTab"    component={PartiesStack} />
        <Tab.Screen name="Inventory"     component={InventoryScreen} />
        <Tab.Screen name="More"          component={MoreStack} />
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
