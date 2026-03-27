import json, os

v   = os.environ.get('VERSION', '')
url = os.environ.get('APK_URL', '')

with open('version.json', 'w') as f:
    json.dump({
        'version': v,
        'url': url,
        'downloadPage': 'https://appdistribution.firebase.dev/i/aa46bb1c4e9a8dec',
        'releaseNotes': f'Version {v}'
    }, f, indent=2)
    f.write('\n')

print(f'version.json updated to {v}')
