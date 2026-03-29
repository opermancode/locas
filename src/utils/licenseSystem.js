// LOCAS License & Data Protection System
// 
// SECURITY:
// - Data file LOCKED to owner_email (stored in DB permanently)
// - Cache stores license info (plan, expiry)
// - On cache clear/new device → MUST login with SAME email
// - Firebase verifies: email matches + license valid
// - YOU control via admin.js + FCM push
//
// APP CALLS FIREBASE ONLY WHEN:
// - First login ever
// - Cache cleared
// - App updated
// - New device
// - Data file moved (must use SAME email)

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUser } from './firebase/firebaseAuth';
import { getDataOwner, setDataOwner } from '../db';

// Storage keys
const LICENSE_KEY = 'locas_license';
const APP_VERSION_KEY = 'locas_app_version';
const DEVICE_ID_KEY = 'locas_device_id';

// Get app version
const getAppVersion = () => {
  try {
    return require('../../app.json').expo.version;
  } catch (e) {
    return '0.0.0';
  }
};

// Get or create device ID
const getOrCreateDeviceId = async () => {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
};

// Calculate days left
const getDaysLeft = (expiryDate) => {
  if (!expiryDate) return 9999;
  return Math.ceil((new Date(expiryDate) - new Date()) / 86400000);
};

// ═══════════════════════════════════════════════════════════════════════════
// SAVE LICENSE TO CACHE
// ═══════════════════════════════════════════════════════════════════════════

