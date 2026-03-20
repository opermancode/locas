import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getDashboardStats, getProfile } from '../../db/db';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';
import { formatINRCompact, formatINR } from '../../utils/gst';

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [stats, setStats]           = useState(null);
  const [profile, setProfile] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [data, prof] = await Promise.all([
        getDashboardStats(),
        getProfile(),
      ]);
      setStats(data);
      setProfile(prof);
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = () => { setRefreshing(true); load(); };

  const now       = new Date();
  const monthName = now.toLocaleString('en-IN', { month: 'long' });
  const year      = now.getFullYear();

  const collected    = stats?.collected?.total  || 0;
  const expenses     = stats?.expenses?.total   || 0;
  const invoiced     = stats?.sales?.total      || 0;
  const pending      = stats?.receivables?.total || 0;
  const profit       = collected - expenses;
  const invoiceCount = stats?.sales?.count      || 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.secondary} />

      {/* ── Header ─────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoMini}>
            <Image
              source={require('../../../assets/icon.png')}
              style={styles.logoMiniImg}
              resizeMode="contain"
            />
          </View>
          <View>
            {profile?.name ? (
              <>
                <Text style={styles.headerBrandSmall}>LOCAS</Text>
                <Text style={styles.headerBizName} numberOfLines={1}>
                  {profile.name}  ·  {monthName} {year}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.headerBrand}>LOCAS</Text>
                <Text style={styles.headerSub}>{monthName} {year}</Text>
              </>
            )}
          </View>
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        contentContainerStyle={styles.scroll}
      >

        {/* ── Hero total card ─────────────────────────── */}
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroLabel}>Total Collected</Text>
            <Text style={styles.heroValue}>{formatINR(collected)}</Text>
            <Text style={styles.heroSub}>{invoiceCount} invoice{invoiceCount !== 1 ? 's' : ''} this month</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroRight}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{formatINRCompact(pending)}</Text>
              <Text style={styles.heroStatLabel}>Pending</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatVal, { color: profit >= 0 ? '#4ADE80' : '#F87171' }]}>
                {formatINRCompact(Math.abs(profit))}
              </Text>
              <Text style={styles.heroStatLabel}>{profit >= 0 ? 'Profit' : 'Loss'}</Text>
            </View>
          </View>
        </View>

        {/* ── KPI Row ─────────────────────────────────── */}
        <View style={styles.kpiRow}>
          <KPICard
            label="Invoiced"
            value={formatINRCompact(invoiced)}
            sub="this month"
            color={COLORS.primary}
            icon="📈"
            onPress={() => navigation.navigate('InvoicesTab')}
          />
          <KPICard
            label="Expenses"
            value={formatINRCompact(expenses)}
            sub="this month"
            color={COLORS.danger}
            icon="💸"
            onPress={() => navigation.navigate('More', { screen: 'Expenses' })}
          />
        </View>

        {/* ── Quick Actions ────────────────────────────── */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <QuickAction icon="🧾" label="New Invoice"  color="#FFF0E6"
            onPress={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })} />
          <QuickAction icon="👥" label="Parties"      color="#E6F4FF"
            onPress={() => navigation.navigate('PartiesTab')} />
          <QuickAction icon="📦" label="Items"        color="#E6FFE6"
            onPress={() => navigation.navigate('Inventory')} />
          <QuickAction icon="💸" label="Expenses"     color="#FFE6E6"
            onPress={() => navigation.navigate('More', { screen: 'Expenses' })} />
          <QuickAction icon="📊" label="Reports"      color="#F3E6FF"
            onPress={() => navigation.navigate('More', { screen: 'Reports' })} />
          <QuickAction icon="⚙️" label="Settings"     color="#E6E6E6"
            onPress={() => navigation.navigate('More', { screen: 'Settings' })} />
        </View>

        {/* ── Top Customers ───────────────────────────── */}
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

        {/* ── Summary strip ───────────────────────────── */}
        <View style={styles.summaryCard}>
          <SummaryItem label="Invoiced"  value={formatINR(invoiced)}   color="#fff" />
          <View style={styles.summaryDivider} />
          <SummaryItem label="Collected" value={formatINR(collected)}  color={COLORS.accent} />
          <View style={styles.summaryDivider} />
          <SummaryItem label="Pending"   value={formatINR(pending)}    color="#FCD34D" />
          <View style={styles.summaryDivider} />
          <SummaryItem
            label={profit >= 0 ? 'Profit' : 'Loss'}
            value={formatINR(Math.abs(profit))}
            color={profit >= 0 ? '#4ADE80' : '#F87171'}
          />
        </View>

        {/* ── Empty state ──────────────────────────────── */}
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

