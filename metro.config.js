const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// 1. Fix the .wasm error (Required for expo-sqlite)
config.resolver.assetExts.push('wasm');

// 2. Ensure Metro prioritizes .web.js files when bundling for web 
// and ignores them when bundling for Android/iOS
config.resolver.sourceExts.push('mjs'); 

module.exports = config;
