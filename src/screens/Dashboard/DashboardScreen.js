import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar, Image, Linking, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getDashboardStats, getProfile } from '../../db';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';
import { formatINRCompact, formatINR } from '../../utils/gst';

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [stats, setStats]         = useState(null);
  const [profile, setProfile]     = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [apkUpdate, setApkUpdate] = useState(null);

  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const load = async () => {
    try {
      const [data, prof] = await Promise.all([getDashboardStats(), getProfile()]);
      setStats(data);
      setProfile(prof);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          'https://raw.githubusercontent.com/operman-code/locas/main/version.json',
          { cache: 'no-store' }
        );
        if (res.ok) {
          const remote = await res.json();
          const current = require('../../../app.json').expo.version;
          if (remote.version && remote.version !== current) {
            const url = remote.downloadPage || remote.url;
            if (url) setApkUpdate({ version: remote.version, url });
          }
        }
      } catch (_) {}
    })();
  }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  const now        = new Date();
  const monthName  = now.toLocaleString('en-IN', { month: 'long' });
  const year       = now.getFullYear();
  const greeting   = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  const collected    = stats?.collected?.total   || 0;
  const expenses     = stats?.expenses?.total    || 0;
  const invoiced     = stats?.sales?.total       || 0;
  const pending      = stats?.receivables?.total || 0;
  const payables     = stats?.payables?.total    || 0;
  const profit       = collected - expenses;
  const invoiceCount = stats?.sales?.count       || 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.secondary} />

      {/* ── Header ─────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBox}>
            <Image
              source={require('../../../assets/icon.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.bizName} numberOfLines={1}>
              {profile?.name || 'LOCAS'}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('More', { screen: 'Settings' })}
          >
            <Text style={styles.headerIconText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        contentContainerStyle={styles.scroll}
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ── Month label ─────────────────────────────── */}
          <Text style={styles.periodLabel}>{monthName} {year} Overview</Text>

          {/* ── Hero card ───────────────────────────────── */}
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.heroLabel}>Total Collected</Text>
                <Text style={styles.heroAmount}>{formatINR(collected)}</Text>
                <Text style={styles.heroSub}>
                  {invoiceCount} invoice{invoiceCount !== 1 ? 's' : ''} · {monthName}
                </Text>
              </View>
              <View style={[
                styles.profitBadge,
                { backgroundColor: profit >= 0 ? 'rgba(22,163,74,0.18)' : 'rgba(220,38,38,0.18)' }
              ]}>
                <Text style={[styles.profitIcon, { color: profit >= 0 ? '#4ADE80' : '#F87171' }]}>
                  {profit >= 0 ? '▲' : '▼'}
                </Text>
                <Text style={[styles.profitAmt, { color: profit >= 0 ? '#4ADE80' : '#F87171' }]}>
                  {formatINRCompact(Math.abs(profit))}
                </Text>
                <Text style={styles.profitLbl}>{profit >= 0 ? 'Net Profit' : 'Net Loss'}</Text>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.heroDivider} />

            {/* 3 stats row */}
            <View style={styles.heroStatsRow}>
              <HeroStat label="Invoiced"  value={formatINRCompact(invoiced)}  color="#FFB347" />
              <View style={styles.heroStatDivider} />
              <HeroStat label="Pending"   value={formatINRCompact(pending)}   color="#F87171" />
              <View style={styles.heroStatDivider} />
              <HeroStat label="Expenses"  value={formatINRCompact(expenses)}  color="#94A3B8" />
            </View>
          </View>

          {/* ── Receivables / Payables ───────────────────── */}
          <View style={styles.balanceRow}>
            <BalanceCard
              label="Receivables"
              sub="Customers owe you"
              value={formatINR(pending)}
              color={COLORS.danger}
              bgColor={COLORS.dangerLight}
              icon="↑"
              onPress={() => navigation.navigate('InvoicesTab')}
            />
            <BalanceCard
              label="Payables"
              sub="You owe suppliers"
              value={formatINR(payables)}
              color={COLORS.info}
              bgColor={COLORS.infoLight}
              icon="↓"
              onPress={() => navigation.navigate('More', { screen: 'Reports' })}
            />
          </View>

          {/* ── Quick Actions ────────────────────────────── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>
          <View style={styles.actionsGrid}>
            <QuickAction
              icon="🧾" label="New Invoice" accent={COLORS.primary}
              onPress={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })}
            />
            <QuickAction
              icon="👥" label="Parties" accent="#2563EB"
              onPress={() => navigation.navigate('PartiesTab')}
            />
            <QuickAction
              icon="📦" label="Items" accent="#16A34A"
              onPress={() => navigation.navigate('Inventory')}
            />
            <QuickAction
              icon="💸" label="Expenses" accent={COLORS.danger}
              onPress={() => navigation.navigate('More', { screen: 'Expenses' })}
            />
            <QuickAction
              icon="📊" label="Reports" accent="#7C3AED"
              onPress={() => navigation.navigate('More', { screen: 'Reports' })}
            />
            <QuickAction
              icon="⚙️" label="Settings" accent={COLORS.textSub}
              onPress={() => navigation.navigate('More', { screen: 'Settings' })}
            />
          </View>

          {/* ── Top Customers ───────────────────────────── */}
          {stats?.topCustomers?.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Top Customers</Text>
                <Text style={styles.sectionSub}>{monthName}</Text>
              </View>
              <View style={styles.topCard}>
                {stats.topCustomers.map((c, i) => (
                  <View key={i} style={[styles.topRow, i < stats.topCustomers.length - 1 && styles.topRowBorder]}>
                    <View style={[styles.rankBadge, i === 0 && styles.rankBadgeGold]}>
                      <Text style={[styles.rankText, i === 0 && styles.rankTextGold]}>#{i + 1}</Text>
                    </View>
                    <View style={styles.topCustomerInfo}>
                      <Text style={styles.topName} numberOfLines={1}>{c.party_name || 'Walk-in'}</Text>
                    </View>
                    <View style={styles.topAmtWrap}>
                      <Text style={styles.topAmt}>{formatINR(c.total)}</Text>
                      {i === 0 && <Text style={styles.topAmtSub}>Top buyer</Text>}
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ── Financial Summary ────────────────────────── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Financial Summary</Text>
          </View>
          <View style={styles.summaryCard}>
            <SummaryRow label="Total Invoiced"  value={formatINR(invoiced)}   valueColor={COLORS.text} />
            <SummaryRow label="Total Collected" value={formatINR(collected)}  valueColor={COLORS.success} />
            <SummaryRow label="Outstanding"     value={formatINR(pending)}    valueColor={COLORS.danger} />
            <SummaryRow label="Total Expenses"  value={formatINR(expenses)}   valueColor={COLORS.warning} />
            <View style={styles.summaryDividerH} />
            <View style={styles.summaryNetRow}>
              <Text style={styles.summaryNetLabel}>Net {profit >= 0 ? 'Profit' : 'Loss'}</Text>
              <Text style={[styles.summaryNetValue, { color: profit >= 0 ? COLORS.success : COLORS.danger }]}>
                {formatINR(Math.abs(profit))}
              </Text>
            </View>
          </View>

          {/* ── Empty state ──────────────────────────────── */}
          {invoiceCount === 0 && !refreshing && (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Text style={styles.emptyIcon}>🚀</Text>
              </View>
              <Text style={styles.emptyTitle}>Welcome to Locas!</Text>
              <Text style={styles.emptySub}>
                Your business dashboard is ready.{'\n'}Create your first invoice to get started.
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })}
                activeOpacity={0.85}
              >
                <Text style={styles.emptyBtnText}>+ Create First Invoice</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 100 }} />
        </Animated.View>
      </ScrollView>

      {/* ── APK Update Banner ─────────────────────────── */}
      {apkUpdate && (
        <TouchableOpacity
          style={styles.updateBanner}
          onPress={() => Linking.openURL(apkUpdate.url)}
          activeOpacity={0.9}
        >
          <View style={styles.updateBannerDot} />
          <Text style={styles.updateBannerText}>
            Update available — v{apkUpdate.version}
          </Text>
          <Text style={styles.updateBannerAction}>Download ↓</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function HeroStat({ label, value, color }) {
  return (
    <View style={styles.heroStat}>
      <Text style={[styles.heroStatVal, { color }]}>{value}</Text>
      <Text style={styles.heroStatLbl}>{label}</Text>
    </View>
  );
}

function BalanceCard({ label, sub, value, color, bgColor, icon, onPress }) {
  return (
    <TouchableOpacity style={styles.balanceCard} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.balanceIconWrap, { backgroundColor: bgColor }]}>
        <Text style={[styles.balanceIcon, { color }]}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.balanceLabel}>{label}</Text>
        <Text style={styles.balanceSub}>{sub}</Text>
      </View>
      <Text style={[styles.balanceValue, { color }]}>{value}</Text>
    </TouchableOpacity>
  );
}

