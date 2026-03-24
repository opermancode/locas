// Platform-aware Firebase auth
// Metro automatically picks:
//   firebaseImpl.native.js on Android
//   firebaseImpl.web.js on web/desktop
const firebase = require('./firebaseImpl');

export const signIn             = firebase.signIn;
export const signOut            = firebase.signOut;
export const getCurrentUser     = firebase.getCurrentUser;
export const onAuthStateChanged = firebase.onAuthStateChanged;