export async function saveLicense(data) {
  const deviceId = await getOrCreateDeviceId();

  const license = {
    email: data.email,
    plan: data.plan || 'trial',
    expiryDate: data.expiryDate || null,
    blocked: data.blocked || false,
    deviceId,
    appVersion: getAppVersion(),
    savedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(LICENSE_KEY, JSON.stringify(license));
  await AsyncStorage.setItem(APP_VERSION_KEY, getAppVersion());

  return license;
}

// ═══════════════════════════════════════════════════════════════════════════
// GET LICENSE FROM CACHE (NO FIREBASE)
// ═══════════════════════════════════════════════════════════════════════════

export async function getLicense() {
  try {
    const data = await AsyncStorage.getItem(LICENSE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECK IF LOGIN REQUIRED (NO FIREBASE)
// ═══════════════════════════════════════════════════════════════════════════

export async function checkIfLoginRequired() {
  const license = await getLicense();
  const dataOwner = await getDataOwner();

  // No cache
  if (!license) {
    return {
      required: true,
      reason: 'no_cache',
      dataOwner,
      message: dataOwner
        ? `Please login as ${dataOwner} to access this data.`
        : 'Please login to continue.',
    };
  }

  // Blocked
  if (license.blocked) {
    return {
      required: true,
      reason: 'blocked',
      message: 'Your license has been revoked. Contact support.',
    };
  }

  // Owner mismatch (data file moved)
  if (dataOwner && license.email.toLowerCase() !== dataOwner.toLowerCase()) {
    return {
      required: true,
      reason: 'owner_mismatch',
      dataOwner,
      message: `This data belongs to ${dataOwner}. Please login with that account.`,
    };
  }

  // App updated
  const currentVersion = getAppVersion();
  const savedVersion = await AsyncStorage.getItem(APP_VERSION_KEY);
  if (savedVersion && savedVersion !== currentVersion) {
    return {
      required: true,
      reason: 'app_updated',
      dataOwner,
      message: 'App updated. Please verify your license.',
    };
  }

  // Device changed
  const currentDevice = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (license.deviceId && license.deviceId !== currentDevice) {
    return {
      required: true,
      reason: 'device_changed',
      dataOwner,
      message: 'New device detected. Please verify your license.',
    };
  }

  // Expired
  if (license.expiryDate && getDaysLeft(license.expiryDate) <= 0) {
    return {
      required: true,
      reason: 'expired',
      message: 'Your license has expired. Please renew to continue.',
    };
  }

  // All good
  return { required: false, license };
}

// ═══════════════════════════════════════════════════════════════════════════
// GET LICENSE STATUS FOR BANNERS (NO FIREBASE)
// ═══════════════════════════════════════════════════════════════════════════

export async function getLicenseStatus() {
  const license = await getLicense();

  if (!license) return { valid: false };

  if (license.blocked) {
    return { valid: false, reason: 'blocked', message: 'License revoked' };
  }

  // Lifetime
  if (!license.expiryDate || license.plan === 'lifetime') {
    return {
      valid: true,
      warning: false,
      plan: 'lifetime',
      email: license.email,
      message: 'Lifetime license',
    };
  }

  const daysLeft = getDaysLeft(license.expiryDate);

  if (daysLeft <= 0) {
    return { valid: false, reason: 'expired', message: 'License expired' };
  }

  return {
    valid: true,
    warning: daysLeft <= 30,
    daysLeft,
    expiryDate: license.expiryDate,
    plan: license.plan,
    email: license.email,
    message: daysLeft <= 30
      ? `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
      : `Valid until ${new Date(license.expiryDate).toLocaleDateString('en-IN')}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// VERIFY ON LOGIN (FIREBASE CALL - only when login required)
// ═══════════════════════════════════════════════════════════════════════════

export async function verifyOnLogin() {
  const user = getCurrentUser();
  if (!user) throw new Error('NOT_LOGGED_IN');

  const email = user.email.toLowerCase();
  const dataOwner = await getDataOwner();

  // Check owner match
  if (dataOwner && dataOwner.toLowerCase() !== email) {
    throw new Error('OWNER_MISMATCH');
  }

  // Get claims from Firebase
  const tokenResult = await user.getIdTokenResult(true);
  const claims = tokenResult.claims;

  // Check blocked
  if (claims.blocked) {
    throw new Error('BLOCKED');
  }

  // Check expired
  if (claims.licenseExpiry && getDaysLeft(claims.licenseExpiry) <= 0) {
    throw new Error('LICENSE_EXPIRED');
  }

  // Set owner (first time)
  if (!dataOwner) {
    await setDataOwner(email);
  }

  // Save to cache
  return await saveLicense({
    email,
    plan: claims.plan || 'trial',
    expiryDate: claims.licenseExpiry || null,
    blocked: false,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLE FCM PUSH FROM ADMIN
// ═══════════════════════════════════════════════════════════════════════════

export async function handleAdminPush(pushData) {
  const license = await getLicense();
  if (!license) return null;

  switch (pushData.action) {
    case 'block':
      await AsyncStorage.setItem(LICENSE_KEY, JSON.stringify({
        ...license,
        blocked: true,
        savedAt: new Date().toISOString(),
      }));
      return { reload: true };

    case 'unblock':
      await AsyncStorage.setItem(LICENSE_KEY, JSON.stringify({
        ...license,
        blocked: false,
        savedAt: new Date().toISOString(),
      }));
      return { reload: true };

    case 'extend':
      await AsyncStorage.setItem(LICENSE_KEY, JSON.stringify({
        ...license,
        expiryDate: pushData.expiryDate ?? license.expiryDate,
        plan: pushData.plan ?? license.plan,
        savedAt: new Date().toISOString(),
      }));
      return { reload: false };

    case 'relogin':
      await AsyncStorage.removeItem(LICENSE_KEY);
      return { reload: true };

    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLEAR LICENSE (logout)
// ═══════════════════════════════════════════════════════════════════════════

export async function clearLicense() {
  await AsyncStorage.removeItem(LICENSE_KEY);
}

// ═══════════════════════════════════════════════════════════════════════════
// FCM TOKEN
// ═══════════════════════════════════════════════════════════════════════════

export async function saveFCMToken(token) {
  await AsyncStorage.setItem('fcm_token', token);
}

export async function getFCMToken() {
  return await AsyncStorage.getItem('fcm_token');
}

export default {
  saveLicense,
  getLicense,
  checkIfLoginRequired,
  getLicenseStatus,
  verifyOnLogin,
  handleAdminPush,
  clearLicense,
  saveFCMToken,
  getFCMToken,
};