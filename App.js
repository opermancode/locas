import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing, Image, TouchableOpacity,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { getDB, exportAllData } from './src/db';
import { checkIfLoginRequired, getLicenseStatus } from './src/utils/licenseSystem';
import LoginScreen from './src/screens/Auth/LoginScreen';
import AppNavigator from './src/navigation/AppNavigator';

const BRAND = '#FF6B00';
const DARK = '#1A1A2E';
const LIGHT = '#FFF8F4';

export default function App() {
  const [phase, setPhase] = useState('splash'); // splash | login | ready | error
  const [loginInfo, setLoginInfo] = useState(null);
  const [licenseStatus, setLicenseStatus] = useState(null);
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
        // 1. Init DB
        await getDB();

        // 2. Silent backup
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

  // Handle init result (separate function to avoid async in animation callback)
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
  const handleLoginSuccess = async () => {
    try {
      const status = await getLicenseStatus();
      setLicenseStatus(status);
    } catch (_) {}
    setPhase('ready');
  };

  // ─── RETRY HANDLER ───────────────────────────────────────────────────────
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

  // ─── LOGIN SCREEN ───────────────────────────────────────────────────────
  if (phase === 'login') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <LoginScreen loginInfo={loginInfo} onSuccess={handleLoginSuccess} />
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
        <StatusBar style="dark" />

        {/* Rings */}
        <Animated.View style={[styles.ring, styles.ring1, { 
          transform: [{ scale: ringScale }], 
          opacity: ringOpacity 
        }]} />
        <Animated.View style={[styles.ring, styles.ring2, { 
          transform: [{ scale: ringScale }], 
          opacity: ringOpacity 
        }]} />

        {/* Icon */}
        <Animated.View style={[styles.iconWrap, { 
          transform: [{ scale: iconScale }], 
          opacity: iconOpacity 
        }]}>
          <View style={styles.iconBox}>
            <Image 
              source={require('./assets/icon.png')} 
              style={styles.iconImg} 
              resizeMode="contain" 
            />
          </View>
          <View style={styles.iconShadow} />
        </Animated.View>

        {/* Brand */}
        <Animated.View style={[styles.brandWrap, { opacity: textOpacity }]}>
          <Text style={styles.brandName}>LOCAS</Text>
          <View style={styles.brandUnderline} />
        </Animated.View>

        {/* Tagline */}
        <Animated.Text style={[styles.tagline, { opacity: tagOpacity }]}>
          Smart Billing for India
        </Animated.Text>

        {/* Dots */}
        <Animated.View style={[styles.bottom, { opacity: tagOpacity }]}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotMid]} />
          <View style={styles.dot} />
        </Animated.View>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: { 
    flex: 1, 
    backgroundColor: LIGHT, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  ring: { 
    position: 'absolute', 
    borderRadius: 999, 
    backgroundColor: BRAND 
  },
  ring1: { 
    width: 320, 
    height: 320 
  },
  ring2: { 
    width: 220, 
    height: 220, 
    opacity: 0.08 
  },
  iconWrap: { 
    alignItems: 'center', 
    marginBottom: 32 
  },
  iconBox: { 
    width: 100, 
    height: 100, 
    borderRadius: 28, 
    backgroundColor: '#fff', 
    alignItems: 'center', 
    justifyContent: 'center', 
    shadowColor: BRAND, 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.25, 
    shadowRadius: 20, 
    elevation: 12 
  },
  iconImg: { 
    width: 72, 
    height: 72 
  },
  iconShadow: { 
    position: 'absolute', 
    bottom: -8, 
    width: 60, 
    height: 12, 
    borderRadius: 30, 
    backgroundColor: BRAND, 
    opacity: 0.15 
  },
  brandWrap: { 
    alignItems: 'center', 
    marginBottom: 10 
  },
  brandName: { 
    fontSize: 38, 
    fontWeight: '900', 
    color: DARK, 
    letterSpacing: 10 
  },
  brandUnderline: { 
    width: 40, 
    height: 4, 
    borderRadius: 2, 
    backgroundColor: BRAND, 
    marginTop: 6 
  },
  tagline: { 
    fontSize: 14, 
    color: '#888', 
    letterSpacing: 1.5, 
    fontWeight: '500', 
    marginBottom: 60 
  },
  bottom: { 
    position: 'absolute', 
    bottom: 60, 
    flexDirection: 'row', 
    gap: 8, 
    alignItems: 'center' 
  },
  dot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3, 
    backgroundColor: BRAND, 
    opacity: 0.3 
  },
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