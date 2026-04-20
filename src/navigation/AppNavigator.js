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
import POBacklogScreen  from '../screens/PurchaseOrder/POBacklogScreen';
import HelpSupportScreen from '../screens/Support/HelpSupportScreen';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

const W_EXPANDED  = 220;
const W_COLLAPSED = 58;
const BRAND       = '#FF6B00';
const BG          = '#0B1120';
const SIDEBAR_BG  = '#0F1825';
const BORDER      = 'rgba(255,255,255,0.06)';
const ITEM_ACTIVE = 'rgba(255,107,0,0.12)';
const ITEM_HOVER  = 'rgba(255,255,255,0.05)';

// ── Stacks ─────────────────────────────────────────────────────────
function InvoiceStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown:false }}>
      <Stack.Screen name="InvoiceList"   component={InvoiceListScreen}/>
      <Stack.Screen name="CreateInvoice" component={CreateInvoice}/>
      <Stack.Screen name="InvoiceDetail" component={InvoiceDetail}/>
    </Stack.Navigator>
  );
}
function QuotationStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown:false }}>
      <Stack.Screen name="QuotationList"   component={QuotationListScreen}/>
      <Stack.Screen name="CreateQuotation" component={CreateQuotation}/>
      <Stack.Screen name="QuotationDetail" component={QuotationDetailScreen}/>
    </Stack.Navigator>
  );
}
function POStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown:false }}>
      <Stack.Screen name="POList"    component={POListScreen}/>
      <Stack.Screen name="CreatePO"  component={CreatePOScreen}/>
      <Stack.Screen name="PODetail"  component={PODetailScreen}/>
      <Stack.Screen name="POAlerts"  component={POAlertsScreen}/>
      <Stack.Screen name="POBacklog" component={POBacklogScreen}/>
    </Stack.Navigator>
  );
}
function PartiesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown:false }}>
      <Stack.Screen name="PartiesList" component={PartiesScreen}/>
      <Stack.Screen name="PartyDetail" component={PartyDetail}/>
    </Stack.Navigator>
  );
}
function MoreStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown:false }}>
      <Stack.Screen name="Expenses"       component={ExpensesScreen}/>
      <Stack.Screen name="Reports"        component={ReportsScreen}/>
      <Stack.Screen name="Settings"       component={SettingsScreen}/>
      <Stack.Screen name="PurchaseOrders" component={POListScreen}/>
      <Stack.Screen name="CreatePO"       component={CreatePOScreen}/>
      <Stack.Screen name="PODetail"       component={PODetailScreen}/>
      <Stack.Screen name="POAlerts"       component={POAlertsScreen}/>
      <Stack.Screen name="POBacklog"      component={POBacklogScreen}/>
      <Stack.Screen name="HelpSupport"    component={HelpSupportScreen}/>
    </Stack.Navigator>
  );
}

// ── SVG icon system ────────────────────────────────────────────────
const SVG_PATHS = {
  'home':          'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z||M9 22V12h6v10',
  'file-text':     'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z||M14 2v6h6||M16 13H8||M16 17H8||M10 9H8',
  'clipboard':     'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2||M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z||M12 11h4||M12 16h4||M8 11h.01||M8 16h.01',
  'users':         'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2||M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z||M23 21v-2a4 4 0 0 0-3-3.87||M16 3.13a4 4 0 0 1 0 7.75',
  'package':       'M16.5 9.4l-9-5.19||M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z||M3.27 6.96L12 12.01l8.73-5.05||M12 22.08V12',
  'credit-card':   'M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z||M1 10h22',
  'bar-chart-2':   'M18 20V10||M12 20V4||M6 20v-6',
  'settings':      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z||M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  'plus':          'M12 5v14||M5 12h14',
  'grid':          'M3 3h7v7H3z||M14 3h7v7h-7z||M14 14h7v7h-7z||M3 14h7v7H3z',
  'chevron-left':  'M15 18l-6-6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  'shopping-bag':  'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z||M3 6h18||M16 10a4 4 0 0 1-8 0',
  'help-circle':   'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z||M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3||M12 17h.01',
  'alert-triangle':'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z||M12 9v4||M12 17h.01',
};

