/**
 * LOCAS License & Device Management System
 * 
 * SECURITY:
 * - Data file LOCKED to owner_email (stored in DB permanently)
 * - Cache stores license info (plan, expiry, maxDevices, cloudSync)
 * - On cache clear/new device → MUST login with SAME email
 * - Firebase verifies: email matches + license valid + device limit
 * - YOU control via admin.js + FCM push
 *
 * DEVICE MANAGEMENT:
 * - Devices tracked in Firestore: /users/{uid}/devices/{deviceId}
 * - Trial: 2 devices max, no cloud sync
 * - Yearly: 5 devices max, cloud sync enabled
 * - User can remove devices to free slots
 * 
 * APP CALLS FIREBASE ONLY WHEN:
 * - First login ever
 * - Cache cleared
 * - App updated
 * - New device
 * - Data file moved (must use SAME email)
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUser } from './firebase/firebaseAuth';
import { getDataOwner, setDataOwner } from '../db';
import { getDeviceInfo } from './deviceManager';

// Storage keys
const LICENSE_KEY = 'locas_license';
const APP_VERSION_KEY = 'locas_app_version';
const DEVICE_ID_KEY = 'locas_device_id';
const DEVICE_REGISTERED_KEY = 'locas_device_registered';

// Firestore imports - platform-aware
let firestoreDb = null;

async function getFirestore() {
  if (firestoreDb) return firestoreDb;
  
  if (Platform.OS === 'web') {
    const { getFirestore: getFs, getApps } = await import('firebase/firestore');
    const app = getApps()[0];
    firestoreDb = getFs(app);
  } else {
    firestoreDb = (await import('@react-native-firebase/firestore')).default();
  }
  return firestoreDb;
}

// Get app version
const getAppVersion = () => {
  try {
    return require('../../app.json').expo.version;
  } catch (e) {
    return '0.0.0';
  }
};

// Get or create device ID (uses deviceManager)
const getOrCreateDeviceId = async () => {
  try {
    const info = await getDeviceInfo();
    return info.deviceId;
  } catch (e) {
    // Fallback
    let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }
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
    maxDevices: data.maxDevices || 2,
    cloudSync: data.cloudSync || false,
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
  const currentDeviceId = await getOrCreateDeviceId();

  // No cache - needs login
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
      dataOwner: license.email,
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

  // App updated - need to re-verify
  const currentVersion = getAppVersion();
  const savedVersion = await AsyncStorage.getItem(APP_VERSION_KEY);
  if (savedVersion && savedVersion !== currentVersion) {
    return {
      required: true,
      reason: 'app_updated',
      dataOwner: license.email,
      message: 'App updated. Please verify your license.',
    };
  }

  // Device changed - need to re-verify
  if (license.deviceId && license.deviceId !== currentDeviceId) {
    return {
      required: true,
      reason: 'device_changed',
      dataOwner: license.email,
      message: 'New device detected. Please verify your license.',
    };
  }

  // Expired
  if (license.expiryDate && getDaysLeft(license.expiryDate) <= 0) {
    return {
      required: true,
      reason: 'expired',
      dataOwner: license.email,
      message: 'Your license has expired. Please renew to continue.',
    };
  }

  // All good - NO login needed!
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
      maxDevices: license.maxDevices || 5,
      cloudSync: license.cloudSync !== false,
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
    maxDevices: license.maxDevices || 2,
    cloudSync: license.cloudSync || false,
    message: daysLeft <= 30
      ? `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
      : `Valid until ${new Date(license.expiryDate).toLocaleDateString('en-IN')}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// VERIFY ON LOGIN (FIREBASE CALL - only when login required)
// Includes device registration in Firestore
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

  // Get device info
  const deviceInfo = await getDeviceInfo();
  const maxDevices = claims.maxDevices || 2;

  // Check device limit in Firestore
  const deviceCheckResult = await checkAndRegisterDevice(user.uid, deviceInfo, maxDevices);
  
  if (!deviceCheckResult.allowed) {
    // Return special error with device list
    const err = new Error('DEVICE_LIMIT_REACHED');
    err.devices = deviceCheckResult.devices;
    err.maxDevices = maxDevices;
    err.license = {
      email,
      plan: claims.plan || 'trial',
      expiryDate: claims.licenseExpiry || null,
      maxDevices,
      cloudSync: claims.cloudSync || false,
    };
    throw err;
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
    maxDevices,
    cloudSync: claims.cloudSync || false,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// DEVICE MANAGEMENT (FIRESTORE)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check device count and register this device if allowed
 */
