// Web/Electron Firebase auth using Firebase JS SDK
// Drop-in replacement for firebase.js on web platform

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCsUivRaiSK1ZZ9AA3Et-k1eIon5l0Y3hc",
  authDomain: "locas-business.firebaseapp.com",
  projectId: "locas-business",
  storageBucket: "locas-business.firebasestorage.app",
  messagingSenderId: "835960594579",
  appId: "1:835960594579:android:99ab49d5b8f08847176d66",
};

// Initialize Firebase only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

export async function signIn(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signOut() {
  await firebaseSignOut(auth);
}

export function getCurrentUser() {
  return auth.currentUser;
}

export function onAuthStateChanged(callback) {
  return firebaseOnAuthStateChanged(auth, callback);
}