/**
 * LOCAS App Entry Point
 * 
 * Phase Flow:
 *   splash → (check license) → login OR ready
 *   
 * Login is ONLY shown when:
 *   - First time (no cache)
 *   - App updated
 *   - Device changed  
 *   - Cache cleared
 *   - License expired/blocked
 * 
 * Normal daily use = NO login screen!
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing, Image, TouchableOpacity,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { getDB, exportAllData, migrateFromIndexedDBIfNeeded } from './src/db';
import { checkIfLoginRequired, getLicenseStatus } from './src/utils/licenseSystem';
import { getCurrentUser, signOut } from './src/utils/firebase/firebaseAuth';
import LoginScreen from './src/screens/Auth/LoginScreen';
import DeviceLimitScreen from './src/screens/Auth/DeviceLimitScreen';
import AppNavigator from './src/navigation/AppNavigator';

const BRAND = '#FF6B00';
const DARK = '#1A1A2E';
const LIGHT = '#FFF8F4';

export default function App() {
  // Phases: splash | login | device_limit | ready | error
  const [phase, setPhase] = useState('splash');
  const [loginInfo, setLoginInfo] = useState(null);
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [deviceLimitInfo, setDeviceLimitInfo] = useState(null);
  const [error, setError] = useState(null);
  const [splashDone, setSplashDone] = useState(false);
  const [initDone, setInitDone] = useState(false);
  const initResult = useRef(null);

  // Animations
  const iconScale = useRef(new Animated.Value(0.6)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.5)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  // Run splash animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(ringScale, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ringOpacity, { toValue: 0.15, duration: 500, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.spring(iconScale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
        Animated.timing(iconOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }, 200);

    setTimeout(() => {
      Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 600);

    setTimeout(() => {
      Animated.timing(tagOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 900);

    // Minimum splash time
    setTimeout(() => {
      setSplashDone(true);
    }, 2000);
  }, []);

  // Initialize app
  useEffect(() => {
    const init = async () => {
      try {
        // 0. Migrate legacy IndexedDB data → new JSON files (one-time, silent)
        await migrateFromIndexedDBIfNeeded();

        // 1. Init DB
        await getDB();

        // 2. Silent backup (if enabled)
        try {
          const { shouldRunDailyBackup, getToken, uploadBackup } = await import('./src/utils/googleDrive');
          if (await shouldRunDailyBackup()) {
            const token = await getToken();
            if (token) await uploadBackup(token, await exportAllData());
          }
        } catch (_) {}

        // 3. Check login (NO Firebase - uses cache)
        const loginCheck = await checkIfLoginRequired();

        // Store result
        initResult.current = { success: true, loginCheck };
        setInitDone(true);

      } catch (e) {
        console.error('Init error:', e);
        initResult.current = { success: false, error: e.message };
        setInitDone(true);
      }
    };

    init();
  }, []);

  // When both splash and init are done, transition to next phase
  useEffect(() => {
    if (splashDone && initDone) {
      // Fade out splash
      Animated.timing(fadeOut, { 
        toValue: 0, 
        duration: 500, 
        useNativeDriver: true 
      }).start(() => {
        // Handle result after animation completes
        handleInitResult();
      });
    }
  }, [splashDone, initDone]);

  // Handle init result
  const handleInitResult = async () => {
    if (!initResult.current.success) {
      setError(initResult.current.error);
      setPhase('error');
      return;
    }

    const { loginCheck } = initResult.current;

    if (loginCheck.required) {
      setLoginInfo(loginCheck);
      setPhase('login');
    } else {
      try {
        const status = await getLicenseStatus();
        setLicenseStatus(status);
      } catch (_) {}
      setPhase('ready');
    }
  };

  // Handle login success
  const handleLoginSuccess = async (license) => {
    try {
      const status = await getLicenseStatus();
      setLicenseStatus(status);
    } catch (_) {}
    setPhase('ready');
  };

  // Handle device limit reached
  const handleDeviceLimitReached = (info) => {
    const user = getCurrentUser();
    setDeviceLimitInfo({
      ...info,
      userId: user?.uid,
    });
    setPhase('device_limit');
  };

  // Handle device removed (retry login)
  const handleDeviceRemoved = async () => {
    // Re-try the login flow
    setPhase('login');
  };

  // Handle cancel from device limit screen (sign out)
  const handleDeviceLimitCancel = async () => {
    try {
      await signOut();
    } catch (_) {}
    setPhase('login');
  };

  // Retry handler
  const handleRetry = () => {
    setError(null);
    setPhase('splash');
    setSplashDone(false);
    setInitDone(false);
    initResult.current = null;
    
    // Reset animations
    fadeOut.setValue(1);
    iconScale.setValue(0.6);
    iconOpacity.setValue(0);
    textOpacity.setValue(0);
    tagOpacity.setValue(0);
    ringScale.setValue(0.5);
    ringOpacity.setValue(0);
  };

  // ─── ERROR SCREEN ───────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View style={styles.errorScreen}>
            <StatusBar style="dark" />
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Failed to start</Text>
            <Text style={styles.errorMsg}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.8}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // ─── DEVICE LIMIT SCREEN ────────────────────────────────────────────────
  if (phase === 'device_limit' && deviceLimitInfo) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <DeviceLimitScreen
            license={deviceLimitInfo.license}
            devices={deviceLimitInfo.devices}
            userId={deviceLimitInfo.userId}
            onDeviceRemoved={handleDeviceRemoved}
            onCancel={handleDeviceLimitCancel}
          />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // ─── LOGIN SCREEN ───────────────────────────────────────────────────────
  if (phase === 'login') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <LoginScreen 
            loginInfo={loginInfo} 
            onSuccess={handleLoginSuccess}
            onDeviceLimitReached={handleDeviceLimitReached}
          />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // ─── MAIN APP ───────────────────────────────────────────────────────────
  if (phase === 'ready') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <NavigationContainer>
            <AppNavigator licenseStatus={licenseStatus} />
          </NavigationContainer>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // ─── SPLASH SCREEN ──────────────────────────────────────────────────────
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Animated.View style={[styles.splash, { opacity: fadeOut }]}>
        <StatusBar style="light" />

        {/* Background grid lines — subtle depth */}
        <View style={styles.gridOverlay} pointerEvents="none">
          {[0,1,2,3,4].map(i => <View key={i} style={[styles.gridLine, { left: `${i * 25}%` }]} />)}
        </View>

        {/* Outer glow ring */}
        <Animated.View style={[styles.glowRing, {
          transform: [{ scale: ringScale }],
          opacity: ringOpacity,
        }]} />

        {/* Center wordmark */}
        <Animated.View style={[styles.centerBlock, {
          transform: [{ scale: iconScale }],
          opacity: iconOpacity,
        }]}>
          {/* Locas. wordmark */}
          <Text style={styles.wordmark}>
            Locas<Text style={styles.wordmarkDot}>.</Text>
          </Text>
          {/* Thin accent bar */}
          <View style={styles.accentBar} />
        </Animated.View>

        {/* Tagline */}
        <Animated.Text style={[styles.tagline, { opacity: tagOpacity }]}>
          Smart GST Billing for India
        </Animated.Text>

        {/* Bottom badge */}
        <Animated.View style={[styles.bottomBadge, { opacity: tagOpacity }]}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeTxt}>by Locastitch</Text>
        </Animated.View>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#0C0C0D',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  // subtle vertical grid lines
  gridOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  gridLine: {
    position: 'absolute', top: 0, bottom: 0,
    width: 1, backgroundColor: 'rgba(255,255,255,0.03)',
  },

  // large faint glow ring behind wordmark
  glowRing: {
    position: 'absolute',
    width: 420, height: 420, borderRadius: 210,
    backgroundColor: BRAND,
    opacity: 0.07,
  },

  // wordmark block
  centerBlock: {
    alignItems: 'center',
    marginBottom: 20,
  },
  wordmark: {
    fontSize: 64,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -2,
  },
  wordmarkDot: {
    color: BRAND,
  },
  accentBar: {
    width: 32, height: 3, borderRadius: 2,
    backgroundColor: BRAND,
    marginTop: 10,
  },

  tagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 2.5,
    fontWeight: '500',
    textTransform: 'uppercase',
    marginBottom: 0,
  },

  bottomBadge: {
    position: 'absolute', bottom: 44,
    flexDirection: 'row', alignItems: 'center', gap: 7,
  },
  badgeDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: BRAND, opacity: 0.7,
  },
  badgeTxt: {
    fontSize: 11, color: 'rgba(255,255,255,0.25)',
    fontWeight: '500', letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // keep dotMid for any remaining reference
  dotMid: {
    width: 10,
    height: 10,
    borderRadius: 5, 
    opacity: 0.8 
  },
  errorScreen: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 32, 
    backgroundColor: LIGHT 
  },
  errorIcon: { 
    fontSize: 48, 
    marginBottom: 12 
  },
  errorTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: DARK, 
    marginBottom: 8 
  },
  errorMsg: { 
    fontSize: 14, 
    color: '#888', 
    textAlign: 'center',
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: BRAND,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});