function QuickAction({ icon, label, accent, onPress }) {
  return (
    <TouchableOpacity style={styles.qaBtn} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.qaIconBox, { backgroundColor: accent + '18' }]}>
        <Text style={styles.qaIcon}>{icon}</Text>
      </View>
      <Text style={styles.qaLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function SummaryRow({ label, value, valueColor }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryRowLabel}>{label}</Text>
      <Text style={[styles.summaryRowValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.secondary,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerRight: { flexDirection: 'row', gap: 8 },
  logoBox: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  logoImg:     { width: 28, height: 28 },
  greeting:    { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: FONTS.medium, letterSpacing: 0.3 },
  bizName:     { fontSize: 17, fontWeight: FONTS.black, color: '#fff', letterSpacing: 0.2, maxWidth: 220 },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  headerIconText: { fontSize: 17 },

  scroll:      { paddingHorizontal: 16, paddingTop: 16 },
  periodLabel: { fontSize: 12, fontWeight: FONTS.semibold, color: COLORS.textMute, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },

  // Hero card
  heroCard: {
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.xl,
    padding: 20,
    marginBottom: 14,
    ...SHADOW.lg,
  },
  heroTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  heroLabel:     { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: FONTS.medium, marginBottom: 6, letterSpacing: 0.3 },
  heroAmount:    { fontSize: 32, fontWeight: FONTS.black, color: '#fff', letterSpacing: -0.5, marginBottom: 4 },
  heroSub:       { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  profitBadge:   { alignItems: 'center', borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 10 },
  profitIcon:    { fontSize: 12, fontWeight: FONTS.black, marginBottom: 2 },
  profitAmt:     { fontSize: 18, fontWeight: FONTS.black },
  profitLbl:     { fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  heroDivider:   { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },
  heroStatsRow:  { flexDirection: 'row', alignItems: 'center' },
  heroStat:      { flex: 1, alignItems: 'center' },
  heroStatVal:   { fontSize: 15, fontWeight: FONTS.heavy, marginBottom: 3 },
  heroStatLbl:   { fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.3 },
  heroStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.1)' },

  // Balance cards
  balanceRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  balanceCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: 14, ...SHADOW.sm,
  },
  balanceIconWrap: { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  balanceIcon:     { fontSize: 18, fontWeight: FONTS.black },
  balanceLabel:    { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.text },
  balanceSub:      { fontSize: 10, color: COLORS.textMute, marginTop: 1 },
  balanceValue:    { fontSize: 14, fontWeight: FONTS.heavy },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 4 },
  sectionTitle:  { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text },
  sectionSub:    { fontSize: 12, color: COLORS.textMute, fontWeight: FONTS.medium },

  // Quick actions
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  qaBtn: {
    width: '30.5%', alignItems: 'center',
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    paddingVertical: 16, paddingHorizontal: 8,
    ...SHADOW.xs,
    borderWidth: 1, borderColor: COLORS.border,
  },
  qaIconBox: { width: 46, height: 46, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  qaIcon:    { fontSize: 22 },
  qaLabel:   { fontSize: 11, fontWeight: FONTS.semibold, color: COLORS.text, textAlign: 'center', lineHeight: 15 },

  // Top customers
  topCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 16, ...SHADOW.sm, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
  },
  topRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  topRowBorder:  { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rankBadge:     { width: 30, height: 30, borderRadius: RADIUS.full, backgroundColor: COLORS.bgDeep, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rankBadgeGold: { backgroundColor: '#FEF3C7' },
  rankText:      { fontSize: 11, fontWeight: FONTS.heavy, color: COLORS.textSub },
  rankTextGold:  { color: '#B45309' },
  topCustomerInfo: { flex: 1 },
  topName:       { fontSize: 14, fontWeight: FONTS.semibold, color: COLORS.text },
  topAmtWrap:    { alignItems: 'flex-end' },
  topAmt:        { fontSize: 14, fontWeight: FONTS.heavy, color: COLORS.text },
  topAmtSub:     { fontSize: 10, color: COLORS.warning, fontWeight: FONTS.medium, marginTop: 2 },

  // Financial summary
  summaryCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: 16, marginBottom: 16, ...SHADOW.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  summaryRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  summaryRowLabel: { fontSize: 14, color: COLORS.textSub, fontWeight: FONTS.medium },
  summaryRowValue: { fontSize: 14, fontWeight: FONTS.heavy },
  summaryDividerH: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  summaryNetRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 },
  summaryNetLabel: { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text },
  summaryNetValue: { fontSize: 18, fontWeight: FONTS.black },

  // Empty
  emptyCard: {
    alignItems: 'center', backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl, padding: 32, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOW.sm,
  },
  emptyIconWrap: { width: 72, height: 72, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyIcon:     { fontSize: 36 },
  emptyTitle:    { fontSize: 18, fontWeight: FONTS.black, color: COLORS.text, marginBottom: 8 },
  emptySub:      { fontSize: 13, color: COLORS.textMute, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn:      { backgroundColor: COLORS.primary, paddingHorizontal: 28, paddingVertical: 13, borderRadius: RADIUS.lg, ...SHADOW.brand },
  emptyBtnText:  { color: '#fff', fontWeight: FONTS.bold, fontSize: 15 },

  // Update banner
  updateBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.success,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  updateBannerDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  updateBannerText:   { flex: 1, fontSize: 13, fontWeight: FONTS.semibold, color: '#fff' },
  updateBannerAction: { fontSize: 13, fontWeight: FONTS.bold, color: '#fff', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.sm },
});
