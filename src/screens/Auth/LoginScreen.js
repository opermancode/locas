import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image, StatusBar,
} from 'react-native';
import { signIn } from '../../utils/firebaseAuth';
import { COLORS, RADIUS, FONTS, SHADOW } from '../../theme';

const BRAND = '#FF6B00';
const DARK  = '#1A1A2E';

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signIn(email.trim().toLowerCase(), password);
      // Auth state change in App.js will handle navigation automatically
    } catch (e) {
      switch (e.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError('Invalid email or password');
          break;
        case 'auth/user-disabled':
          setError('Your account has been disabled. Contact support.');
          break;
        case 'auth/too-many-requests':
          setError('Too many attempts. Please try again later.');
          break;
        case 'auth/network-request-failed':
          setError('No internet connection. Please check your network.');
          break;
        default:
          setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F4" />

      {/* Logo */}
      <View style={styles.logoWrap}>
        <View style={styles.logoBox}>
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.logoImg}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.brandName}>LOCAS</Text>
        <Text style={styles.brandSub}>Smart Billing for India</Text>
      </View>

      {/* Card */}
      <View style={styles.card}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          placeholderTextColor={COLORS.textMute}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={COLORS.textMute}
          secureTextEntry
          editable={!loading}
          onSubmitEditing={handleLogin}
          returnKeyType="done"
        />

        <TouchableOpacity
          style={[styles.loginBtn, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.loginBtnText}>Sign In</Text>
          }
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>Contact your administrator to get access</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F4',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 12,
  },
  logoImg: {
    width: 56,
    height: 56,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '900',
    color: DARK,
    letterSpacing: 8,
  },
  brandSub: {
    fontSize: 12,
    color: COLORS.textMute,
    letterSpacing: 1,
    marginTop: 4,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: RADIUS.xl,
    padding: 24,
    ...SHADOW.md,
  },
  title: {
    fontSize: 22,
    fontWeight: FONTS.heavy,
    color: DARK,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMute,
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: RADIUS.sm,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#991B1B',
  },
  label: {
    fontSize: 12,
    fontWeight: FONTS.semibold,
    color: COLORS.textSub,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  loginBtn: {
    backgroundColor: BRAND,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
    ...SHADOW.sm,
    shadowColor: BRAND,
    shadowOpacity: 0.35,
  },
  loginBtnText: {
    color: '#fff',
    fontWeight: FONTS.heavy,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  footer: {
    fontSize: 12,
    color: COLORS.textMute,
    marginTop: 24,
    textAlign: 'center',
  },
});
