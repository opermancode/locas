import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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

const TABS = [
  { name: 'Dashboard',   label: 'Home',     icon: 'home',       idx: 0 },
  { name: 'InvoicesTab', label: 'Invoices', icon: 'file-text',  idx: 1 },
  { name: 'PartiesTab',  label: 'Parties',  icon: 'users',      idx: 2 },
  { name: 'Inventory',   label: 'Items',    icon: 'package',    idx: 3 },
  { name: 'More',        label: 'More',     icon: 'menu',       idx: 4 },
];

function CustomTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {/* Floating create button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      <View style={styles.bar}>
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
                <Feather
                  name={tab.icon}
                  size={18}
                  color={focused ? COLORS.primary : COLORS.textMute}
                  strokeWidth={focused ? 2.5 : 1.5}
                />
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
  barWrap: {
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
  bar:           { flexDirection: 'row', paddingTop: 10, paddingHorizontal: 4 },
  tabItem:       { flex: 1, alignItems: 'center', gap: 3, paddingBottom: 2 },
  iconPill:      { width: 42, height: 28, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  iconPillActive:{ backgroundColor: COLORS.primaryLight },
  tabLabel:      { fontSize: 10, fontWeight: FONTS.medium, color: COLORS.textMute },
  tabLabelActive:{ color: COLORS.primary, fontWeight: FONTS.bold },
});