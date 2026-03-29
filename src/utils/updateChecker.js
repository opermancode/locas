// Update Checker
// Checks for app updates from your GitHub repo
// Works offline with cached data

import { Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UPDATE_CACHE_KEY = 'locas_update_cache';

// Your GitHub repo URLs (change these)
const VERSION_REPO = 'https://raw.githubusercontent.com/opermancode/locas-updates/main';

// Get current app version
const getAppVersion = () => {
  try {
    return require('../../app.json').expo.version;
  } catch (e) {
    return '0.0.0';
  }
};

// Compare versions: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
const compareVersions = (v1, v2) => {
  const p1 = v1.split('.').map(Number);
  const p2 = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const a = p1[i] || 0;
    const b = p2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
};

// ═══════════════════════════════════════════════════════════════════════════
// CHECK FOR UPDATE
// ═══════════════════════════════════════════════════════════════════════════

export async function checkForUpdate() {
  const isDesktop = Platform.OS === 'web';
  const versionUrl = isDesktop
    ? `${VERSION_REPO}/desktop/version.json`
    : `${VERSION_REPO}/apk/version.json`;

  try {
    // Try fetching latest version
    const response = await fetch(versionUrl, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!response.ok) throw new Error('Fetch failed');

    const data = await response.json();

    // Cache for offline
    await AsyncStorage.setItem(UPDATE_CACHE_KEY, JSON.stringify({
      ...data,
      cachedAt: new Date().toISOString(),
    }));

    // Compare
    const current = getAppVersion();
    if (compareVersions(data.version, current) > 0) {
      return {
        hasUpdate: true,
        currentVersion: current,
        latestVersion: data.version,
        downloadUrl: data.downloadUrl,
        downloadPage: data.downloadPage,
        releaseNotes: data.releaseNotes || 'New version available',
        cached: false,
      };
    }

    return { hasUpdate: false };

  } catch (e) {
    // Offline - use cache
    console.log('Update check offline, using cache');
    try {
      const cached = await AsyncStorage.getItem(UPDATE_CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        const current = getAppVersion();
        if (compareVersions(data.version, current) > 0) {
          return {
            hasUpdate: true,
            currentVersion: current,
            latestVersion: data.version,
            downloadUrl: data.downloadUrl,
            downloadPage: data.downloadPage,
            releaseNotes: data.releaseNotes,
            cached: true,
          };
        }
      }
    } catch (_) {}

    return { hasUpdate: false };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PERFORM UPDATE (open download link)
// ═══════════════════════════════════════════════════════════════════════════

export async function performUpdate(updateInfo) {
  try {
    const url = updateInfo?.downloadPage || updateInfo?.downloadUrl;
    if (url) {
      await Linking.openURL(url);
      return { success: true };
    }
    return { success: false, message: 'No download URL' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

export default {
  checkForUpdate,
  performUpdate,
};