function SvgIcon({ name, size=16, color='#fff', strokeWidth=1.5 }) {
  const paths = (SVG_PATHS[name]||'').split('||').filter(Boolean);
  if (!paths.length) return null;
  return React.createElement('svg', {
    xmlns:'http://www.w3.org/2000/svg', width:size, height:size, viewBox:'0 0 24 24',
    fill:'none', stroke:color, strokeWidth:String(strokeWidth),
    strokeLinecap:'round', strokeLinejoin:'round',
    style:{ display:'block', flexShrink:0 },
  }, ...paths.map((d,i)=>React.createElement('path',{key:i,d})));
}

function NavIcon({ name, size, color, strokeWidth }) {
  if (Platform.OS==='web') return <SvgIcon name={name} size={size} color={color} strokeWidth={strokeWidth}/>;
  const { Feather } = require('@expo/vector-icons');
  return <Feather name={name} size={size} color={color}/>;
}

// ── Tab config ─────────────────────────────────────────────────────
const MOBILE_TABS = [
  { name:'Dashboard',     label:'Home',     icon:'home',         idx:0 },
  { name:'InvoicesTab',   label:'Invoices', icon:'file-text',    idx:1 },
  { name:'QuotationsTab', label:'Quotes',   icon:'clipboard',    idx:2 },
  { name:'PartiesTab',    label:'Parties',  icon:'users',        idx:3 },
  { name:'More',          label:'More',     icon:'grid',         idx:4 },
];

const SIDEBAR_ITEMS = [
  { name:'Dashboard',      label:'Home',        icon:'home',          tab:'Dashboard',     screen:null },
  { name:'InvoicesTab',    label:'Invoices',    icon:'file-text',     tab:'InvoicesTab',   screen:null },
  { name:'PartiesTab',     label:'Parties',     icon:'users',         tab:'PartiesTab',    screen:null },
  { name:'Inventory',      label:'Items',       icon:'package',       tab:'Inventory',     screen:null },
  { name:'Expenses',       label:'Expenses',    icon:'credit-card',   tab:'More',          screen:'Expenses' },
  { name:'Reports',        label:'Reports',     icon:'bar-chart-2',   tab:'More',          screen:'Reports' },
  { name:'PurchaseOrders', label:'PO Orders',   icon:'shopping-bag',  tab:'More',          screen:'PurchaseOrders' },
  { name:'QuotationsTab',  label:'Quotations',  icon:'clipboard',     tab:'QuotationsTab', screen:null },
  { name:'Settings',       label:'Settings',    icon:'settings',      tab:'More',          screen:'Settings' },
];

const SIDEBAR_FOOTER = { name:'HelpSupport', label:'Help & Support', icon:'help-circle', tab:'More', screen:'HelpSupport' };

// Flyouts — only items with real sub-screens
const SIDEBAR_FLYOUTS = {
  InvoicesTab: [
    { label:'New Invoice',   icon:'plus', tab:'InvoicesTab',   screen:'CreateInvoice',   primary:true },
  ],
  PartiesTab: [
    { label:'Create Party',  icon:'plus', tab:'PartiesTab',    screen:'PartiesList',     primary:true },
  ],
  Inventory: [
    { label:'Create Item',   icon:'plus', tab:'Inventory',     screen:null,              primary:true, params:{ openAdd:true } },
  ],
  PurchaseOrders: [
    { label:'New PO',        icon:'plus',           tab:'More', screen:'CreatePO',       primary:true },
    { label:'PO Alerts',     icon:'alert-triangle', tab:'More', screen:'POAlerts' },
  ],
  QuotationsTab: [
    { label:'New Quotation', icon:'plus', tab:'QuotationsTab', screen:'CreateQuotation', primary:true },
  ],
};

