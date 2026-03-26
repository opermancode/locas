import json, os, sys

v = os.environ.get('VERSION', '')
if not v:
    print("ERROR: VERSION is empty"); sys.exit(1)

try:
    with open('app.json') as f:
        old = json.load(f)
    vc = (old.get('expo',{}).get('android',{}).get('versionCode') or 10) + 1
except Exception as e:
    print(f"app.json corrupt ({e}), using fallback versionCode=11")
    vc = 11

app = {
    "expo": {
        "name": "Locas", "slug": "locas", "scheme": "locas",
        "version": v, "orientation": "portrait",
        "icon": "./assets/icon.png", "userInterfaceStyle": "light",
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
            ["expo-splash-screen", {"backgroundColor": "#FF6B00", "resizeMode": "contain", "image": "./assets/icon.png"}],
            "expo-sqlite",
            "@react-native-firebase/app",
            "@react-native-firebase/auth"
        ],
        "owner": "operman-code",
        "extra": {"eas": {"projectId": "4ecd08a1-218e-44b8-8812-242559988c0b"}}
    }
}

with open('app.json', 'w') as f:
    json.dump(app, f, indent=2)
    f.write('\n')

with open('package.json') as f:
    pkg = json.load(f)
pkg['version'] = v
with open('package.json', 'w') as f:
    json.dump(pkg, f, indent=2)
    f.write('\n')

print(f"Done: version={v} versionCode={vc}")
