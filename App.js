import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing, Image,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { getDB } from './src/db/db';
import AppNavigator from './src/navigation/AppNavigator';

const BRAND   = '#FF6B00';
const DARK    = '#1A1A2E';
const LIGHT   = '#FFF8F4';

export default function App() {
  const [phase, setPhase] = useState('splash'); // 'splash' | 'ready' | 'error'
  const [error, setError] = useState(null);

  // Animations
  const iconScale   = useRef(new Animated.Value(0.6)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const tagOpacity  = useRef(new Animated.Value(0)).current;
  const ringScale   = useRef(new Animated.Value(0.5)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const fadeOut     = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Step 1 — ring pulse in
    Animated.parallel([
      Animated.timing(ringScale,   { toValue: 1,   duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ringOpacity, { toValue: 0.15, duration: 500, useNativeDriver: true }),
    ]).start();

    // Step 2 — icon bounces in
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(iconScale, {
          toValue: 1, tension: 60, friction: 7, useNativeDriver: true,
        }),
        Animated.timing(iconOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }, 200);

    // Step 3 — brand name fades in
    setTimeout(() => {
      Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 600);

    // Step 4 — tagline fades in
    setTimeout(() => {
      Animated.timing(tagOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 900);

    // Step 5 — init DB in background
    getDB()
      .then(() => {
        // Wait minimum 2s for splash, then fade out
        setTimeout(() => {
          Animated.timing(fadeOut, {
            toValue: 0, duration: 500, useNativeDriver: true,
          }).start(() => setPhase('ready'));
        }, 2000);
      })
      .catch(e => {
        setError(e.message);
        setPhase('error');
      });
  }, []);

  if (phase === 'error') {
    return (
      <View style={s.errorScreen}>
        <Text style={s.errorIcon}>⚠️</Text>
        <Text style={s.errorTitle}>Failed to start</Text>
        <Text style={s.errorMsg}>{error}</Text>
      </View>
    );
  }

  if (phase === 'ready') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // Splash
  return (
    <Animated.View style={[s.splash, { opacity: fadeOut }]}>
      <StatusBar style="dark" />

      {/* Decorative rings */}
      <Animated.View style={[s.ring, s.ring1, {
        transform: [{ scale: ringScale }],
        opacity: ringOpacity,
      }]} />
      <Animated.View style={[s.ring, s.ring2, {
        transform: [{ scale: ringScale }],
        opacity: ringOpacity,
      }]} />

      {/* Icon box */}
      <Animated.View style={[s.iconWrap, {
        transform: [{ scale: iconScale }],
        opacity: iconOpacity,
      }]}>
        <View style={s.iconBox}>
          <Image
            source={require('./assets/icon.png')}
            style={s.iconImg}
            resizeMode="contain"
          />
        </View>
        {/* Subtle shadow ring */}
        <View style={s.iconShadow} />
      </Animated.View>

      {/* Brand name */}
      <Animated.View style={[s.brandWrap, { opacity: textOpacity }]}>
        <Text style={s.brandName}>LOCAS</Text>
        <View style={s.brandUnderline} />
      </Animated.View>

      {/* Tagline */}
      <Animated.Text style={[s.tagline, { opacity: tagOpacity }]}>
        Smart Billing for India
      </Animated.Text>

      {/* Bottom indicator */}
      <Animated.View style={[s.bottom, { opacity: tagOpacity }]}>
        <View style={s.dot} />
        <View style={[s.dot, s.dotMid]} />
        <View style={s.dot} />
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Decorative rings
  ring: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: BRAND,
  },
  ring1: {
    width: 320, height: 320,
  },
  ring2: {
    width: 220, height: 220,
    opacity: 0.08,
  },

  // Icon
  iconWrap: {
    alignItems: 'center',
    marginBottom: 32,
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
    elevation: 12,
  },
  iconImg: {
    width: 72,
    height: 72,
  },
  iconShadow: {
    position: 'absolute',
    bottom: -8,
    width: 60,
    height: 12,
    borderRadius: 30,
    backgroundColor: BRAND,
    opacity: 0.15,
  },

  // Brand
  brandWrap: {
    alignItems: 'center',
    marginBottom: 10,
  },
  brandName: {
    fontSize: 38,
    fontWeight: '900',
    color: DARK,
    letterSpacing: 10,
  },
  brandUnderline: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BRAND,
    marginTop: 6,
  },

  // Tagline
  tagline: {
    fontSize: 14,
    color: '#888',
    letterSpacing: 1.5,
    fontWeight: '500',
    marginBottom: 60,
  },

  // Dot loader
  bottom: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND,
    opacity: 0.3,
  },
  dotMid: {
    width: 10,
    height: 10,
    borderRadius: 5,
    opacity: 0.8,
  },

  // Error
  errorScreen: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, backgroundColor: LIGHT,
  },
  errorIcon:  { fontSize: 48, marginBottom: 12 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: DARK, marginBottom: 8 },
  errorMsg:   { fontSize: 14, color: '#888', textAlign: 'center' },
});
