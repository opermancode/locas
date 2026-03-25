// Google Drive backup utility for Locas
// Handles Google Sign-In, upload, download via Drive REST API

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';

try { WebBrowser.maybeCompleteAuthSession(); } catch (_) {}

const CLIENT_ID = '968124204652-sil111te8fqqd3asfa6eoc7cj1bn4iv8.apps.googleusercontent.com';
const BACKUP_FILENAME = 'locas_backup.json';
const STORAGE_KEY_TOKEN = 'gdrive_access_token';
const STORAGE_KEY_EMAIL = 'gdrive_user_email';
const STORAGE_KEY_LAST_BACKUP = 'gdrive_last_backup';
const STORAGE_KEY_BACKUP_TIME = 'gdrive_backup_time'; // "HH:MM"

const DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

const SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/userinfo.email',
];

// ─── Auth ─────────────────────────────────────────────────────────

export function useGoogleAuth() {
  const redirectUri = AuthSession.makeRedirectUri({
    useProxy: true,
    projectNameForProxy: '@operman-code/locas',
  });
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      redirectUri,
      scopes: SCOPES,
      responseType: AuthSession.ResponseType.Token,
      usePKCE: false,
    },
    DISCOVERY
  );
  return { request, response, promptAsync };
}

const STORAGE_KEY_EXPIRY = 'gdrive_token_expiry';

// expiresIn: seconds until expiry as returned by OAuth (default 3600)
export async function saveToken(token, email, expiresIn = 3600) {
  // Subtract a 2-minute buffer so we refresh before actual expiry
  const expiresAt = Date.now() + Math.max(0, expiresIn - 120) * 1000;
  await AsyncStorage.multiSet([
    [STORAGE_KEY_TOKEN,  token],
    [STORAGE_KEY_EMAIL,  email || ''],
    [STORAGE_KEY_EXPIRY, String(expiresAt)],
  ]);
}

export async function getToken() {
  const [token, expiry] = await AsyncStorage.multiGet([STORAGE_KEY_TOKEN, STORAGE_KEY_EXPIRY])
    .then(pairs => pairs.map(p => p[1]));
  if (!token) return null;
  if (expiry && Date.now() > Number(expiry)) {
    // Token has expired — clear it so the UI shows 'Connect Google Drive' again
    await AsyncStorage.multiRemove([STORAGE_KEY_TOKEN, STORAGE_KEY_EXPIRY]);
    return null;
  }
  return token;
}

export async function getUserEmail() {
  return await AsyncStorage.getItem(STORAGE_KEY_EMAIL);
}

export async function signOut() {
  await AsyncStorage.multiRemove([
    STORAGE_KEY_TOKEN,
    STORAGE_KEY_EMAIL,
    STORAGE_KEY_LAST_BACKUP,
    'gdrive_token_expiry',
  ]);
}

export async function fetchUserEmail(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  return data.email || '';
}

// ─── Backup time preference ───────────────────────────────────────

export async function getBackupTime() {
  const t = await AsyncStorage.getItem(STORAGE_KEY_BACKUP_TIME);
  return t || '00:00'; // default midnight
}

export async function setBackupTime(time) {
  await AsyncStorage.setItem(STORAGE_KEY_BACKUP_TIME, time);
}

export async function getLastBackupTime() {
  return await AsyncStorage.getItem(STORAGE_KEY_LAST_BACKUP);
}

// ─── Drive helpers ────────────────────────────────────────────────

async function findBackupFileId(accessToken) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${BACKUP_FILENAME}'&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (res.status === 401) {
    // Token rejected by Google — clear it so user is prompted to reconnect
    await AsyncStorage.multiRemove([STORAGE_KEY_TOKEN, 'gdrive_token_expiry']);
    throw new Error('Google Drive session expired. Please reconnect in Settings.');
  }
  const data = await res.json();
  return data.files?.[0]?.id || null;
}

// ─── Upload (backup) ──────────────────────────────────────────────

export async function uploadBackup(accessToken, jsonString) {
  const existingId = await findBackupFileId(accessToken);
  const metadata = {
    name: BACKUP_FILENAME,
    parents: existingId ? undefined : ['appDataFolder'],
  };

  const boundary = 'locas_backup_boundary';
  const body =
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    jsonString +
    `\r\n--${boundary}--`;

  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

  const method = existingId ? 'PATCH' : 'POST';

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Upload failed');
  }

  await AsyncStorage.setItem(STORAGE_KEY_LAST_BACKUP, new Date().toISOString());
  return true;
}

// ─── Download (restore) ───────────────────────────────────────────

export async function downloadBackup(accessToken) {
  const fileId = await findBackupFileId(accessToken);
  if (!fileId) return null;

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new Error('Download failed');
  return await res.text();
}

// ─── Should run daily backup? ─────────────────────────────────────

export async function shouldRunDailyBackup() {
  const token = await getToken();
  if (!token) return false;

  const backupTime = await getBackupTime(); // "HH:MM"
  const lastBackup = await getLastBackupTime();

  const now = new Date();
  const [hh, mm] = backupTime.split(':').map(Number);

  // Check if we've passed today's backup time
  const todayBackupTime = new Date();
  todayBackupTime.setHours(hh, mm, 0, 0);

  if (now < todayBackupTime) return false; // not yet time today

  if (!lastBackup) return true; // never backed up

  const last = new Date(lastBackup);
  const lastDate = last.toDateString();
  const todayDate = now.toDateString();

  return lastDate !== todayDate; // only once per day
}
