import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { getDB } from './src/db/db';
import AppNavigator from './src/navigation/AppNavigator';
import { COLORS } from './src/theme';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDB()
      .then(() => setReady(true))
      .catch(e => setError(e.message));
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Failed to start</Text>
        <Text style={styles.errorMsg}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.splash}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>L</Text>
        </View>
        <Text style={styles.brandName}>Locas</Text>
        <Text style={styles.brandSub}>Smart Billing for India</Text>
        <ActivityIndicator color={COLORS.white} size="large" style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" backgroundColor={COLORS.bg} />
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 44,
    fontWeight: '800',
    color: COLORS.primary,
  },
  brandName: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 2,
  },
  brandSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 6,
    letterSpacing: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: COLORS.bg,
  },
  errorIcon:  { fontSize: 48, marginBottom: 12 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  errorMsg:   { fontSize: 14, color: COLORS.textSub, textAlign: 'center' },
});