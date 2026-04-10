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
          // On web: wipe any stale stores and lock to this email
          if (existingFile?.exists) {
            await deleteDataFile();
          }
          await lockDataFile(trimmedEmail);
        } else if (mode === MODE.UPLOAD && uploadedFile?.fileUri) {
          // Import the JSON backup — web importDataFile fetches the blob URL
          await importDataFile(uploadedFile.fileUri);
          // After import, lock to the same email
          await lockDataFile(trimmedEmail);
        }
        // MODE.EXISTING, APP_UPDATED, DEVICE_CHANGED — use data as-is

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
        <StatusBar style="light" />

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero panel ── */}
          <View style={styles.hero}>
            {/* Decorative circles */}
            <View style={styles.circle1} />
            <View style={styles.circle2} />
            <View style={styles.circle3} />

            {/* Brand */}
            <View style={styles.brandRow}>
              <View style={styles.brandDot} />
              <Text style={styles.brandName}>Locas<Text style={{color:'#FF6B00'}}>.</Text></Text>
            </View>
            <Text style={styles.heroTagline}>Smart GST Billing</Text>
            <Text style={styles.heroSub}>for Indian businesses</Text>

            {/* Feature pills */}
            <View style={styles.pillRow}>
              {['Invoices', 'GST Reports', 'Parties', 'Inventory'].map(f => (
                <View key={f} style={styles.pill}>
                  <Text style={styles.pillTxt}>{f}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Login card ── */}
          <View style={styles.card}>

            {/* Card header */}
            {header.icon ? (
              <View style={styles.cardHeaderCentered}>
                <Text style={styles.cardTitle}>{header.title}</Text>
                <Text style={styles.cardSub}>{header.subtitle}</Text>
              </View>
            ) : (
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{header.title}</Text>
                <Text style={styles.cardSub}>{header.subtitle}</Text>
              </View>
            )}

            {/* Notices */}
            {mode === MODE.EXISTING && existingFile?.dataOwner && (
              <View style={styles.noticeBox}>
                <Icon name="database" size={15} color={COLORS.info} />
                <Text style={styles.noticeText}>
                  Data found for <Text style={styles.noticeBold}>{existingFile.dataOwner}</Text>
                </Text>
              </View>
            )}
            {mode === MODE.UPLOAD && uploadedFile?.dataOwner && (
              <View style={[styles.noticeBox, styles.noticeSuccess]}>
                <Icon name="file-text" size={15} color={COLORS.success} />
                <Text style={[styles.noticeText, { color: COLORS.success, flex: 1 }]}>
                  Importing data for <Text style={styles.noticeBold}>{uploadedFile.dataOwner}</Text>
                </Text>
                <TouchableOpacity onPress={handleClearUpload} style={{ padding: 4 }}>
                  <Icon name="x" size={15} color={COLORS.textMute} />
                </TouchableOpacity>
              </View>
            )}
            {error ? (
              <View style={styles.errorBox}>
                <Icon name="alert-circle" size={15} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Email */}
            <Text style={styles.fieldLabel}>Email address</Text>
            <View style={[styles.fieldWrap, isEmailLocked && styles.fieldWrapLocked]}>
              <Icon name="mail" size={16} color={isEmailLocked ? COLORS.textMute : '#9CA3AF'} />
              <TextInput
                style={[styles.fieldInput, isEmailLocked && styles.fieldInputLocked]}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isEmailLocked && !loading}
              />
              {isEmailLocked && <Icon name="lock" size={14} color={COLORS.textMute} />}
            </View>
            {isEmailLocked && (
              <Text style={styles.lockedHint}>
                {mode === MODE.APP_UPDATED || mode === MODE.DEVICE_CHANGED
                  ? 'Verify with your registered email'
                  : 'Locked to data file owner'}
              </Text>
            )}

            {/* Password */}
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.fieldWrap}>
              <Icon name="lock" size={16} color="#9CA3AF" />
              <TextInput
                style={styles.fieldInput}
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
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 2 }}>
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Data options — first time only */}
            {showDataOptions && !existingFile?.exists && (
              <View style={styles.dataOptions}>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerTxt}>data options</Text>
                  <View style={styles.dividerLine} />
                </View>
                <TouchableOpacity
                  style={[styles.optionBtn, mode === MODE.FRESH && styles.optionBtnActive]}
                  onPress={() => handleModeChange(MODE.FRESH)}
                >
                  <View style={[styles.radio, mode === MODE.FRESH && styles.radioActive]}>
                    {mode === MODE.FRESH && <View style={styles.radioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>Start fresh</Text>
                    <Text style={styles.optionSub}>New empty data file</Text>
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
                    <Text style={styles.optionTitle}>Restore backup</Text>
                    <Text style={styles.optionSub}>{uploadedFile ? 'File selected ✓' : 'Import .lbk backup file'}</Text>
                  </View>
                  {!uploadedFile && <Icon name="upload" size={16} color={COLORS.textMute} />}
                </TouchableOpacity>
              </View>
            )}

            {/* Sign in button */}
            <TouchableOpacity
              style={[styles.signInBtn, loading && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.signInBtnTxt}>
                    {mode === MODE.APP_UPDATED || mode === MODE.DEVICE_CHANGED ? 'Verify & Continue' : 'Sign In'}
                  </Text>
              }
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Icon name="shield" size={12} color="#C4C4C4" />
              <Text style={styles.footerTxt}>
                {mode === MODE.APP_UPDATED || mode === MODE.DEVICE_CHANGED
                  ? 'One-time verification required'
                  : 'Data stored locally · Encrypted'}
              </Text>
            </View>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>

        {/* Confirm fresh start modal */}
        <Modal visible={showConfirmFresh} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Delete uploaded file?</Text>
              <Text style={styles.modalText}>
                You uploaded a data file with existing data.{'\n\n'}
                Starting fresh will <Text style={{ fontWeight: '700', color: COLORS.danger }}>permanently delete</Text> this data.
              </Text>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowConfirmFresh(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalDeleteBtn} onPress={confirmFreshStart}>
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
    container:   { flex: 1, backgroundColor: '#0F0F10' },
    center:      { alignItems: 'center', justifyContent: 'center' },
    loadingText: { marginTop: 12, fontSize: 14, color: '#888' },

    scrollContent: {
      flexGrow: 1,
      paddingBottom: 32,
    },

    // ── Hero ──────────────────────────────────────────────────────
    hero: {
      backgroundColor: '#0F0F10',
      paddingHorizontal: 28,
      paddingTop: 52,
      paddingBottom: 44,
      overflow: 'hidden',
      position: 'relative',
    },
    circle1: {
      position: 'absolute', top: -60, right: -60,
      width: 220, height: 220, borderRadius: 110,
      backgroundColor: '#FF6B00', opacity: 0.12,
    },
    circle2: {
      position: 'absolute', top: 20, right: 30,
      width: 100, height: 100, borderRadius: 50,
      backgroundColor: '#FF6B00', opacity: 0.07,
    },
    circle3: {
      position: 'absolute', bottom: -30, left: -40,
      width: 160, height: 160, borderRadius: 80,
      backgroundColor: '#FF8C40', opacity: 0.06,
    },
    brandRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16,
    },
    brandDot: {
      width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6B00',
    },
    brandName: {
      fontSize: 13, fontWeight: '700', color: '#FF6B00',
      textTransform: 'uppercase', letterSpacing: 3,
    },
    heroTagline: {
      fontSize: 38, fontWeight: '800', color: '#FFFFFF',
      lineHeight: 44, marginBottom: 6, letterSpacing: -0.5,
    },
    heroSub: {
      fontSize: 16, color: '#888', marginBottom: 28,
    },
    pillRow: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    },
    pill: {
      paddingHorizontal: 12, paddingVertical: 5,
      borderRadius: 20,
      backgroundColor: 'rgba(255,107,0,0.12)',
      borderWidth: 1, borderColor: 'rgba(255,107,0,0.2)',
    },
    pillTxt: {
      fontSize: 12, color: '#FF8C40', fontWeight: '600',
    },

    // ── Card ──────────────────────────────────────────────────────
    card: {
      backgroundColor: '#FFFFFF',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      paddingHorizontal: 24,
      paddingTop: 32,
      paddingBottom: 16,
      flex: 1,
      minHeight: 420,
    },
    cardHeader: { marginBottom: 24 },
    cardHeaderCentered: { marginBottom: 24, alignItems: 'center' },
    cardTitle: { fontSize: 24, fontWeight: '800', color: '#111', marginBottom: 4 },
    cardSub:   { fontSize: 14, color: '#9CA3AF' },

    // Notices
    noticeBox: {
      flexDirection: 'row', alignItems: 'center', gap: 9,
      backgroundColor: COLORS.infoLight,
      borderRadius: 10, padding: 11, marginBottom: 16,
    },
    noticeSuccess: { backgroundColor: COLORS.successLight ?? '#F0FDF4' },
    noticeText:    { fontSize: 13, color: COLORS.info },
    noticeBold:    { fontWeight: '700' },

    // Error
    errorBox: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: COLORS.dangerLight,
      borderRadius: 10, padding: 11, marginBottom: 16,
    },
    errorText: { fontSize: 13, color: COLORS.danger, flex: 1 },

    // Fields
    fieldLabel: {
      fontSize: 12, fontWeight: '600', color: '#374151',
      marginBottom: 8, marginTop: 16,
    },
    fieldWrap: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: '#F9FAFB',
      borderWidth: 1.5, borderColor: '#E5E7EB',
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    },
    fieldWrapLocked: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
    fieldInput: {
      flex: 1, fontSize: 15, color: '#111', paddingVertical: 0,
    },
    fieldInputLocked: { color: '#6B7280' },

    lockedHint: { fontSize: 11, color: '#9CA3AF', marginTop: 5, fontStyle: 'italic' },

    forgotBtn: { alignSelf: 'flex-end', marginTop: 10 },
    forgotText: { fontSize: 13, color: '#FF6B00', fontWeight: '600' },

    // Data options
    dataOptions: { marginTop: 20 },
    dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
    dividerTxt:  { fontSize: 10, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
    optionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 13, borderRadius: 12,
      borderWidth: 1.5, borderColor: '#E5E7EB',
      marginBottom: 8, backgroundColor: '#FAFAFA',
    },
    optionBtnActive: { borderColor: '#FF6B00', backgroundColor: '#FFF7F0' },
    radio:     { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
    radioActive: { borderColor: '#FF6B00' },
    radioDot:  { width: 9, height: 9, borderRadius: 5, backgroundColor: '#FF6B00' },
    optionTitle: { fontSize: 14, fontWeight: '600', color: '#111' },
    optionSub:   { fontSize: 12, color: '#9CA3AF', marginTop: 1 },

    // Sign in button
    signInBtn: {
      backgroundColor: '#FF6B00',
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 24,
    },
    signInBtnTxt: {
      color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3,
    },

    // Footer
    footerRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, marginTop: 16,
    },
    footerTxt: { fontSize: 11, color: '#C4C4C4' },

    // Modal
    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center', justifyContent: 'center', padding: 28,
    },
    modalCard: {
      backgroundColor: '#fff', borderRadius: 20,
      padding: 24, width: '100%', maxWidth: 340,
    },
    modalTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 10 },
    modalText:  { fontSize: 14, color: '#6B7280', lineHeight: 21, marginBottom: 24 },
    modalActions: { flexDirection: 'row', gap: 10 },
    modalCancelBtn: {
      flex: 1, paddingVertical: 13, borderRadius: 10,
      borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center',
    },
    modalCancelText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
    modalDeleteBtn: {
      flex: 1, paddingVertical: 13, borderRadius: 10,
      backgroundColor: COLORS.danger, alignItems: 'center',
    },
    modalDeleteText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  });