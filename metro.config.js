const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Push 'wasm' into the asset extensions to resolve the expo-sqlite error
config.resolver.assetExts.push('wasm');

module.exports = config;
