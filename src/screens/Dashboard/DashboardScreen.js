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
  const [stats, setStats]       = useState(null);
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

  const now       = new Date();
  const monthName = now.toLocaleString('en-IN', { month: 'long' });
  const year      = now.getFullYear();

  const collected   = stats?.collected?.total  || 0;
  const expenses    = stats?.expenses?.total   || 0;
  const invoiced    = stats?.sales?.total      || 0;
  const pending     = stats?.receivables?.total || 0;
  const profit      = collected - expenses;
  const invoiceCount= stats?.sales?.count      || 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Status bar background */}
      <View style={styles.statusBarBg} />

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        contentContainerStyle={styles.scroll}
      >

        {/* ── KPI Row 1 ─────────────────────────────────────── */}
        <View style={styles.kpiRow}>
          <KPICard
            label="Invoiced"
            value={formatINRCompact(invoiced)}
            sub={`${invoiceCount} invoice${invoiceCount !== 1 ? 's' : ''}`}
            color={COLORS.primary}
            icon="📈"
            onPress={() => navigation.navigate('InvoicesTab')}
          />
          <KPICard
            label="Collected"
            value={formatINRCompact(collected)}
            sub="actual received"
            color={COLORS.success}
            icon="✅"
            onPress={() => navigation.navigate('InvoicesTab')}
          />
        </View>

        {/* ── KPI Row 2 ─────────────────────────────────────── */}
        <View style={styles.kpiRow}>
          <KPICard
            label="Pending"
            value={formatINRCompact(pending)}
            sub="to collect"
            color={COLORS.warning}
            icon="⏳"
            onPress={() => navigation.navigate('InvoicesTab')}
          />
          <KPICard
            label="Profit"
            value={formatINRCompact(Math.abs(profit))}
            sub={profit >= 0 ? 'collected − expenses' : 'loss this month'}
            color={profit >= 0 ? COLORS.success : COLORS.danger}
            icon={profit >= 0 ? '💰' : '📉'}
            onPress={() => navigation.navigate('More', { screen: 'Reports' })}
          />
        </View>

        {/* ── Expenses quick stat ───────────────────────────── */}
        <TouchableOpacity
          style={styles.expenseStrip}
          onPress={() => navigation.navigate('More', { screen: 'Expenses' })}
          activeOpacity={0.8}
        >
          <View style={styles.expenseStripLeft}>
            <Text style={styles.expenseStripIcon}>💸</Text>
            <View>
              <Text style={styles.expenseStripLabel}>Expenses this month</Text>
              <Text style={styles.expenseStripValue}>{formatINR(expenses)}</Text>
            </View>
          </View>
          <Text style={styles.expenseStripArrow}>→</Text>
        </TouchableOpacity>

        {/* ── Quick Actions ─────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <QuickAction
            icon="🧾" label="New Invoice" color="#FFF0E6"
            onPress={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })}
          />
          <QuickAction
            icon="👥" label="Add Party" color="#E6F4FF"
            onPress={() => navigation.navigate('PartiesTab')}
          />
          <QuickAction
            icon="📦" label="Add Item" color="#E6FFE6"
            onPress={() => navigation.navigate('Inventory', { openAdd: true })}
          />
          <QuickAction
            icon="💸" label="Add Expense" color="#FFE6E6"
            onPress={() => navigation.navigate('More', { screen: 'Expenses', params: { openAdd: true } })}
          />
          <QuickAction
            icon="📊" label="Reports" color="#F3E6FF"
            onPress={() => navigation.navigate('More', { screen: 'Reports' })}
          />
          <QuickAction
            icon="⚙️" label="Settings" color="#E6E6E6"
            onPress={() => navigation.navigate('More', { screen: 'Settings' })}
          />
        </View>

        {/* ── Top Customers ─────────────────────────────────── */}
        {stats?.topCustomers?.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Top Customers — {monthName}</Text>
            <View style={styles.card}>
              {stats.topCustomers.map((c, i) => (
                <View
                  key={i}
                  style={[
                    styles.topRow,
                    i < stats.topCustomers.length - 1 && styles.topRowBorder,
                  ]}
                >
                  <View style={styles.topRank}>
                    <Text style={styles.topRankText}>#{i + 1}</Text>
                  </View>
                  <Text style={styles.topName} numberOfLines={1}>
                    {c.party_name || 'Walk-in'}
                  </Text>
                  <Text style={styles.topAmt}>{formatINR(c.total)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Summary strip ─────────────────────────────────── */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{formatINR(invoiced)}</Text>
            <Text style={styles.summaryLbl}>Invoiced</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: COLORS.accent }]}>
              {formatINR(collected)}
            </Text>
            <Text style={styles.summaryLbl}>Collected</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: COLORS.warning }]}>
              {formatINR(pending)}
            </Text>
            <Text style={styles.summaryLbl}>Pending</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[
              styles.summaryVal,
              { color: profit >= 0 ? COLORS.success : COLORS.danger },
            ]}>
              {formatINR(Math.abs(profit))}
            </Text>
            <Text style={styles.summaryLbl}>
              {profit >= 0 ? 'Profit' : 'Loss'}
            </Text>
          </View>
        </View>

        {/* ── Empty state ───────────────────────────────────── */}
        {invoiceCount === 0 && !refreshing && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🚀</Text>
            <Text style={styles.emptyTitle}>Welcome to Locas!</Text>
            <Text style={styles.emptySub}>Create your first invoice to get started</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })}
            >
              <Text style={styles.emptyBtnText}>Create Invoice</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ─── Sub components ───────────────────────────────────────────────

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

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  statusBarBg: {
    backgroundColor: COLORS.card,
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
  greeting:    { fontSize: 18, fontWeight: FONTS.bold,  color: COLORS.text },
  monthLabel:  { fontSize: 13, color: COLORS.textSub, marginTop: 2 },
  settingsBtn: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  settingsIcon: { fontSize: 20 },

  scroll: { padding: 16 },

  // ── KPI ──────────────────────────────────────────────────────
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
    width: 36, height: 36, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  kpiIcon:  { fontSize: 18 },
  kpiValue: { fontSize: 20, fontWeight: FONTS.heavy, marginBottom: 2 },
  kpiLabel: { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.text },
  kpiSub:   { fontSize: 11, color: COLORS.textMute, marginTop: 2 },

  // ── Expense strip ─────────────────────────────────────────────
  expenseStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 20, ...SHADOW.sm,
    borderLeftWidth: 3, borderLeftColor: COLORS.danger,
  },
  expenseStripLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  expenseStripIcon:  { fontSize: 24 },
  expenseStripLabel: { fontSize: 12, color: COLORS.textSub, fontWeight: FONTS.medium },
  expenseStripValue: { fontSize: 16, fontWeight: FONTS.heavy, color: COLORS.danger, marginTop: 2 },
  expenseStripArrow: { fontSize: 18, color: COLORS.textMute },

  // ── Section ───────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 15, fontWeight: FONTS.bold,
    color: COLORS.text, marginBottom: 12, marginTop: 4,
  },

  // ── Quick actions ─────────────────────────────────────────────
  actionsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, marginBottom: 20,
  },
  qaBtn: {
    width: '30.5%', alignItems: 'center',
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    paddingVertical: 14, ...SHADOW.sm,
  },
  qaIconBox: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  qaIcon:  { fontSize: 22 },
  qaLabel: {
    fontSize: 11, fontWeight: FONTS.semibold,
    color: COLORS.text, textAlign: 'center',
  },

  // ── Top customers ─────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: 4, marginBottom: 16, ...SHADOW.sm,
  },
  topRow: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
  },
  topRowBorder: {
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  topRank: {
    width: 28, height: 28, borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  topRankText: { fontSize: 12, fontWeight: FONTS.bold, color: COLORS.primary },
  topName:     { flex: 1, fontSize: 14, fontWeight: FONTS.medium, color: COLORS.text },
  topAmt:      { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text },

  // ── Summary strip ─────────────────────────────────────────────
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.lg, padding: 16,
    marginBottom: 16, ...SHADOW.sm,
  },
  summaryItem:    { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 4 },
  summaryVal:     { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.white, marginBottom: 4 },
  summaryLbl:     { fontSize: 10, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },

  // ── Empty state ───────────────────────────────────────────────
  emptyState: {
    alignItems: 'center', paddingVertical: 32,
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 16, ...SHADOW.sm,
  },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 6 },
  emptySub:   { fontSize: 13, color: COLORS.textMute, marginBottom: 20, textAlign: 'center', paddingHorizontal: 24 },
  emptyBtn:   { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.lg },
  emptyBtnText:{ color: COLORS.white, fontWeight: FONTS.bold, fontSize: 15 },
});