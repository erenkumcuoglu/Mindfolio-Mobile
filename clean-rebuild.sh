#!/bin/bash
# Mindfolio Mobile — komple temiz rebuild (expo-av → expo-audio geçişi + source build)
# Kullanım: bash clean-rebuild.sh

set -e  # herhangi bir komut başarısız olursa dur

echo "── 1/8: node_modules, ios, package-lock, DerivedData siliniyor..."
rm -rf node_modules
rm -rf ios
rm -f package-lock.json
rm -rf ~/Library/Developer/Xcode/DerivedData/Mindfolio-*

echo "── 2/8: npm install..."
npm install

echo "── 2.5/8: expo install --fix — tüm paketleri SDK-uyumlu versiyona getir..."
# Bu kritik: expo-audio, expo-document-picker vs. hepsini Expo SDK versiyonuyla uyumlu hale getirir.
npx expo install --fix

echo "── 3/8: expo-av'ın hâlâ olmadığını doğrula..."
if [ -d "node_modules/expo-av" ]; then
  echo "❌ HATA: node_modules/expo-av hâlâ var. package.json'da hala referans olabilir."
  exit 1
fi
echo "✓ expo-av yok, expo-audio SDK-uyumlu versiyon yüklü."

echo "── 4/8: Prebuild — source build modunda..."
export RCT_USE_PREBUILT_RNCORE=0
export EXPO_USE_PRECOMPILED_MODULES=0
export EX_DEV_CLIENT_NETWORK_INSPECTOR=false
npx expo prebuild --platform ios --clean

echo "── 5/8: Podfile.properties.json'a source build ayarları yaz..."
cat > ios/Podfile.properties.json << 'EOF'
{
  "expo.jsEngine": "hermes",
  "EX_DEV_CLIENT_NETWORK_INSPECTOR": "false",
  "expo.inlineModules.watchedDirectories": "[]",
  "expo.inlineModules.xcodeProjectTargets": "{\"mainTarget\":\"Mindfolio\",\"targets\":[]}",
  "ios.buildReactNativeFromSource": "true",
  "EXPO_USE_PRECOMPILED_MODULES": "false",
  "ios.deploymentTarget": "16.4"
}
EOF

echo "── 6/8: Podfile'a sandbox + deployment target post_install ekle..."
# Bu, Podfile'ın post_install bloğuna ekleme yapar (varsa güncellemez, sadece ekler).
if ! grep -q "ENABLE_USER_SCRIPT_SANDBOXING" ios/Podfile; then
  # Eski post_install'ı yeni haliyle değiştir
  python3 << 'PYEOF'
import re
with open('ios/Podfile') as f: content = f.read()
new_block = '''  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )

    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.4'
      end
    end
  end'''
pattern = r'  post_install do \|installer\|.*?^  end'
content = re.sub(pattern, new_block, content, count=1, flags=re.DOTALL | re.MULTILINE)
with open('ios/Podfile', 'w') as f: f.write(content)
print("✓ Podfile güncellendi")
PYEOF
fi

echo "── 7/8: pod install (source'tan derliyor, 5-10 dk sürer)..."
cd ios
pod install
cd ..

echo "── 8/8: Bitti. Xcode açılıyor..."
open ios/Mindfolio.xcworkspace

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  XCODE'DA YAPILACAKLAR:"
echo "  1) Sol panel → Mindfolio target → Signing & Capabilities"
echo "  2) Team: kendi Apple ID'ni seç"
echo "  3) iPhone'unu üstteki dropdown'dan seç"
echo "  4) Cmd+R — build başlar (ilk kez 10-15 dk)"
echo "═══════════════════════════════════════════════════════"