// ── Mobile tab bar ─────────────────────────────────────────────────
function MobileTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[mob.bar, { paddingBottom:Math.max(insets.bottom,8) }]}>
      <TouchableOpacity style={mob.fab} onPress={()=>navigation.navigate('InvoicesTab',{screen:'CreateInvoice'})} activeOpacity={0.85}>
        <NavIcon name="plus" size={22} color="#fff" strokeWidth={2.5}/>
      </TouchableOpacity>
      <View style={mob.row}>
        {MOBILE_TABS.map(tab=>{
          const focused = state.index===tab.idx;
          return (
            <TouchableOpacity key={tab.name} style={mob.item} onPress={()=>{
              const screenMap={InvoicesTab:'InvoiceList',QuotationsTab:'QuotationList',PartiesTab:'PartiesList'};
              const init=screenMap[tab.name];
              if (init) navigation.navigate(tab.name,{screen:init});
              else navigation.navigate(tab.name);
            }} activeOpacity={0.7}>
              <View style={[mob.pill, focused&&mob.pillActive]}>
                <NavIcon name={tab.icon} size={18} color={focused?BRAND:COLORS.textMute}/>
              </View>
              <Text style={[mob.label, focused&&mob.labelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Desktop sidebar ────────────────────────────────────────────────
function DesktopSidebar({ state, navigation, onWidthChange }) {
  const [pinned,     setPinned]    = useState(false);
  const [hovered,    setHovered]   = useState(false);
  const [flyoutItem, setFlyoutItem]= useState(null);
  const [flyoutY,    setFlyoutY]   = useState(0);

  const expanded = pinned || hovered;
  const w = expanded ? W_EXPANDED : W_COLLAPSED;

  const activeTabName = MOBILE_TABS[state.index]?.name;
  const moreRoute     = state.routes?.find(r=>r.name==='More');
  const activeMoreScreen = moreRoute?.state?.routes?.[moreRoute.state.index??0]?.name??null;

  const isActive = item => item.screen
    ? activeTabName==='More' && activeMoreScreen===item.screen
    : activeTabName===item.tab;

  const go = item => {
    setFlyoutItem(null);
    if (item.tab==='Inventory') {
      navigation.navigate('Inventory', item.params);
    } else if (item.screen) {
      navigation.navigate(item.tab, { screen:item.screen, params:item.params });
    } else {
      const screenMap={InvoicesTab:'InvoiceList',QuotationsTab:'QuotationList',PartiesTab:'PartiesList'};
      const init=screenMap[item.tab];
      if (init) navigation.navigate(item.tab, { screen:init, params:item.params });
      else navigation.navigate(item.tab, item.params);
    }
  };

  React.useEffect(()=>{ onWidthChange(w); }, [w]);

  const sidebarStyle = {
    position:'fixed', top:0, left:0, bottom:0, width:w,
    backgroundColor:SIDEBAR_BG,
    zIndex:1000,
    borderRight:`1px solid ${BORDER}`,
    display:'flex', flexDirection:'column',
    overflow:'hidden',
    transition:'width 0.22s cubic-bezier(0.4,0,0.2,1)',
    backdropFilter:'blur(12px)',
  };

  const renderItem = (item, isFooter=false) => {
    const active   = isActive(item);
    const flyouts  = SIDEBAR_FLYOUTS[item.name];
    const hasFlyout= flyouts&&flyouts.length>0;
    const isFlying = flyoutItem===item.name;

    return (
      <div
        key={item.name}
        style={{ position:'relative' }}
        onMouseEnter={e => {
          if (hasFlyout) {
            const rect = e.currentTarget.getBoundingClientRect();
            setFlyoutY(rect.top);
            setFlyoutItem(item.name);
          }
        }}
        onMouseLeave={() => setFlyoutItem(null)}
      >
        <div
          onClick={() => go(item)}
          style={{
            display:'flex', alignItems:'center', gap:11,
            padding:'9px 10px', margin:'1px 6px',
            borderRadius:10, cursor:'pointer', position:'relative',
            backgroundColor: active ? ITEM_ACTIVE : isFlying ? ITEM_HOVER : 'transparent',
            transition:'background 0.15s',
          }}
          onMouseEnter={e=>{ if (!active&&!isFlying) e.currentTarget.style.backgroundColor=ITEM_HOVER; }}
          onMouseLeave={e=>{ if (!active) e.currentTarget.style.backgroundColor=isFlying?ITEM_HOVER:'transparent'; }}
        >
          {/* Active accent bar */}
          {active&&(
            <div style={{ position:'absolute', left:0, top:6, bottom:6, width:3, borderRadius:2, backgroundColor:BRAND }}/>
          )}

          {/* Icon */}
          <div style={{ width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <SvgIcon name={item.icon} size={16}
              color={active?BRAND:isFlying?'rgba(255,255,255,0.65)':'rgba(255,255,255,0.35)'}
              strokeWidth={active?2.2:1.5}
            />
          </div>

          {/* Label */}
          <span style={{
            fontSize:13, fontWeight:active?'700':'400',
            color:active?'#fff':isFlying?'rgba(255,255,255,0.7)':'rgba(255,255,255,0.4)',
            whiteSpace:'nowrap', flex:1,
            opacity:expanded?1:0, transition:'opacity 0.15s',
          }}>
            {item.label}
          </span>

          {/* Flyout chevron */}
          {expanded&&hasFlyout&&(
            <div style={{ opacity:isFlying?0.8:0.25, transition:'opacity 0.15s', flexShrink:0 }}>
              <SvgIcon name="chevron-right" size={11} color="rgba(255,255,255,0.5)" strokeWidth={2}/>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      style={sidebarStyle}
      onMouseEnter={()=>setHovered(true)}
      onMouseLeave={()=>{ setHovered(false); setFlyoutItem(null); }}
    >
      <style>{`@keyframes flyIn { from { opacity:0; transform:translateX(-4px); } to { opacity:1; transform:translateX(0); } }`}</style>

      {/* ── Logo ── */}
      <div style={{ padding:'0 10px', borderBottom:`1px solid ${BORDER}`, display:'flex', alignItems:'center', height:56, gap:10, overflow:'hidden' }}>
        <div style={{ width:32, height:32, borderRadius:10, backgroundColor:BRAND, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 4px 12px rgba(255,107,0,0.35)' }}>
          <span style={{ color:'#fff', fontWeight:'900', fontSize:16, lineHeight:1 }}>L</span>
        </div>
        <div style={{ opacity:expanded?1:0, transition:'opacity 0.15s', overflow:'hidden', whiteSpace:'nowrap' }}>
          <span style={{ color:'#fff', fontWeight:'800', fontSize:15, letterSpacing:'-0.3px' }}>Locas</span>
          <span style={{ color:BRAND, fontWeight:'900', fontSize:15 }}>.</span>
        </div>
        {expanded&&(
          <div onClick={()=>setPinned(v=>!v)} style={{ cursor:'pointer', marginLeft:'auto', opacity:0.3, transition:'opacity 0.15s', flexShrink:0 }} onMouseEnter={e=>e.currentTarget.style.opacity=0.8} onMouseLeave={e=>e.currentTarget.style.opacity=0.3}>
            <SvgIcon name={pinned?'chevron-left':'chevron-right'} size={13} color="#fff" strokeWidth={2.5}/>
          </div>
        )}
      </div>

      {/* ── New Invoice CTA ── */}
      <div style={{ padding:'10px 8px 6px' }}>
        <div
          onClick={()=>navigation.navigate('InvoicesTab',{screen:'CreateInvoice'})}
          style={{
            display:'flex', alignItems:'center', justifyContent:'center', gap:7,
            backgroundColor:BRAND, borderRadius:10, padding:expanded?'9px 14px':'9px 0',
            cursor:'pointer', transition:'padding 0.22s, box-shadow 0.15s',
            boxShadow:'0 4px 14px rgba(255,107,0,0.3)',
          }}
          onMouseEnter={e=>e.currentTarget.style.boxShadow='0 6px 20px rgba(255,107,0,0.45)'}
          onMouseLeave={e=>e.currentTarget.style.boxShadow='0 4px 14px rgba(255,107,0,0.3)'}
        >
          <SvgIcon name="plus" size={14} color="#fff" strokeWidth={2.5}/>
          <span style={{ color:'#fff', fontWeight:'700', fontSize:12, whiteSpace:'nowrap', opacity:expanded?1:0, maxWidth:expanded?120:0, transition:'opacity 0.15s, max-width 0.22s', overflow:'hidden' }}>
            New Invoice
          </span>
        </div>
      </div>

      <div style={{ height:1, backgroundColor:BORDER, margin:'4px 10px' }}/>

      {/* ── Nav items ── */}
      <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', paddingTop:4, paddingBottom:4, scrollbarWidth:'none' }}>
        {SIDEBAR_ITEMS.map(item=>renderItem(item))}
      </div>

      {/* ── Root-level flyout panel ── */}
      {flyoutItem&&(()=>{
        const currentItem = flyoutItem; // capture for closures
        const flyouts = SIDEBAR_FLYOUTS[currentItem];
        if (!flyouts) return null;
        return (
          <div
            style={{
              position:'fixed', left:w+4, top:flyoutY,
              zIndex:3000,
              backgroundColor:'#131C2E',
              border:`1px solid rgba(255,255,255,0.1)`,
              borderRadius:10, overflow:'hidden',
              minWidth:168,
              boxShadow:'0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
              animation:'flyIn 0.12s ease',
            }}
            onMouseEnter={()=>setFlyoutItem(currentItem)}
            onMouseLeave={()=>setFlyoutItem(null)}
          >
            {flyouts.map((f,fi)=>(
              <div
                key={fi}
                onClick={()=>go(f)}
                style={{
                  padding:'10px 16px', cursor:'pointer',
                  fontSize:13,
                  fontWeight:f.primary?'600':'400',
                  color:f.primary?BRAND:'rgba(255,255,255,0.7)',
                  borderTop:fi===0?'none':'1px solid rgba(255,255,255,0.05)',
                  transition:'background 0.1s',
                  whiteSpace:'nowrap',
                }}
                onMouseEnter={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.color=f.primary?'#FF9A50':'#fff'; }}
                onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color=f.primary?BRAND:'rgba(255,255,255,0.7)'; }}
              >
                {f.label}
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Footer ── */}
      <div style={{ borderTop:`1px solid ${BORDER}`, padding:'8px 6px' }}>
        {renderItem(SIDEBAR_FOOTER, true)}
      </div>
    </div>
  );
}

// ── Width hook ─────────────────────────────────────────────────────
function useIsWide() {
  const [wide, setWide] = useState(()=>Platform.OS==='web'&&Dimensions.get('window').width>=768);
  React.useEffect(()=>{
    if (Platform.OS!=='web') return;
    const sub = Dimensions.addEventListener('change',({window})=>setWide(window.width>=768));
    return ()=>sub?.remove();
  },[]);
  return wide;
}

function SmartTabBar({ onWidthChange, ...props }) {
  const isWide = useIsWide();
  if (isWide) return <DesktopSidebar {...props} onWidthChange={onWidthChange}/>;
  return <MobileTabBar {...props}/>;
}

export default function AppNavigator() {
  const isWide = useIsWide();
  const [sidebarW, setSidebarW] = useState(W_COLLAPSED);
  const handleWidthChange = useCallback(w=>setSidebarW(w),[]);

  return (
    <Tab.Navigator
      tabBar={props=>(
        <SmartTabBar {...props} onWidthChange={isWide?handleWidthChange:undefined}/>
      )}
      screenOptions={{ headerShown:false }}
      sceneContainerStyle={isWide ? {
        position:'fixed', top:0, right:0, bottom:0, left:sidebarW,
        overflow:'hidden', transition:'left 0.22s cubic-bezier(0.4,0,0.2,1)',
        backgroundColor:BG,
      } : {}}
    >
      <Tab.Screen name="Dashboard"     component={DashboardScreen}/>
      <Tab.Screen name="InvoicesTab"   component={InvoiceStack}/>
      <Tab.Screen name="QuotationsTab" component={QuotationStack}/>
      <Tab.Screen name="PartiesTab"    component={PartiesStack}/>
      <Tab.Screen name="Inventory"     component={InventoryScreen}/>
      <Tab.Screen name="More"          component={MoreStack}/>
    </Tab.Navigator>
  );
}

// ── Mobile styles ──────────────────────────────────────────────────
const mob = StyleSheet.create({
  bar:       { backgroundColor:COLORS.card, borderTopWidth:1, borderTopColor:COLORS.border, ...SHADOW.md },
  fab:       { position:'absolute', top:-24, alignSelf:'center', width:50, height:50, borderRadius:25, backgroundColor:BRAND, alignItems:'center', justifyContent:'center', zIndex:99, ...SHADOW.brand, borderWidth:3, borderColor:COLORS.card },
  row:       { flexDirection:'row', paddingTop:10, paddingHorizontal:4 },
  item:      { flex:1, alignItems:'center', gap:3, paddingBottom:2 },
  pill:      { width:42, height:28, borderRadius:RADIUS.sm, alignItems:'center', justifyContent:'center' },
  pillActive:{ backgroundColor:COLORS.primaryLight },
  label:     { fontSize:10, fontWeight:FONTS.medium, color:COLORS.textMute },
  labelActive:{ color:BRAND, fontWeight:FONTS.bold },
});
