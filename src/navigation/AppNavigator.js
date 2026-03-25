import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOW, RADIUS, FONTS } from '../theme';

// Screens
import DashboardScreen    from '../screens/Dashboard/DashboardScreen';
import InvoiceListScreen  from '../screens/Invoice/InvoiceListScreen';
import CreateInvoice      from '../screens/Invoice/CreateInvoice';
import InvoiceDetail      from '../screens/Invoice/InvoiceDetail';
import PartiesScreen      from '../screens/Parties/PartiesScreen';
import PartyDetail        from '../screens/Parties/PartyDetail';
import InventoryScreen    from '../screens/Inventory/InventoryScreen';
import ExpensesScreen     from '../screens/Expenses/ExpensesScreen';
import ReportsScreen      from '../screens/Reports/ReportsScreen';
import SettingsScreen     from '../screens/Settings/SettingsScreen';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

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

// ─── Tab config ───────────────────────────────────────────────────
const TABS = [
  { name: 'Dashboard',  icon: '🏠', label: 'Home',     index: 0 },
  { name: 'InvoicesTab',icon: '🧾', label: 'Invoices', index: 1 },
  { name: 'PartiesTab', icon: '👥', label: 'Parties',  index: 2 },
  { name: 'Inventory',  icon: '📦', label: 'Items',    index: 3 },
  { name: 'More',       icon: '☰',  label: 'More',     index: 4 },
];

// ─── Custom tab bar ───────────────────────────────────────────────
function CustomTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBarOuter, { paddingBottom: insets.bottom || 8 }]}>
      {/* FAB — Create Invoice */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <View style={styles.tabBar}>
        {TABS.map((tab, i) => {
          const focused = state.index === tab.index;
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabItem}
              onPress={() => navigation.navigate(tab.name)}
              activeOpacity={0.7}
            >
              <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
                <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>
                  {tab.icon}
                </Text>
              </View>
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {focused && <View style={styles.tabDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function AppNavigator() {
  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard"  component={DashboardScreen} />
      <Tab.Screen name="InvoicesTab" component={InvoiceStack} />
      <Tab.Screen name="PartiesTab"  component={PartiesStack} />
      <Tab.Screen name="Inventory"   component={InventoryScreen} />
      <Tab.Screen name="More"        component={MoreStack} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBarOuter: {
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOW.md,
    position: 'relative',
  },

  // FAB button sits above the tab bar
  fab: {
    position: 'absolute',
    top: -24,
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...SHADOW.brand,
    borderWidth: 3,
    borderColor: COLORS.card,
  },
  fabIcon: { fontSize: 26, color: '#fff', fontWeight: FONTS.black, lineHeight: 30 },

  tabBar: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingHorizontal: 4,
  },

  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 2,
    gap: 3,
  },

  tabIconWrap: {
    width: 38,
    height: 32,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapActive: {
    backgroundColor: COLORS.primaryLight,
  },

  tabIcon:       { fontSize: 18 },
  tabIconActive: { },   // color handled by background tint

  tabLabel: {
    fontSize: 10,
    fontWeight: FONTS.medium,
    color: COLORS.textMute,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: FONTS.bold,
  },

  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    marginTop: 1,
  },
});
