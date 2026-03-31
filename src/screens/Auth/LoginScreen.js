/**
 * LoginScreen for LOCAS
 * 
 * Unified login screen that handles ALL scenarios:
 * - First time login (fresh start or upload data)
 * - App updated (re-verify license)
 * - New device (re-verify license)
 * - Data file moved (auto-detected)
 * - Device limit reached
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert, Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../utils/Icon';
import { signIn, sendPasswordResetEmail } from '../../utils/firebase/firebaseAuth';
import { verifyOnLogin } from '../../utils/licenseSystem';
import { 
  checkExistingDataFile, 
  lockDataFile, 
  pickDataFile, 
  importDataFile,
  deleteDataFile,
  verifyFileOwner,
  getStoredImportFile,
  clearStoredImportFile,
} from '../../utils/dataFileManager';
import { COLORS, RADIUS, FONTS } from '../../theme';

const BRAND = '#FF6B00';

// Login modes
const MODE = {
  FRESH: 'fresh',
  UPLOAD: 'upload',
  EXISTING: 'existing',       // Auto-detected file on disk
  APP_UPDATED: 'app_updated', // App updated, re-verify
  DEVICE_CHANGED: 'device_changed', // New device, re-verify
};

export default function LoginScreen({ loginInfo, onSuccess, onDeviceLimitReached }) {
  const insets = useSafeAreaInsets();
  
  // Get reason from loginInfo (passed from App.js)
  const loginReason = loginInfo?.reason; // 'no_cache' | 'app_updated' | 'device_changed' | 'owner_mismatch' | 'expired' | 'blocked'
  const dataOwnerFromCache = loginInfo?.dataOwner;
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Data file state
  const [checkingFile, setCheckingFile] = useState(true);
  const [existingFile, setExistingFile] = useState(null); // { exists, dataOwner }
  const [mode, setMode] = useState(MODE.FRESH);
  const [uploadedFile, setUploadedFile] = useState(null); // { dataOwner, fileUri }
  
  // Confirm dialog
  const [showConfirmFresh, setShowConfirmFresh] = useState(false);

  // Check for existing data file on mount
  useEffect(() => {
    checkForExistingFile();
  }, []);

  const checkForExistingFile = async () => {
    setCheckingFile(true);
    try {
      const result = await checkExistingDataFile();
      setExistingFile(result);
      
      // Determine mode based on loginReason and file state
      if (loginReason === 'app_updated') {
        setMode(MODE.APP_UPDATED);
        setEmail(dataOwnerFromCache || result.dataOwner || '');
      } else if (loginReason === 'device_changed') {
        setMode(MODE.DEVICE_CHANGED);
        setEmail(dataOwnerFromCache || result.dataOwner || '');
      } else if (result.exists && result.dataOwner) {
        // Auto-detected existing file
        setMode(MODE.EXISTING);
        setEmail(result.dataOwner);
      } else {
        // No file - check if user previously picked a file to import
        const storedImport = await getStoredImportFile();
        if (storedImport) {
          setUploadedFile(storedImport);
          setMode(MODE.UPLOAD);
          setEmail(storedImport.dataOwner);
        } else {
          // Fresh start
          setMode(MODE.FRESH);
          setEmail('');
        }
      }
    } catch (e) {
      console.error('Error checking file:', e);
    } finally {
      setCheckingFile(false);
    }
  };

  // Get title and subtitle based on mode
  const getHeaderContent = () => {
    switch (mode) {
      case MODE.APP_UPDATED:
        return {
          icon: 'refresh-cw',
          iconBg: COLORS.infoLight,
          iconColor: COLORS.info,
          title: 'App Updated',
          subtitle: 'Please verify your license to continue',
        };
      case MODE.DEVICE_CHANGED:
        return {
          icon: 'smartphone',
          iconBg: COLORS.infoLight,
          iconColor: COLORS.info,
          title: 'New Device',
          subtitle: 'Please verify your license to continue',
        };
      case MODE.EXISTING:
        return {
          icon: null,
          title: 'Welcome Back',
          subtitle: 'Sign in to your account',
        };
      case MODE.UPLOAD:
        return {
          icon: null,
          title: 'Welcome Back',
          subtitle: 'Sign in to import your data',
        };
      case MODE.FRESH:
      default:
        return {
          icon: null,
          title: 'Welcome',
          subtitle: 'Sign in to get started',
        };
    }
  };

  // Handle file upload
  const handlePickFile = async () => {
    try {
      const result = await pickDataFile();
      
      if (result.error === 'cancelled') return;
      
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to read file');
        return;
      }
      
      setUploadedFile({
        dataOwner: result.dataOwner,
        fileUri: result.fileUri,
      });
      setMode(MODE.UPLOAD);
      setEmail(result.dataOwner);
      setError('');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  // Clear uploaded file
  const handleClearUpload = async () => {
    await clearStoredImportFile();
    setUploadedFile(null);
    setMode(MODE.FRESH);
    setEmail('');
  };

  // Handle mode change
  const handleModeChange = (newMode) => {
    if (newMode === MODE.FRESH && uploadedFile) {
      // User uploaded file but wants fresh - confirm deletion
      setShowConfirmFresh(true);
      return;
    }
    
    setMode(newMode);
    setError('');
    
    if (newMode === MODE.UPLOAD && uploadedFile) {
      setEmail(uploadedFile.dataOwner);
    } else if (newMode === MODE.FRESH) {
      if (!existingFile?.exists) {
        setEmail('');
      }
    }
  };

  // Confirm fresh start (delete uploaded file)
  const confirmFreshStart = async () => {
    setShowConfirmFresh(false);
    await clearStoredImportFile();
    setUploadedFile(null);
    setMode(MODE.FRESH);
    setEmail('');
  };

  // Handle login
  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    
    // Validation
    if (!trimmedEmail) {
      setError('Please enter your email');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    // Verify email matches file owner (for existing/upload modes)
    if (mode === MODE.EXISTING && existingFile?.dataOwner) {
      if (!verifyFileOwner(trimmedEmail, existingFile.dataOwner)) {
        setError(`This device has data for ${existingFile.dataOwner}. Please login with that email or start fresh.`);
        return;
      }
    }
    
    if (mode === MODE.UPLOAD && uploadedFile?.dataOwner) {
      if (!verifyFileOwner(trimmedEmail, uploadedFile.dataOwner)) {
        setError(`The uploaded file belongs to ${uploadedFile.dataOwner}. Please login with that email.`);
        return;
      }
    }

    // For app_updated/device_changed, verify email matches cached owner
    if ((mode === MODE.APP_UPDATED || mode === MODE.DEVICE_CHANGED) && dataOwnerFromCache) {
      if (!verifyFileOwner(trimmedEmail, dataOwnerFromCache)) {
        setError(`This data belongs to ${dataOwnerFromCache}. Please login with that email.`);
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      // 1. Firebase Auth
      const user = await signIn(trimmedEmail, password);
      
      // 2. Verify license and check device limit
      let license;
      try {
        license = await verifyOnLogin();
      } catch (verifyError) {
        // Handle device limit reached
        if (verifyError.message === 'DEVICE_LIMIT_REACHED') {
          if (onDeviceLimitReached) {
            onDeviceLimitReached({
              license: verifyError.license,
              devices: verifyError.devices,
              maxDevices: verifyError.maxDevices,
            });
          }
          setLoading(false);
          return;
        }
        throw verifyError;
      }
      
      // 3. Handle data file based on mode
      if (mode === MODE.FRESH) {
        // Delete any existing data and create new locked file
        if (existingFile?.exists) {
          await deleteDataFile();
        }
        await lockDataFile(trimmedEmail);
      } else if (mode === MODE.UPLOAD && uploadedFile?.fileUri) {
        // Import the uploaded file
        await importDataFile(uploadedFile.fileUri);
      }
      // MODE.EXISTING, APP_UPDATED, DEVICE_CHANGED - just use existing file as-is
      
      // 4. Success!
      await clearStoredImportFile();
      onSuccess(license);
      
    } catch (e) {
      console.error('Login error:', e);
      
      // Handle different error types
      const code = e.code || e.message || '';
      
      switch (code) {
        case 'OWNER_MISMATCH':
          setError('This data belongs to a different account.');
          break;
        case 'BLOCKED':
          setError('Your account has been blocked. Please contact support.');
          break;
        case 'LICENSE_EXPIRED':
          setError('Your license has expired. Please renew to continue.');
          break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError('Invalid email or password');
          break;
        case 'auth/too-many-requests':
          setError('Too many attempts. Please try again later.');
          break;
        case 'auth/network-request-failed':
          setError('Network error. Please check your connection.');
          break;
        case 'auth/user-disabled':
          setError('This account has been disabled.');
          break;
        default:
          setError(e.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle forgot password
  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    
    if (!trimmedEmail) {
      Alert.alert('Enter Email', 'Please enter your email address first.');
      return;
    }
    
    try {
      await sendPasswordResetEmail(trimmedEmail);
      Alert.alert(
        'Password Reset Email Sent',
        `We've sent a password reset link to ${trimmedEmail}. Check your inbox.`
      );
    } catch (e) {
      const code = e.code || '';
      if (code === 'auth/user-not-found') {
        Alert.alert('Not Found', 'No account exists with this email.');
      } else {
        Alert.alert('Error', e.message || 'Failed to send reset email.');
      }
    }
  };

  // Loading state while checking file
  if (checkingFile) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={BRAND} />
        <Text style={styles.loadingText}>Checking data...</Text>
      </View>
    );
  }

  const header = getHeaderContent();
  const isEmailLocked = mode === MODE.EXISTING || mode === MODE.UPLOAD || mode === MODE.APP_UPDATED || mode === MODE.DEVICE_CHANGED;
  const showDataOptions = mode === MODE.FRESH || mode === MODE.UPLOAD;

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>LOCAS</Text>
          </View>
          <Text style={styles.tagline}>GST Billing Made Simple</Text>
        </View>

        {/* Login Card */}
        <View style={styles.card}>
          
          {/* Header with icon for app_updated/device_changed */}
          {header.icon ? (
            <View style={styles.headerWithIcon}>
              <View style={[styles.headerIconWrap, { backgroundColor: header.iconBg }]}>
                <Icon name={header.icon} size={24} color={header.iconColor} />
              </View>
              <Text style={styles.title}>{header.title}</Text>
              <Text style={styles.subtitleCentered}>{header.subtitle}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.title}>{header.title}</Text>
              <Text style={styles.subtitle}>{header.subtitle}</Text>
            </>
          )}

          {/* Existing file notice (only for EXISTING mode, not app_updated) */}
          {mode === MODE.EXISTING && existingFile?.dataOwner && (
            <View style={styles.noticeBox}>
              <Icon name="database" size={16} color={COLORS.info} />
              <Text style={styles.noticeText}>
                Data found for{' '}
                <Text style={styles.noticeBold}>{existingFile.dataOwner}</Text>
              </Text>
            </View>
          )}

          {/* Uploaded file notice */}
          {mode === MODE.UPLOAD && uploadedFile?.dataOwner && (
            <View style={[styles.noticeBox, { backgroundColor: COLORS.successLight }]}>
              <Icon name="file-text" size={16} color={COLORS.success} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.noticeText, { color: COLORS.success }]}>
                  Importing data for{' '}
                  <Text style={styles.noticeBold}>{uploadedFile.dataOwner}</Text>
                </Text>
              </View>
              <TouchableOpacity onPress={handleClearUpload} style={styles.clearBtn}>
                <Icon name="x" size={16} color={COLORS.textMute} />
              </TouchableOpacity>
            </View>
          )}

          {/* Error */}
          {error ? (
            <View style={styles.errorBox}>
              <Icon name="alert-circle" size={16} color={COLORS.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Email */}
          <Text style={styles.label}>Email</Text>
          <View style={[styles.inputContainer, isEmailLocked && styles.inputContainerLocked]}>
            <TextInput
              style={[styles.input, isEmailLocked && styles.inputLocked]}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isEmailLocked && !loading}
            />
            {isEmailLocked && (
              <View style={styles.lockIcon}>
                <Icon name="lock" size={16} color={COLORS.textMute} />
              </View>
            )}
          </View>
          {isEmailLocked && (
            <Text style={styles.lockedHint}>
              {mode === MODE.APP_UPDATED || mode === MODE.DEVICE_CHANGED 
                ? 'Verify with your registered email'
                : 'Email is locked to data file owner'}
            </Text>
          )}

          {/* Password */}
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
            >
              <Icon name={showPassword ? "eye-off" : "eye"} size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Data Options (only for fresh/upload modes - first time login) */}
          {showDataOptions && !existingFile?.exists && (
            <View style={styles.dataOptions}>
              <Text style={styles.dataOptionsLabel}>Data Options</Text>
              
              <TouchableOpacity 
                style={[styles.optionBtn, mode === MODE.FRESH && styles.optionBtnActive]}
                onPress={() => handleModeChange(MODE.FRESH)}
              >
                <View style={[styles.radio, mode === MODE.FRESH && styles.radioActive]}>
                  {mode === MODE.FRESH && <View style={styles.radioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>Start Fresh</Text>
                  <Text style={styles.optionSub}>Create new empty data file</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.optionBtn, mode === MODE.UPLOAD && styles.optionBtnActive]}
                onPress={() => uploadedFile ? handleModeChange(MODE.UPLOAD) : handlePickFile()}
              >
                <View style={[styles.radio, mode === MODE.UPLOAD && styles.radioActive]}>
                  {mode === MODE.UPLOAD && <View style={styles.radioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>Upload Existing Data</Text>
                  <Text style={styles.optionSub}>
                    {uploadedFile ? 'File selected ✓' : 'Import from backup file'}
                  </Text>
                </View>
                {!uploadedFile && (
                  <Icon name="upload" size={18} color={COLORS.textMute} />
                )}
              </TouchableOpacity>
            </View>
          )}

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
              <Text style={styles.loginBtnText}>
                {mode === MODE.APP_UPDATED || mode === MODE.DEVICE_CHANGED ? 'Verify & Continue' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.footer}>
            {mode === MODE.APP_UPDATED || mode === MODE.DEVICE_CHANGED
              ? 'One-time verification required'
              : 'Internet connection required for sign in'}
          </Text>
        </View>

        {/* Bottom note */}
        <View style={styles.bottomNote}>
          <Icon name="shield" size={14} color="#9CA3AF" />
          <Text style={styles.bottomNoteText}>
            Your data is encrypted and stored locally
          </Text>
        </View>
      </ScrollView>

      {/* Confirm Fresh Start Modal */}
      <Modal visible={showConfirmFresh} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Icon name="alert-triangle" size={28} color={COLORS.warning} />
            </View>
            <Text style={styles.modalTitle}>Delete Uploaded File?</Text>
            <Text style={styles.modalText}>
              You uploaded a data file with existing data.{'\n\n'}
              Starting fresh will <Text style={{ fontWeight: '700', color: COLORS.danger }}>permanently delete</Text> this data and create a new empty file.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelBtn}
                onPress={() => setShowConfirmFresh(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalDeleteBtn}
                onPress={confirmFreshStart}
              >
                <Text style={styles.modalDeleteText}>Delete & Start Fresh</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFF',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textMute,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: COLORS.textMute,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerWithIcon: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMute,
    marginBottom: 20,
  },
  subtitleCentered: {
    fontSize: 14,
    color: COLORS.textMute,
    textAlign: 'center',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.infoLight,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 16,
  },
  noticeText: {
    fontSize: 13,
    color: COLORS.info,
    flex: 1,
  },
  noticeBold: {
    fontWeight: '700',
  },
  clearBtn: {
    padding: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerLight,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.danger,
    flex: 1,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
  },
  inputContainerLocked: {
    backgroundColor: '#F3F4F6',
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1F2937',
  },
  inputLocked: {
    color: '#6B7280',
  },
  lockIcon: {
    paddingRight: 14,
  },
  lockedHint: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
    fontStyle: 'italic',
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
    marginTop: 8,
  },
  forgotText: {
    fontSize: 13,
    color: BRAND,
    fontWeight: '500',
  },
  dataOptions: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  dataOptionsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  optionBtnActive: {
    borderColor: BRAND,
    backgroundColor: '#FFF7ED',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: BRAND,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BRAND,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  optionSub: {
    fontSize: 12,
    color: COLORS.textMute,
    marginTop: 2,
  },
  loginBtn: {
    backgroundColor: BRAND,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
  },
  bottomNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
  },
  bottomNoteText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.xl,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.warningBg || COLORS.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: COLORS.textSub,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSub,
  },
  modalDeleteBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
  },
  modalDeleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});