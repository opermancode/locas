import json, os, sys

v = os.environ.get('VERSION', '')
if not v:
    print("ERROR: VERSION is empty"); sys.exit(1)

# ── versionCode: read from repo if valid, else increment from 10 ──
try:
    with open('app.json') as f:
        old = json.load(f)
    vc = (old.get('expo',{}).get('android',{}).get('versionCode') or 10) + 1
except Exception as e:
    print(f"app.json unreadable ({e}), defaulting versionCode to 11")
    vc = 11

# ── Write app.json completely from scratch ────────────────────────
app = {
    "expo": {
        "name": "Locas",
        "slug": "locas",
        "scheme": "locas",
        "version": v,
        "orientation": "portrait",
        "icon": "./assets/icon.png",
        "userInterfaceStyle": "light",
        "ios": {
            "supportsTablet": False,
            "bundleIdentifier": "com.neurader.locas",
            "newArchEnabled": False
        },
        "android": {
            "package": "com.neurader.locas",
            "versionCode": vc,
            "adaptiveIcon": {
                "backgroundColor": "#FF6B00",
                "foregroundImage": "./assets/icon.png"
            },
            "googleServicesFile": "./google-services.json",
            "newArchEnabled": False
        },
        "plugins": [
            ["expo-build-properties", {"android": {"kotlinVersion": "2.0.21"}}],
            ["expo-splash-screen", {
                "backgroundColor": "#FF6B00",
                "resizeMode": "contain",
                "image": "./assets/icon.png"
            }],
            "expo-sqlite",
            "@react-native-firebase/app",
            "@react-native-firebase/auth"
        ],
        "owner": "operman-code",
        "extra": {
            "eas": {"projectId": "4ecd08a1-218e-44b8-8812-242559988c0b"}
        }
    }
}

with open('app.json', 'w') as f:
    json.dump(app, f, indent=2)
    f.write('\n')

print(f"app.json written: version={v} versionCode={vc}")

# ── Write package.json completely from scratch ────────────────────
pkg = {
    "name": "locas",
    "version": v,
    "main": "index.js",
    "scripts": {
        "start": "expo start",
        "android": "expo start --android",
        "ios": "expo start --ios"
    },
    "dependencies": {
        "@react-navigation/bottom-tabs": "^6.5.11",
        "@react-navigation/native": "^6.1.9",
        "@react-navigation/stack": "^6.3.20",
        "expo": "~54.0.0",
        "expo-build-properties": "~0.14.0",
        "expo-file-system": "~19.0.21",
        "expo-print": "~15.0.8",
        "expo-sharing": "~14.0.8",
        "expo-splash-screen": "~0.29.21",
        "expo-sqlite": "~16.0.10",
        "expo-status-bar": "~3.0.9",
        "expo-auth-session": "~7.0.10",
        "expo-web-browser": "~15.0.10",
        "react": "18.3.1",
        "react-dom": "18.3.1",
        "react-native": "0.76.7",
        "react-native-gesture-handler": "~2.28.0",
        "react-native-safe-area-context": "~5.6.0",
        "react-native-screens": "~4.16.0",
        "react-native-webview": "13.15.0",
        "@react-native-async-storage/async-storage": "2.2.0",
        "@react-native-firebase/app": "^21.0.0",
        "@react-native-firebase/auth": "^21.0.0",
        "localforage": "^1.10.0",
        "react-native-web": "~0.19.13",
        "firebase": "^10.12.0"
    },
    "devDependencies": {
        "@babel/core": "^7.20.0",
        "babel-preset-expo": "~54.0.10",
        "react-refresh": "~0.14.0",
        "@types/react": "~18.3.0"
    },
    "private": True,
    "expo": {
        "install": {"exclude": []}
    },
    "resolution": {
        "locas/src/db/db": "./src/db/db.web.js"
    }
}

with open('package.json', 'w') as f:
    json.dump(pkg, f, indent=2)
    f.write('\n')

print(f"package.json written: version={v}")
