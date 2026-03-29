import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../utils/Icon';
import { signIn, sendPasswordResetEmail } from '../../utils/firebase/firebaseAuth';
import { verifyOnLogin } from '../../utils/licenseSystem';
import { COLORS, RADIUS, FONTS } from '../../theme';

const BRAND = '#FF6B00';

export default function LoginScreen({ loginInfo, onSuccess }) {
  const insets = useSafeAreaInsets();
  const dataOwner = loginInfo?.dataOwner;
  
  // Pre-fill email if data owner exists
  const [email, setEmail] = useState(dataOwner || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Update email when dataOwner changes
  useEffect(() => {
    if (dataOwner) {
      setEmail(dataOwner);
    }
  }, [dataOwner]);

  const getMessage = () => {
    switch (loginInfo?.reason) {
      case 'no_cache':
        return dataOwner 
          ? `This data belongs to ${dataOwner}` 
          : 'Sign in to continue';
      case 'owner_mismatch':
        return `This data belongs to ${dataOwner}`;
      case 'app_updated':
        return '🔄 App updated - please verify license';
      case 'device_changed':
        return '📱 New device - please verify license';
      case 'expired':
        return '⏰ License expired - please renew';
      case 'blocked':
        return '🚫 License revoked - contact support';
      default:
        return 'Sign in to continue';
    }
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    // Validation
    if (!trimmedEmail) {
      setError('Please enter email');
      return;
    }

    if (!trimmedPassword) {
      setError('Please enter password');
      return;
    }

    // Check if email matches data owner
    if (dataOwner && trimmedEmail !== dataOwner.toLowerCase()) {
      setError(`This data belongs to ${dataOwner}. You must login with that email.`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Step 1: Firebase Auth login
      await signIn(trimmedEmail, trimmedPassword);

      // Step 2: Verify license from Firebase claims
      await verifyOnLogin();

      // Step 3: Success - go to app
      if (onSuccess) {
        onSuccess();
      }

    } catch (e) {
      console.error('Login error:', e);

      // Handle different error types
      const errorCode = e.code || e.message;
      
      switch (errorCode) {
        case 'OWNER_MISMATCH':
          setError(`This data belongs to a different account.`);
          break;
        case 'BLOCKED':
          setError('Your license has been revoked. Contact support.');
          break;
        case 'LICENSE_EXPIRED':
          setError('Your license has expired. Please renew to continue.');
          break;
        case 'auth/user-not-found':
          setError('No account found with this email.');
          break;
        case 'auth/wrong-password':
          setError('Incorrect password.');
          break;
        case 'auth/invalid-credential':
          setError('Invalid email or password.');
          break;
        case 'auth/invalid-email':
          setError('Invalid email format.');
          break;
        case 'auth/user-disabled':
          setError('This account has been disabled. Contact support.');
          break;
        case 'auth/too-many-requests':
          setError('Too many failed attempts. Please try again later.');
          break;
        case 'auth/network-request-failed':
          setError('No internet connection. Please check your network.');
          break;
        default:
          setError(e.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      
      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>L</Text>
          </View>
          <Text style={styles.brandName}>LOCAS</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.subtitle}>{getMessage()}</Text>

          {/* Data Owner Banner */}
          {dataOwner && (
            <View style={styles.ownerBanner}>
              <Icon name="lock" size={14} color={BRAND} />
              <Text style={styles.ownerText}>
                Data locked to: <Text style={styles.ownerEmail}>{dataOwner}</Text>
              </Text>
            </View>
          )}

          {/* Error Message */}
          {error !== '' && (
            <View style={styles.errorBox}>
              <Icon name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Email Input */}
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[
              styles.input, 
              dataOwner && styles.inputLocked
            ]}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading && !dataOwner}
            selectTextOnFocus={!dataOwner}
          />
          {dataOwner && (
            <Text style={styles.lockedHint}>
              You must login with this email to access this data
            </Text>
          )}

          {/* Password Input */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              onSubmitEditing={handleLogin}
              returnKeyType="done"
            />
            <TouchableOpacity 
              style={styles.eyeBtn} 
              onPress={() => setShowPassword(!showPassword)}
              activeOpacity={0.7}
            >
              <Icon name={showPassword ? "eye-off" : "eye"} size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity 
            style={styles.forgotBtn}
            onPress={async () => {
              if (!email?.trim()) {
                Alert.alert('Enter Email', 'Please enter your email address first, then tap Forgot Password.');
                return;
              }
              try {
                await sendPasswordResetEmail(email.trim());
                Alert.alert(
                  'Password Reset Email Sent',
                  `We've sent a password reset link to ${email.trim()}. Check your inbox and spam folder.`
                );
              } catch (err) {
                const code = err.code || '';
                if (code === 'auth/user-not-found') {
                  Alert.alert('Account Not Found', 'No account exists with this email address.');
                } else if (code === 'auth/invalid-email') {
                  Alert.alert('Invalid Email', 'Please enter a valid email address.');
                } else {
                  Alert.alert('Error', err.message || 'Could not send password reset email. Please try again.');
                }
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.footer}>
            Internet connection required for verification
          </Text>
        </View>

        {/* Bottom Note */}
        <View style={styles.bottomNote}>
          <Icon name="shield" size={14} color="#9CA3AF" />
          <Text style={styles.bottomNoteText}>
            Your data is encrypted and stored locally
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFF8F4',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 24,
  },
  logoWrap: { 
    alignItems: 'center', 
    marginBottom: 24,
  },
  logoBox: { 
    width: 64, 
    height: 64, 
    borderRadius: 16, 
    backgroundColor: BRAND, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 12, 
    shadowColor: BRAND, 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 8, 
    elevation: 8,
  },
  logoText: { 
    fontSize: 36, 
    fontWeight: '800', 
    color: '#fff',
  },
  brandName: { 
    fontSize: 11, 
    color: '#6B7280', 
    letterSpacing: 2, 
    textTransform: 'uppercase',
  },
  card: { 
    width: '100%', 
    maxWidth: 400, 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    padding: 24, 
    borderWidth: 1, 
    borderColor: '#E5E7EB',
  },
  title: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#1F2937', 
    marginBottom: 4,
  },
  subtitle: { 
    fontSize: 14, 
    color: '#6B7280', 
    marginBottom: 20,
  },
  ownerBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    backgroundColor: '#FFF7ED', 
    padding: 12, 
    borderRadius: 10, 
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  ownerText: { 
    fontSize: 12, 
    color: '#C2410C', 
    flex: 1,
  },
  ownerEmail: { 
    fontWeight: '700',
  },
  label: { 
    fontSize: 11, 
    fontWeight: '600', 
    color: '#6B7280', 
    textTransform: 'uppercase', 
    letterSpacing: 0.6, 
    marginBottom: 8, 
    marginTop: 16,
  },
  input: { 
    backgroundColor: '#F9FAFB', 
    borderWidth: 1, 
    borderColor: '#E5E7EB', 
    borderRadius: 10, 
    paddingHorizontal: 14, 
    paddingVertical: 14, 
    fontSize: 15, 
    color: '#1F2937',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1F2937',
  },
  eyeBtn: {
    padding: 14,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: 12,
  },
  forgotText: {
    fontSize: 13,
    color: BRAND,
    fontWeight: '500',
  },
  inputLocked: { 
    backgroundColor: '#F3F4F6', 
    color: '#6B7280',
  },
  lockedHint: { 
    fontSize: 11, 
    color: '#9CA3AF', 
    marginTop: 6, 
    fontStyle: 'italic',
  },
  errorBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    backgroundColor: '#FEF2F2', 
    borderRadius: 10, 
    padding: 12, 
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { 
    fontSize: 13, 
    color: '#DC2626', 
    flex: 1,
  },
  loginBtn: { 
    backgroundColor: BRAND, 
    borderRadius: 10, 
    paddingVertical: 16, 
    alignItems: 'center', 
    marginTop: 24,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 16,
  },
  footer: { 
    fontSize: 11, 
    color: '#9CA3AF', 
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
    color: '#9CA3AF',
  },
});