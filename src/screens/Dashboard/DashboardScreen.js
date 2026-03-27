import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar, Image, Linking, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from '../../utils/Icon';
import { getDashboardStats, getProfile } from '../../db';
import { COLORS, SHADOW, RADIUS, FONTS } from '../../theme';
import { formatINRCompact, formatINR } from '../../utils/gst';

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [stats, setStats]           = useState(null);
  const [profile, setProfile]       = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [apkUpdate, setApkUpdate]   = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = async () => {
    try {
      const [data, prof] = await Promise.all([getDashboardStats(), getProfile()]);
      setStats(data); setProfile(prof);
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('https://raw.githubusercontent.com/operman-code/locas/main/version.json', { cache: 'no-store' });
        if (res.ok) {
          const remote = await res.json();
          let current = '0';
          try { current = require('../../../app.json').expo.version; } catch(_) {}
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
  const hour       = now.getHours();
  const greeting   = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const collected    = stats?.collected?.total   || 0;
  const expenses     = stats?.expenses?.total    || 0;
  const invoiced     = stats?.sales?.total       || 0;
  const pending      = stats?.receivables?.total || 0;
  const payables     = stats?.payables?.total    || 0;
  const profit       = collected - expenses;
  const invoiceCount = stats?.sales?.count       || 0;

  const QUICK_ACTIONS = [
    { icon: 'file-plus',  label: 'New Invoice', color: COLORS.primary, nav: () => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' }) },
    { icon: 'users',      label: 'Parties',     color: '#2563EB',      nav: () => navigation.navigate('PartiesTab') },
    { icon: 'package',    label: 'Items',       color: '#16A34A',      nav: () => navigation.navigate('Inventory') },
    { icon: 'credit-card',label: 'Expenses',    color: COLORS.danger,  nav: () => navigation.navigate('More', { screen: 'Expenses' }) },
    { icon: 'bar-chart-2',label: 'Reports',     color: '#7C3AED',      nav: () => navigation.navigate('More', { screen: 'Reports' }) },
    { icon: 'settings',   label: 'Settings',    color: COLORS.textSub, nav: () => navigation.navigate('More', { screen: 'Settings' }) },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.secondary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoWrap}>
            <Image source={require('../../../assets/icon.png')} style={styles.logoImg} resizeMode="contain" />
          </View>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.bizName} numberOfLines={1}>{profile?.name || 'LOCAS'}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.navigate('More', { screen: 'Settings' })}
        >
          <Icon name="settings" size={18} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.scroll}
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          <Text style={styles.periodLabel}>{monthName} {year}</Text>

          {/* Hero card */}
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>Total Collected</Text>
                <Text style={styles.heroAmount}>{formatINR(collected)}</Text>
                <Text style={styles.heroSub}>{invoiceCount} invoice{invoiceCount !== 1 ? 's' : ''} · {monthName}</Text>
              </View>
              <View style={[styles.plBadge, { backgroundColor: profit >= 0 ? 'rgba(22,163,74,0.18)' : 'rgba(220,38,38,0.18)' }]}>
                <Icon name={profit >= 0 ? 'trending-up' : 'trending-down'} size={14} color={profit >= 0 ? '#4ADE80' : '#F87171'} />
                <Text style={[styles.plValue, { color: profit >= 0 ? '#4ADE80' : '#F87171' }]}>
                  {formatINRCompact(Math.abs(profit))}
                </Text>
                <Text style={styles.plLabel}>{profit >= 0 ? 'Net Profit' : 'Net Loss'}</Text>
              </View>
            </View>

            <View style={styles.heroDivider} />

            <View style={styles.heroMetrics}>
              <HeroMetric label="Invoiced" value={formatINRCompact(invoiced)} color="#FFB347" />
              <View style={styles.metricSep} />
              <HeroMetric label="Pending"  value={formatINRCompact(pending)}  color="#F87171" />
              <View style={styles.metricSep} />
              <HeroMetric label="Expenses" value={formatINRCompact(expenses)} color="#94A3B8" />
            </View>
          </View>

          {/* Balance row */}
          <View style={styles.balanceRow}>
            <BalanceCard
              icon="arrow-up-right" label="Receivables" sub="Customers owe you"
              value={formatINR(pending)}   color={COLORS.danger} bg={COLORS.dangerLight}
              onPress={() => navigation.navigate('InvoicesTab')}
            />
            <BalanceCard
              icon="arrow-down-left" label="Payables" sub="You owe suppliers"
              value={formatINR(payables)}  color={COLORS.info}   bg={COLORS.infoLight}
              onPress={() => navigation.navigate('More', { screen: 'Reports' })}
            />
          </View>

          {/* Quick actions */}
          <SectionHeader title="Quick Actions" />
          <View style={styles.actionsGrid}>
            {QUICK_ACTIONS.map(a => (
              <TouchableOpacity key={a.label} style={styles.qaCard} onPress={a.nav} activeOpacity={0.8}>
                <View style={[styles.qaIconBox, { backgroundColor: a.color + '15' }]}>
                  <Icon name={a.icon} size={20} color={a.color} />
                </View>
                <Text style={styles.qaLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Top customers */}
          {stats?.topCustomers?.length > 0 && (
            <>
              <SectionHeader title="Top Customers" right={monthName} />
              <View style={styles.tableCard}>
                {stats.topCustomers.map((c, i) => (
                  <View key={i} style={[styles.tableRow, i < stats.topCustomers.length - 1 && styles.tableRowBorder]}>
                    <View style={[styles.rankPin, i === 0 && styles.rankPinGold]}>
                      <Text style={[styles.rankNum, i === 0 && styles.rankNumGold]}>{i + 1}</Text>
                    </View>
                    <Text style={styles.customerName} numberOfLines={1}>{c.party_name || 'Walk-in'}</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.customerAmt}>{formatINR(c.total)}</Text>
                      {i === 0 && <Text style={styles.topTag}>TOP</Text>}
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Financial summary */}
          <SectionHeader title="Financial Summary" />
          <View style={styles.summaryCard}>
            <SummaryRow label="Total Invoiced"  value={formatINR(invoiced)}  color={COLORS.text} />
            <SummaryRow label="Total Collected" value={formatINR(collected)} color={COLORS.success} />
            <SummaryRow label="Outstanding"     value={formatINR(pending)}   color={COLORS.danger} />
            <SummaryRow label="Total Expenses"  value={formatINR(expenses)}  color={COLORS.warning} />
            <View style={styles.summaryDivider} />
            <View style={styles.netRow}>
              <Text style={styles.netLabel}>Net {profit >= 0 ? 'Profit' : 'Loss'}</Text>
              <Text style={[styles.netValue, { color: profit >= 0 ? COLORS.success : COLORS.danger }]}>
                {formatINR(Math.abs(profit))}
              </Text>
            </View>
          </View>

          {/* Empty state */}
          {invoiceCount === 0 && !refreshing && (
            <View style={styles.emptyCard}>
              <View style={styles.emptyLogoWrap}>
                <Image source={require('../../../assets/icon.png')} style={styles.emptyLogo} resizeMode="contain" />
              </View>
              <Text style={styles.emptyTitle}>Welcome to Locas</Text>
              <Text style={styles.emptySub}>Smart billing for India.{'\n'}Create your first invoice to begin.</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('InvoicesTab', { screen: 'CreateInvoice' })}
                activeOpacity={0.85}
              >
                <Icon name="plus" size={16} color="#fff" />
                <Text style={styles.emptyBtnText}>Create Invoice</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 100 }} />
        </Animated.View>
      </ScrollView>

      {/* Update banner */}
      {apkUpdate && (
        <TouchableOpacity style={styles.updateBanner} onPress={() => Linking.openURL(apkUpdate.url)} activeOpacity={0.9}>
          <Icon name="download" size={14} color="#fff" />
          <Text style={styles.updateText}>Update v{apkUpdate.version} available</Text>
          <Text style={styles.updateCta}>Download</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function HeroMetric({ label, value, color }) {
  return (
    <View style={styles.heroMetric}>
      <Text style={[styles.heroMetricVal, { color }]}>{value}</Text>
      <Text style={styles.heroMetricLbl}>{label}</Text>
    </View>
  );
}

function BalanceCard({ icon, label, sub, value, color, bg, onPress }) {
  return (
    <TouchableOpacity style={styles.balCard} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.balIconWrap, { backgroundColor: bg }]}>
        <Icon name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.balLabel}>{label}</Text>
        <Text style={styles.balSub}>{sub}</Text>
      </View>
      <Text style={[styles.balValue, { color }]}>{value}</Text>
    </TouchableOpacity>
  );
}

function SectionHeader({ title, right }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right && <Text style={styles.sectionRight}>{right}</Text>}
    </View>
  );
}

function SummaryRow({ label, value, color }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 12,
    backgroundColor: COLORS.secondary,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  logoWrap: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', overflow: 'hidden',
  },
  logoImg:  { width: 28, height: 28 },
  greeting: { fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: FONTS.medium },
  bizName:  { fontSize: 16, fontWeight: FONTS.black, color: '#fff', maxWidth: 220 },
  headerBtn: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  scroll:      { paddingHorizontal: 16, paddingTop: 14 },
  periodLabel: { fontSize: 11, fontWeight: FONTS.semibold, color: COLORS.textMute, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 12 },
  heroCard:    { backgroundColor: COLORS.secondary, borderRadius: RADIUS.xl, padding: 20, marginBottom: 12, ...SHADOW.lg },
  heroTop:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 },
  heroLabel:   { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: FONTS.medium, marginBottom: 6 },
  heroAmount:  { fontSize: 30, fontWeight: FONTS.black, color: '#fff', letterSpacing: -0.5, marginBottom: 4 },
  heroSub:     { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  plBadge:     { alignItems: 'center', borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 10, gap: 3, minWidth: 80 },
  plValue:     { fontSize: 16, fontWeight: FONTS.black },
  plLabel:     { fontSize: 9, color: 'rgba(255,255,255,0.4)' },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 14 },
  heroMetrics: { flexDirection: 'row', alignItems: 'center' },
  heroMetric:  { flex: 1, alignItems: 'center' },
  heroMetricVal:{ fontSize: 14, fontWeight: FONTS.heavy, marginBottom: 3 },
  heroMetricLbl:{ fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  metricSep:   { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.08)' },
  balanceRow:  { flexDirection: 'row', gap: 10, marginBottom: 18 },
  balCard:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 12, ...SHADOW.sm, borderWidth: 1, borderColor: COLORS.border },
  balIconWrap: { width: 34, height: 34, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  balLabel:    { fontSize: 12, fontWeight: FONTS.bold, color: COLORS.text },
  balSub:      { fontSize: 10, color: COLORS.textMute, marginTop: 1 },
  balValue:    { fontSize: 12, fontWeight: FONTS.heavy },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 4 },
  sectionTitle:  { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text },
  sectionRight:  { fontSize: 12, color: COLORS.textMute },
  actionsGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  qaCard:   { width: '30.5%', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.lg, paddingVertical: 14, ...SHADOW.xs, borderWidth: 1, borderColor: COLORS.border },
  qaIconBox:{ width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  qaLabel:  { fontSize: 11, fontWeight: FONTS.semibold, color: COLORS.text, textAlign: 'center' },
  tableCard:     { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: 16, ...SHADOW.sm, borderWidth: 1, borderColor: COLORS.border },
  tableRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  tableRowBorder:{ borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rankPin:       { width: 26, height: 26, borderRadius: RADIUS.full, backgroundColor: COLORS.bgDeep, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rankPinGold:   { backgroundColor: '#FEF3C7' },
  rankNum:       { fontSize: 11, fontWeight: FONTS.heavy, color: COLORS.textSub },
  rankNumGold:   { color: '#B45309' },
  customerName:  { flex: 1, fontSize: 14, fontWeight: FONTS.semibold, color: COLORS.text },
  customerAmt:   { fontSize: 14, fontWeight: FONTS.heavy, color: COLORS.text },
  topTag:        { fontSize: 9, fontWeight: FONTS.black, color: COLORS.warning, letterSpacing: 0.5, marginTop: 2 },
  summaryCard:   { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 14, marginBottom: 16, ...SHADOW.sm, borderWidth: 1, borderColor: COLORS.border },
  summaryRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  summaryLabel:  { fontSize: 13, color: COLORS.textSub, fontWeight: FONTS.medium },
  summaryValue:  { fontSize: 13, fontWeight: FONTS.heavy },
  summaryDivider:{ height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  netRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  netLabel:  { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text },
  netValue:  { fontSize: 18, fontWeight: FONTS.black },
  emptyCard:     { alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: 32, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.sm },
  emptyLogoWrap: { width: 80, height: 80, borderRadius: RADIUS.xxl, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16, overflow: 'hidden' },
  emptyLogo:     { width: 56, height: 56 },
  emptyTitle:    { fontSize: 18, fontWeight: FONTS.black, color: COLORS.text, marginBottom: 8 },
  emptySub:      { fontSize: 13, color: COLORS.textMute, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn:      { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 13, borderRadius: RADIUS.lg, ...SHADOW.brand, flexDirection: 'row', alignItems: 'center', gap: 8 },
  emptyBtnText:  { color: '#fff', fontWeight: FONTS.bold, fontSize: 14 },
  updateBanner:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.success, paddingVertical: 11, paddingHorizontal: 16 },
  updateText:    { flex: 1, fontSize: 13, fontWeight: FONTS.semibold, color: '#fff' },
  updateCta:     { fontSize: 12, fontWeight: FONTS.bold, color: '#fff', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.sm },
});