function SummaryItem({ label, value, color }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryVal, { color }]}>{value}</Text>
      <Text style={styles.summaryLbl}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.secondary,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoMini:    {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  logoMiniImg: { width: 28, height: 28 },
  headerBrand: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 4 },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  headerBrandSmall: {
    fontSize: 11,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 4,
  },
  headerBizName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
    maxWidth: 220,
  },
  settingsBtn: {
    width: 38, height: 38, borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  settingsIcon: { fontSize: 18 },

  scroll: { padding: 16 },

  // Hero card
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOW.md,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.35,
  },
  heroLeft:      { flex: 1 },
  heroLabel:     { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 4, fontWeight: FONTS.medium },
  heroValue:     { fontSize: 28, fontWeight: FONTS.heavy, color: '#fff', marginBottom: 4 },
  heroSub:       { fontSize: 11, color: 'rgba(255,255,255,0.65)' },
  heroDivider:   { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', height: 60, marginHorizontal: 16 },
  heroRight:     { gap: 16 },
  heroStat:      { alignItems: 'flex-end' },
  heroStatVal:   { fontSize: 16, fontWeight: FONTS.heavy, color: '#fff' },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  // KPI
  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  kpiCard: {
    flex: 1, backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg, padding: 14, ...SHADOW.sm,
  },
  kpiIconBox: { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  kpiIcon:    { fontSize: 18 },
  kpiValue:   { fontSize: 20, fontWeight: FONTS.heavy, marginBottom: 2 },
  kpiLabel:   { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.text },
  kpiSub:     { fontSize: 11, color: COLORS.textMute, marginTop: 2 },

  // Section
  sectionTitle: { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 12, marginTop: 4 },

  // Quick actions
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  qaBtn:       { width: '30.5%', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.lg, paddingVertical: 14, ...SHADOW.sm },
  qaIconBox:   { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  qaIcon:      { fontSize: 22 },
  qaLabel:     { fontSize: 11, fontWeight: FONTS.semibold, color: COLORS.text, textAlign: 'center' },

  // Top customers
  card:          { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 4, marginBottom: 16, ...SHADOW.sm },
  topRow:        { flexDirection: 'row', alignItems: 'center', padding: 12 },
  topRowBorder:  { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  topRank:       { width: 28, height: 28, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  topRankText:   { fontSize: 12, fontWeight: FONTS.bold, color: COLORS.primary },
  topName:       { flex: 1, fontSize: 14, fontWeight: FONTS.medium, color: COLORS.text },
  topAmt:        { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text },

  // Summary
  summaryCard:    { flexDirection: 'row', backgroundColor: COLORS.secondary, borderRadius: RADIUS.lg, padding: 16, marginBottom: 8, ...SHADOW.sm },
  summaryItem:    { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 4 },
  summaryVal:     { fontSize: 13, fontWeight: FONTS.bold, marginBottom: 4 },
  summaryLbl:     { fontSize: 10, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },

  // Empty
  emptyState:   { alignItems: 'center', paddingVertical: 32, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, marginBottom: 16, ...SHADOW.sm },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyTitle:   { fontSize: 18, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 6 },
  emptySub:     { fontSize: 13, color: COLORS.textMute, marginBottom: 20, textAlign: 'center', paddingHorizontal: 24 },
  emptyBtn:     { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.lg },
  emptyBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 15 },
});
