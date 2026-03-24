// Platform-aware Firebase auth entry point
// Uses @react-native-firebase on mobile, Firebase JS SDK on web/desktop
import { Platform } from 'react-native';

let firebase;

if (Platform.OS === 'web') {
  firebase = require('./firebase/firebase.web');
} else {
  firebase = require('./firebase/native');
}

export const signIn             = firebase.signIn;
export const signOut            = firebase.signOut;
export const getCurrentUser     = firebase.getCurrentUser;
export const onAuthStateChanged = firebase.onAuthStateChanged;
