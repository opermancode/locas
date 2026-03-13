import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOW } from '../theme';

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

const TABS = [
  { name: 'Home',      icon: '🏠', screen: 'Dashboard' },
  { name: 'Invoices',  icon: '🧾', screen: 'InvoicesTab' },
  { name: 'Parties',   icon: '👥', screen: 'PartiesTab' },
  { name: 'Items',     icon: '📦', screen: 'Inventory' },
  { name: 'More',      icon: '☰',  screen: 'More' },
];

// ─── Stack Navigators ────────────────────────────────────────────

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
      <Stack.Screen name="Expenses"  component={ExpensesScreen} />
      <Stack.Screen name="Reports"   component={ReportsScreen} />
      <Stack.Screen name="Settings"  component={SettingsScreen} />
    </Stack.Navigator>
  );
}

// ─── Custom Tab Bar ──────────────────────────────────────────────

function CustomTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom || 8 }]}>
      {TABS.map((tab, index) => {
        const focused = state.index === index;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tabItem}
            onPress={() => navigation.navigate(tab.screen)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Text style={styles.tabIcon}>{tab.icon}</Text>
            </View>
            <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* FAB — centre create button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Root Navigator ──────────────────────────────────────────────

export default function AppNavigator() {
  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
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

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    paddingTop: 10,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOW.md,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: COLORS.primaryLight,
  },
  tabIcon: {
    fontSize: 18,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textMute,
    marginTop: 2,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -26,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.md,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.4,
  },
  fabIcon: {
    fontSize: 28,
    color: COLORS.white,
    fontWeight: '300',
    lineHeight: 32,
  },
});