import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getDashboardStats } from '../../db/db';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';
import { formatINRCompact, formatINR } from '../../utils/gst';

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = () => { setRefreshing(true); load(); };

  const now = new Date();
  const monthName = now.toLocaleString('en-IN', { month: 'long' });
  const year = now.getFullYear();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Jai Hind 🇮🇳</Text>
          <Text style={styles.monthLabel}>{monthName} {year}</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => navigation.navigate('More', { screen: 'Settings' })}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.scroll}
      >
        {/* KPI Row */}
        <View style={styles.kpiRow}>
          <KPICard
            label="Sales"
            value={formatINRCompact(stats?.sales?.total)}
            sub={`${stats?.sales?.count || 0} invoices`}
            color={COLORS.primary}
            icon="📈"
            onPress={() => navigation.navigate('InvoicesTab')}
          />
          <KPICard
            label="Expenses"
            value={formatINRCompact(stats?.expenses?.total)}
            sub="this month"
            color={COLORS.danger}
            icon="💸"
            onPress={() => navigation.navigate('More', { screen: 'Expenses' })}
          />
        </View>

        <View style={styles.kpiRow}>
          <KPICard
            label="To Collect"
            value={formatINRCompact(stats?.receivables?.total)}
            sub="outstanding"
            color={COLORS.warning}
            icon="⏳"
            onPress={() => navigation.navigate('InvoicesTab')}
          />
          <KPICard
            label="Profit"
            value={formatINRCompact((stats?.sales?.total || 0) - (stats?.expenses?.total || 0))}
            sub="this month"
            color={COLORS.success}
            icon="💰"
            onPress={() => navigation.navigate('More', { screen: 'Reports' })}
          />
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <QuickAction icon="🧾" label="New Invoice"   color="#FFF0E6" onPress={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })} />
          <QuickAction icon="👥" label="Add Party"     color="#E6F4FF" onPress={() => navigation.navigate('PartiesTab', { screen: 'PartiesList', params: { openAdd: true } })} />
          <QuickAction icon="📦" label="Add Item"      color="#E6FFE6" onPress={() => navigation.navigate('Inventory', { openAdd: true })} />
          <QuickAction icon="💸" label="Add Expense"   color="#FFE6E6" onPress={() => navigation.navigate('More', { screen: 'Expenses', params: { openAdd: true } })} />
          <QuickAction icon="📊" label="Reports"       color="#F3E6FF" onPress={() => navigation.navigate('More', { screen: 'Reports' })} />
          <QuickAction icon="⚙️" label="Settings"      color="#E6E6E6" onPress={() => navigation.navigate('More', { screen: 'Settings' })} />
        </View>

        {/* Top Customers */}
        {stats?.topCustomers?.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Top Customers — {monthName}</Text>
            <View style={styles.card}>
              {stats.topCustomers.map((c, i) => (
                <View key={i} style={[styles.topRow, i < stats.topCustomers.length - 1 && styles.topRowBorder]}>
                  <View style={styles.topRank}>
                    <Text style={styles.topRankText}>#{i + 1}</Text>
                  </View>
                  <Text style={styles.topName} numberOfLines={1}>{c.party_name || 'Walk-in'}</Text>
                  <Text style={styles.topAmt}>{formatINR(c.total)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Summary strip */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{formatINR(stats?.sales?.total)}</Text>
            <Text style={styles.summaryLbl}>Total Sales</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: COLORS.danger }]}>{formatINR(stats?.expenses?.total)}</Text>
            <Text style={styles.summaryLbl}>Total Expenses</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: COLORS.success }]}>
              {formatINR((stats?.sales?.total || 0) - (stats?.expenses?.total || 0))}
            </Text>
            <Text style={styles.summaryLbl}>Net Profit</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ─── Sub Components ──────────────────────────────────────────────

function KPICard({ label, value, sub, color, icon, onPress }) {
  return (
    <TouchableOpacity style={styles.kpiCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.kpiIconBox, { backgroundColor: color + '20' }]}>
        <Text style={styles.kpiIcon}>{icon}</Text>
      </View>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

function QuickAction({ icon, label, color, onPress }) {
  return (
    <TouchableOpacity style={styles.qaBtn} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.qaIconBox, { backgroundColor: color }]}>
        <Text style={styles.qaIcon}>{icon}</Text>
      </View>
      <Text style={styles.qaLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  greeting: {
    fontSize: 18,
    fontWeight: FONTS.bold,
    color: COLORS.text,
  },
  monthLabel: {
    fontSize: 13,
    color: COLORS.textSub,
    marginTop: 2,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: { fontSize: 20 },
  scroll: {
    padding: 16,
  },

  // KPI
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 14,
    ...SHADOW.sm,
  },
  kpiIconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  kpiIcon:  { fontSize: 18 },
  kpiValue: { fontSize: 20, fontWeight: FONTS.heavy, marginBottom: 2 },
  kpiLabel: { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.text },
  kpiSub:   { fontSize: 11, color: COLORS.textMute, marginTop: 2 },

  // Section
  sectionTitle: {
    fontSize: 15,
    fontWeight: FONTS.bold,
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 12,
  },

  // Quick Actions
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  qaBtn: {
    width: '30.5%',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    ...SHADOW.sm,
  },
  qaIconBox: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  qaIcon:  { fontSize: 22 },
  qaLabel: { fontSize: 11, fontWeight: FONTS.semibold, color: COLORS.text, textAlign: 'center' },

  // Top customers
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 4,
    marginBottom: 16,
    ...SHADOW.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  topRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  topRank: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  topRankText: { fontSize: 12, fontWeight: FONTS.bold, color: COLORS.primary },
  topName:     { flex: 1, fontSize: 14, fontWeight: FONTS.medium, color: COLORS.text },
  topAmt:      { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text },

  // Summary
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 8,
    ...SHADOW.sm,
  },
  summaryItem:    { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 4 },
  summaryVal:     { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.white, marginBottom: 4 },
  summaryLbl:     { fontSize: 10, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
});