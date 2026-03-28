import Icon from '../../utils/Icon';
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image, StatusBar,
} from 'react-native';
import { signIn } from '../../utils/firebase/firebaseAuth';
import { getDataOwner, setDataOwner } from '../../db';
import { COLORS, RADIUS, FONTS, SHADOW } from '../../theme';

const BRAND = '#FF6B00';
const DARK  = '#1A1A2E';

export default function LoginScreen({ onLoginSuccess }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError]       = useState('');
  const [ownerEmail, setOwnerEmail] = useState(null); // The email that owns this data

  // On mount, check if this database has an owner
  useEffect(() => {
    checkOwnership();
  }, []);

  const checkOwnership = async () => {
    try {
      const owner = await getDataOwner();
      setOwnerEmail(owner);
    } catch (e) {
      console.error('Failed to check ownership:', e);
    } finally {
      setChecking(false);
    }
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    
    if (!trimmedEmail || !password.trim()) {
      setError('Please enter email and password');
      return;
    }

    // If data has an owner, only that owner can login
    if (ownerEmail && ownerEmail !== trimmedEmail) {
      setError(`This data belongs to ${ownerEmail}. Please login with that account.`);
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      // Step 1: Verify with Firebase (this is the license check)
      await signIn(trimmedEmail, password);
      
      // Step 2: If this is fresh data (no owner), lock it to this user
      if (!ownerEmail) {
        await setDataOwner(trimmedEmail);
        console.log('Data ownership set to:', trimmedEmail);
      }
      
      // Step 3: Notify parent that login succeeded
      if (onLoginSuccess) {
        onLoginSuccess(trimmedEmail);
      }
      
    } catch (e) {
      switch (e.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError('Invalid email or password');
          break;
        case 'auth/user-disabled':
          setError('Your license has been revoked. Contact support.');
          break;
        case 'auth/too-many-requests':
          setError('Too many attempts. Please try again later.');
          break;
        case 'auth/network-request-failed':
          setError('No internet connection. Internet is required to verify your license.');
          break;
        default:
          setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={BRAND} />
        <Text style={{ marginTop: 12, color: COLORS.textMute }}>Checking license...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F4" />

      {/* Logo */}
      <View style={styles.logoWrap}>
        <View style={styles.logoBox}>
          <View style={styles.textLogoBox}>
            <Text style={styles.textLogo}>L</Text>
          </View>
        </View>
        <Text style={styles.brandName}>LOCAS</Text>
        <Text style={styles.brandSub}>Smart Billing for India</Text>
      </View>

      {/* Card */}
      <View style={styles.card}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          {ownerEmail 
            ? `Sign in as ${ownerEmail}` 
            : 'Sign in with your licensed account'}
        </Text>

        {/* License Info Banner */}
        {ownerEmail && (
          <View style={styles.ownerBanner}>
            <Icon name="lock" size={14} color={COLORS.info} />
            <Text style={styles.ownerBannerText}>
              This data is licensed to: {ownerEmail}
            </Text>
          </View>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Icon name="alert-circle" size={14} color="#991B1B" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder={ownerEmail || "your@email.com"}
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

        <Text style={styles.footer}>
          Internet connection required for license verification
        </Text>
      </View>

      {/* Bottom Note */}
      <View style={styles.bottomNote}>
        <Icon name="shield" size={14} color={COLORS.textMute} />
        <Text style={styles.bottomNoteText}>
          Your data is encrypted and stored locally
        </Text>
      </View>
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
    marginBottom: 24,
  },
  logoBox: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  textLogoBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  textLogo: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
  },
  brandName: {
    fontSize: 11,
    color: COLORS.textMute,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  brandSub: {
    fontSize: 12,
    color: COLORS.textMute,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: RADIUS.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: 24,
    fontWeight: FONTS.black,
    color: COLORS.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMute,
    marginBottom: 20,
  },
  ownerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.infoLight,
    padding: 12,
    borderRadius: RADIUS.md,
    marginBottom: 16,
  },
  ownerBannerText: {
    fontSize: 12,
    color: COLORS.info,
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: FONTS.bold,
    color: COLORS.textSub,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: COLORS.text,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerLight,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.danger,
    flex: 1,
  },
  loginBtn: {
    backgroundColor: BRAND,
    borderRadius: RADIUS.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  loginBtnText: {
    color: '#fff',
    fontWeight: FONTS.black,
    fontSize: 15,
  },
  footer: {
    fontSize: 11,
    color: COLORS.textMute,
    textAlign: 'center',
    marginTop: 16,
  },
  bottomNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
  },
  bottomNoteText: {
    fontSize: 12,
    color: COLORS.textMute,
  },
});