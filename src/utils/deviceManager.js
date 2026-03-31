/**
 * Device Management for LOCAS
 * 
 * Handles device registration, limit checking, and cloud sync eligibility.
 * Uses Firestore to track registered devices per user.
 * 
 * Firestore Structure:
 *   /users/{uid}/devices/{deviceId}
 *   {
 *     name: "Pixel 7",
 *     platform: "android",
 *     appVersion: "1.0.0",
 *     lastSeen: Timestamp,
 *     createdAt: Timestamp,
 *   }
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Conditionally import expo modules (may not be available on all platforms)
let Application, Device;
try {
  Application = require('expo-application');
  Device = require('expo-device');
} catch (e) {
  Application = null;
  Device = null;
}

// Storage keys
const DEVICE_ID_KEY = '@locas_device_id';

// ─── DEVICE ID ──────────────────────────────────────────────────────────────

/**
 * Get or create a unique device ID
 * Persists across app reinstalls on the same device
 */
export async function getDeviceId() {
  try {
    // Check if we already have a device ID
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (deviceId) return deviceId;

    // Generate new device ID
    if (Platform.OS === 'android') {
      // Use Android ID if available
      deviceId = (Application && Application.androidId) ? Application.androidId : generateUUID();
    } else if (Platform.OS === 'ios') {
      // iOS doesn't give persistent IDs, generate one
      deviceId = generateUUID();
    } else {
      // Web/Electron - use fingerprint or generate
      deviceId = await getWebDeviceId();
    }

    // Save for future use
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    return deviceId;
  } catch (e) {
    console.error('Failed to get device ID:', e);
    return generateUUID();
  }
}

/**
 * Get device name (e.g., "Pixel 7", "iPhone 14", "Windows PC")
 */
export function getDeviceName() {
  if (Platform.OS === 'web') {
    // Electron or web browser
    if (typeof window !== 'undefined' && window.process?.type === 'renderer') {
      // Electron
      const os = window.navigator.platform;
      if (os.includes('Win')) return 'Windows Desktop';
      if (os.includes('Mac')) return 'Mac Desktop';
      if (os.includes('Linux')) return 'Linux Desktop';
      return 'Desktop';
    }
    return 'Web Browser';
  }
  
  // Native device
  if (Device) {
    return Device.deviceName || Device.modelName || `${Device.brand || 'Unknown'} Device`;
  }
  return 'Mobile Device';
}

/**
 * Get platform string
 */
export function getPlatform() {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.process?.type === 'renderer') {
      return 'electron';
    }
    return 'web';
  }
  return Platform.OS; // 'android' or 'ios'
}

/**
 * Get app version
 */
export function getAppVersion() {
  if (Application && Application.nativeApplicationVersion) {
    return Application.nativeApplicationVersion;
  }
  // Fallback: try to read from app.json
  try {
    const { expo } = require('../../app.json');
    return expo.version || '1.0.0';
  } catch (e) {
    return '1.0.0';
  }
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function getWebDeviceId() {
  // For web/Electron, try to create a fingerprint
  if (typeof window === 'undefined') return generateUUID();
  
  try {
    // Try localStorage first (persists across sessions)
    const stored = window.localStorage.getItem(DEVICE_ID_KEY);
    if (stored) return stored;
    
    // Generate new ID
    const id = generateUUID();
    window.localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch (e) {
    return generateUUID();
  }
}

// ─── DEVICE INFO OBJECT ─────────────────────────────────────────────────────

/**
 * Get complete device info object for registration
 */
export async function getDeviceInfo() {
  return {
    deviceId: await getDeviceId(),
    name: getDeviceName(),
    platform: getPlatform(),
    appVersion: getAppVersion(),
  };
}