import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet
} from 'react-native';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOW } from '../theme';

// Screens
import DashboardScreen from '../screens/Dashboard/DashboardScreen';

import InvoiceListScreen from '../screens/Invoice/InvoiceListScreen';
import CreateInvoice from '../screens/Invoice/CreateInvoice';
import InvoiceDetail from '../screens/Invoice/InvoiceDetail';

import PartiesScreen from '../screens/Parties/PartiesScreen';
import PartyDetail from '../screens/Parties/PartyDetail';

import InventoryScreen from '../screens/Inventory/InventoryScreen';

import ExpensesScreen from '../screens/Expenses/ExpensesScreen';
import ReportsScreen from '../screens/Reports/ReportsScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();


// ─────────────────────────────────────────────
// Invoice Stack
// ─────────────────────────────────────────────

function InvoiceStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="InvoiceList" component={InvoiceListScreen} />
      <Stack.Screen name="CreateInvoice" component={CreateInvoice} />
      <Stack.Screen name="InvoiceDetail" component={InvoiceDetail} />
    </Stack.Navigator>
  );
}


// ─────────────────────────────────────────────
// Parties Stack
// ─────────────────────────────────────────────

function PartiesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PartiesList" component={PartiesScreen} />
      <Stack.Screen name="PartyDetail" component={PartyDetail} />
    </Stack.Navigator>
  );
}


// ─────────────────────────────────────────────
// More Stack
// ─────────────────────────────────────────────

function MoreStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Expenses" component={ExpensesScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}


// ─────────────────────────────────────────────
// Custom Tab Button
// ─────────────────────────────────────────────

function TabButton({ icon, label, focused, onPress }) {
  return (
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
        <Text style={styles.tabIcon}>{icon}</Text>
      </View>

      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}


// ─────────────────────────────────────────────
// Custom Bottom Tab Bar
// ─────────────────────────────────────────────

function CustomTabBar({ state, navigation }) {

  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom || 8 }]}>

      {/* CREATE INVOICE */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() =>
          navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })
        }
      >
        <View style={[styles.iconWrap, styles.createBtn]}>
          <Text style={styles.createIcon}>+</Text>
        </View>

        <Text style={styles.tabLabel}>Create</Text>
      </TouchableOpacity>


      {/* HOME */}
      <TabButton
        icon="🏠"
        label="Home"
        focused={state.index === 0}
        onPress={() => navigation.navigate('Dashboard')}
      />


      {/* PARTIES */}
      <TabButton
        icon="👥"
        label="Parties"
        focused={state.index === 2}
        onPress={() => navigation.navigate('PartiesTab')}
      />


      {/* ITEMS */}
      <TabButton
        icon="📦"
        label="Items"
        focused={state.index === 3}
        onPress={() => navigation.navigate('Inventory')}
      />


      {/* INVOICES */}
      <TabButton
        icon="🧾"
        label="Invoices"
        focused={state.index === 1}
        onPress={() => navigation.navigate('InvoicesTab')}
      />


      {/* MORE */}
      <TabButton
        icon="☰"
        label="More"
        focused={state.index === 4}
        onPress={() => navigation.navigate('More')}
      />

    </View>
  );
}


// ─────────────────────────────────────────────
// Root Navigator
// ─────────────────────────────────────────────

export default function AppNavigator() {
  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />

      <Tab.Screen name="InvoicesTab" component={InvoiceStack} />

      <Tab.Screen name="PartiesTab" component={PartiesStack} />

      <Tab.Screen name="Inventory" component={InventoryScreen} />

      <Tab.Screen name="More" component={MoreStack} />
    </Tab.Navigator>
  );
}


// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({

  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    paddingTop: 10,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOW.md
  },

  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4
  },

  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },

  iconWrapActive: {
    backgroundColor: COLORS.primaryLight
  },

  tabIcon: {
    fontSize: 18
  },

  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textMute,
    marginTop: 2
  },

  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '700'
  },

  createBtn: {
    backgroundColor: COLORS.primary
  },

  createIcon: {
    fontSize: 22,
    color: COLORS.white,
    fontWeight: '700'
  }

});