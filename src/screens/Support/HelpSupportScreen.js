import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Platform, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../utils/Icon';
import { COLORS, RADIUS, FONTS } from '../../theme';

const SUPPORT_URL = 'https://locas-business.vercel.app/support.html';

export default function HelpSupportScreen({ navigation }) {
  const insets    = useSafeAreaInsets();
  const [loading, setLoading]   = useState(true);
  const [offline, setOffline]   = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const update = () => setOffline(!navigator.onLine);
      setOffline(!navigator.onLine);
      window.addEventListener('online',  update);
      window.addEventListener('offline', update);
      return () => {
        window.removeEventListener('online',  update);
        window.removeEventListener('offline', update);
      };
    }
  }, []);

  const handleRetry = () => {
    setRetrying(true);
    setOffline(!navigator.onLine);
    if (navigator.onLine) {
      setLoading(true);
      setRetryKey(k => k + 1);
    }
    setTimeout(() => setRetrying(false), 800);
  };

  // Web iframe renderer
  const IframeView = () => {
    const iframeRef = useRef(null);
    return React.createElement('iframe', {
      key: retryKey,
      ref: iframeRef,
      src: SUPPORT_URL,
      style: { flex: 1, border: 'none', width: '100%', height: '100%', display: 'block' },
      onLoad: () => setLoading(false),
      onError: () => { setLoading(false); setOffline(true); },
      title: 'LOCAS Support Portal',
    });
  };

  // Native WebView (lazy require)
  let NativeWebView = null;
  if (Platform.OS !== 'web') {
    try { NativeWebView = require('react-native-webview').WebView; } catch {}
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.card} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Help & Support</Text>
          <Text style={s.headerSub}>Submit a ticket · Track issues · Get help</Text>
        </View>
        {!offline && (
          <TouchableOpacity style={s.refreshBtn} onPress={handleRetry}>
            <Icon name="refresh-cw" size={16} color={COLORS.textSub} />
          </TouchableOpacity>
        )}
      </View>

      {/* Offline */}
      {offline ? (
        <View style={s.offlineWrap}>
          <View style={s.ringOuter}>
            <View style={s.ringMid}>
              <View style={s.ringInner}>
                <Icon name="wifi-off" size={30} color="#fff" />
              </View>
            </View>
          </View>

          <Text style={s.offlineTitle}>No Internet Connection</Text>
          <Text style={s.offlineSub}>
            The support portal needs internet to load.{'\n'}
            Check your connection and try again.
          </Text>

          <View style={s.tipsCard}>
            {[
              { icon: 'wifi',        text: 'Check your Wi-Fi connection' },
              { icon: 'smartphone',  text: 'Enable mobile data if Wi-Fi is off' },
              { icon: 'toggle-left', text: 'Toggle Airplane mode off and on' },
            ].map((tip, i) => (
              <View key={i} style={[s.tipRow, i < 2 && s.tipRowBorder]}>
                <View style={s.tipIconWrap}>
                  <Icon name={tip.icon} size={14} color={COLORS.primary} />
                </View>
                <Text style={s.tipText}>{tip.text}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[s.retryBtn, retrying && { opacity: 0.6 }]}
            onPress={handleRetry}
            disabled={retrying}
          >
            {retrying
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Icon name="refresh-cw" size={15} color="#fff" /><Text style={s.retryTxt}>  Try Again</Text></>
            }
          </TouchableOpacity>

          <Text style={s.altContact}>
            Or email us directly:{'\n'}
            <Text style={s.altEmail}>support@locas-business.vercel.app</Text>
          </Text>
        </View>
      ) : (
        /* WebView area */
        <View style={s.webWrap}>
          {loading && (
            <View style={s.loadingOverlay}>
              <View style={s.loadingCard}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={s.loadingTitle}>Loading Support Portal</Text>
                <Text style={s.loadingSubtitle}>locas-business.vercel.app</Text>
              </View>
            </View>
          )}

          {Platform.OS === 'web'
            ? <IframeView />
            : NativeWebView
              ? <NativeWebView
                  key={retryKey}
                  source={{ uri: SUPPORT_URL }}
                  style={{ flex: 1 }}
                  onLoadStart={() => setLoading(true)}
                  onLoadEnd={() => setLoading(false)}
                  onError={() => { setLoading(false); setOffline(true); }}
                  javaScriptEnabled
                  domStorageEnabled
                />
              : <View style={s.noSupport}>
                  <Icon name="alert-circle" size={28} color={COLORS.textMute} />
                  <Text style={s.noSupportTxt}>WebView not available</Text>
                </View>
          }
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header:      { flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:12, backgroundColor:COLORS.card, borderBottomWidth:1, borderBottomColor:COLORS.border },
  backBtn:     { padding:4, marginRight:10 },
  headerTitle: { fontSize:17, fontWeight:FONTS.black, color:COLORS.text },
  headerSub:   { fontSize:10, color:COLORS.textMute, marginTop:1 },
  refreshBtn:  { padding:8, borderRadius:RADIUS.md, backgroundColor:COLORS.bg },

  webWrap:        { flex:1 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor:COLORS.card, alignItems:'center', justifyContent:'center', zIndex:10 },
  loadingCard:    { alignItems:'center', padding:32, backgroundColor:COLORS.bg, borderRadius:RADIUS.xl, borderWidth:1, borderColor:COLORS.border },
  loadingTitle:   { fontSize:16, fontWeight:FONTS.bold, color:COLORS.text, marginTop:16, marginBottom:4 },
  loadingSubtitle:{ fontSize:12, color:COLORS.textMute },

  // Offline screen
  offlineWrap:  { flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:28, paddingBottom:32 },
  ringOuter:    { width:124, height:124, borderRadius:62, backgroundColor:'rgba(255,107,0,0.07)', alignItems:'center', justifyContent:'center', marginBottom:26 },
  ringMid:      { width:94,  height:94,  borderRadius:47, backgroundColor:'rgba(255,107,0,0.12)', alignItems:'center', justifyContent:'center' },
  ringInner:    { width:64,  height:64,  borderRadius:32, backgroundColor:COLORS.primary, alignItems:'center', justifyContent:'center' },
  offlineTitle: { fontSize:21, fontWeight:FONTS.black, color:COLORS.text, marginBottom:10, textAlign:'center' },
  offlineSub:   { fontSize:14, color:COLORS.textSub, textAlign:'center', lineHeight:22, marginBottom:28 },

  tipsCard:     { width:'100%', backgroundColor:COLORS.card, borderRadius:RADIUS.xl, borderWidth:1, borderColor:COLORS.border, overflow:'hidden', marginBottom:28 },
  tipRow:       { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:16, paddingVertical:13 },
  tipRowBorder: { borderBottomWidth:1, borderBottomColor:COLORS.border },
  tipIconWrap:  { width:32, height:32, borderRadius:10, backgroundColor:COLORS.primaryLight, alignItems:'center', justifyContent:'center', flexShrink:0 },
  tipText:      { fontSize:13, color:COLORS.textSub, flex:1 },

  retryBtn:  { flexDirection:'row', alignItems:'center', backgroundColor:COLORS.primary, paddingHorizontal:36, paddingVertical:14, borderRadius:RADIUS.lg, marginBottom:24 },
  retryTxt:  { fontSize:15, fontWeight:FONTS.bold, color:'#fff' },

  altContact: { fontSize:12, color:COLORS.textMute, textAlign:'center', lineHeight:20 },
  altEmail:   { color:COLORS.primary, fontWeight:FONTS.semibold },

  noSupport:    { flex:1, alignItems:'center', justifyContent:'center', gap:10 },
  noSupportTxt: { fontSize:13, color:COLORS.textMute },
});