async function checkAndRegisterDevice(uid, deviceInfo, maxDevices) {
  try {
    const db = await getFirestore();
    
    if (Platform.OS === 'web') {
      const { collection, doc, getDocs, setDoc, serverTimestamp } = await import('firebase/firestore');
      
      const devicesRef = collection(db, 'users', uid, 'devices');
      const snapshot = await getDocs(devicesRef);
      
      const devices = [];
      let thisDeviceRegistered = false;
      
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        devices.push({
          id: docSnap.id,
          ...data,
          lastSeen: data.lastSeen?.toDate?.() || new Date(),
        });
        if (docSnap.id === deviceInfo.deviceId) {
          thisDeviceRegistered = true;
        }
      });
      
      // Check limit
      if (!thisDeviceRegistered && devices.length >= maxDevices) {
        return {
          allowed: false,
          devices: devices.sort((a, b) => b.lastSeen - a.lastSeen),
        };
      }
      
      // Register/update device
      const deviceDocRef = doc(db, 'users', uid, 'devices', deviceInfo.deviceId);
      await setDoc(deviceDocRef, {
        name: deviceInfo.name,
        platform: deviceInfo.platform,
        appVersion: deviceInfo.appVersion,
        lastSeen: serverTimestamp(),
        ...(!thisDeviceRegistered && { createdAt: serverTimestamp() }),
      }, { merge: true });
      
      await AsyncStorage.setItem(DEVICE_REGISTERED_KEY, 'true');
      
      return { allowed: true, devices };
      
    } else {
      // Native (React Native Firebase)
      const devicesRef = db.collection('users').doc(uid).collection('devices');
      const snapshot = await devicesRef.get();
      
      const devices = [];
      let thisDeviceRegistered = false;
      
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        devices.push({
          id: docSnap.id,
          ...data,
          lastSeen: data.lastSeen?.toDate?.() || new Date(),
        });
        if (docSnap.id === deviceInfo.deviceId) {
          thisDeviceRegistered = true;
        }
      });
      
      // Check limit
      if (!thisDeviceRegistered && devices.length >= maxDevices) {
        return {
          allowed: false,
          devices: devices.sort((a, b) => b.lastSeen - a.lastSeen),
        };
      }
      
      // Register/update device
      const deviceDocRef = devicesRef.doc(deviceInfo.deviceId);
      const firestore = await import('@react-native-firebase/firestore');
      
      await deviceDocRef.set({
        name: deviceInfo.name,
        platform: deviceInfo.platform,
        appVersion: deviceInfo.appVersion,
        lastSeen: firestore.default.FieldValue.serverTimestamp(),
        ...(!thisDeviceRegistered && { createdAt: firestore.default.FieldValue.serverTimestamp() }),
      }, { merge: true });
      
      await AsyncStorage.setItem(DEVICE_REGISTERED_KEY, 'true');
      
      return { allowed: true, devices };
    }
  } catch (e) {
    console.error('Device registration error:', e);
    // On error, allow access (offline case)
    return { allowed: true, devices: [] };
  }
}

/**
 * Get registered devices for current user
 */
export async function getRegisteredDevices(uid) {
  try {
    const db = await getFirestore();
    
    if (Platform.OS === 'web') {
      const { collection, getDocs, query, orderBy } = await import('firebase/firestore');
      const devicesRef = collection(db, 'users', uid, 'devices');
      const q = query(devicesRef, orderBy('lastSeen', 'desc'));
      const snapshot = await getDocs(q);
      
      const devices = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        devices.push({
          id: docSnap.id,
          ...data,
          lastSeen: data.lastSeen?.toDate?.() || new Date(),
          createdAt: data.createdAt?.toDate?.() || new Date(),
        });
      });
      return devices;
    } else {
      const devicesRef = db.collection('users').doc(uid).collection('devices');
      const snapshot = await devicesRef.orderBy('lastSeen', 'desc').get();
      
      const devices = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        devices.push({
          id: docSnap.id,
          ...data,
          lastSeen: data.lastSeen?.toDate?.() || new Date(),
          createdAt: data.createdAt?.toDate?.() || new Date(),
        });
      });
      return devices;
    }
  } catch (e) {
    console.error('Get devices error:', e);
    return [];
  }
}

/**
 * Remove a device
 */
export async function removeDevice(uid, deviceId) {
  try {
    const db = await getFirestore();
    
    if (Platform.OS === 'web') {
      const { doc, deleteDoc } = await import('firebase/firestore');
      const deviceDocRef = doc(db, 'users', uid, 'devices', deviceId);
      await deleteDoc(deviceDocRef);
    } else {
      await db.collection('users').doc(uid).collection('devices').doc(deviceId).delete();
    }
    
    return true;
  } catch (e) {
    console.error('Remove device error:', e);
    throw e;
  }
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
        maxDevices: pushData.maxDevices ? parseInt(pushData.maxDevices) : license.maxDevices,
        cloudSync: pushData.cloudSync === 'true' ? true : pushData.cloudSync === 'false' ? false : license.cloudSync,
        savedAt: new Date().toISOString(),
      }));
      return { reload: false };

    case 'relogin':
      await AsyncStorage.removeItem(LICENSE_KEY);
      return { reload: true };

    case 'device_removed':
      // Another device was removed, re-check on next login
      return { reload: false };

    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLEAR LICENSE (logout)
// ═══════════════════════════════════════════════════════════════════════════

export async function clearLicense() {
  await AsyncStorage.multiRemove([LICENSE_KEY, DEVICE_REGISTERED_KEY]);
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

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function isCloudSyncEnabled(license) {
  return license?.cloudSync && !license?.blocked && getDaysLeft(license?.expiryDate) > 0;
}

export function getPlanName(plan) {
  switch (plan) {
    case 'trial': return 'Free Trial';
    case 'yearly': return 'Yearly Pro';
    case 'lifetime': return 'Lifetime Pro';
    default: return 'Free';
  }
}

export default {
  saveLicense,
  getLicense,
  checkIfLoginRequired,
  getLicenseStatus,
  verifyOnLogin,
  getRegisteredDevices,
  removeDevice,
  handleAdminPush,
  clearLicense,
  saveFCMToken,
  getFCMToken,
  isCloudSyncEnabled,
  getPlanName,
};