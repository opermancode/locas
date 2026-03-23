import auth from '@react-native-firebase/auth';

// ─── Sign In ──────────────────────────────────────────────────────
export async function signIn(email, password) {
  const result = await auth().signInWithEmailAndPassword(email, password);
  return result.user;
}

// ─── Sign Out ─────────────────────────────────────────────────────
export async function signOut() {
  await auth().signOut();
}

// ─── Get current user ─────────────────────────────────────────────
export function getCurrentUser() {
  return auth().currentUser;
}

// ─── Auth state listener ──────────────────────────────────────────
export function onAuthStateChanged(callback) {
  return auth().onAuthStateChanged(callback);
}