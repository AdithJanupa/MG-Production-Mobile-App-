# MG PRODUCTS Mobile (Flutter)

This Flutter app wraps the existing `MG-Product` web app so the UI and behavior stay the same on Android.

## Run locally

```bash
flutter pub get
flutter run -d android
```

## Build APK

```bash
flutter build apk --debug
```

APK output:

`build/app/outputs/flutter-apk/app-debug.apk`

## Install by USB (Android)

1. On phone: enable **Developer options** and **USB debugging**.
2. Connect phone with USB cable.
3. Confirm USB debugging prompt on phone.
4. Check device:

```bash
adb devices
```

5. Install APK:

```bash
adb install -r build/app/outputs/flutter-apk/app-debug.apk
```

## If Android SDK is missing

Install Android Studio, install SDK + platform tools, then configure Flutter:

```bash
flutter config --android-sdk "C:\\Users\\<YourUser>\\AppData\\Local\\Android\\Sdk"
flutter doctor --android-licenses
flutter doctor -v
```

## Bluetooth Bill Printing (PT-210)

1. Pair the **PT-210** printer in your phone Bluetooth settings first.
2. Open the app and tap the **printer icon** in the top bar.
3. Select your PT-210 from paired devices to connect.
4. Add and save an order.
5. After save, choose **OK** on the prompt **"Print bill now?"**.
6. The printed bill includes logo, print time, bill/order details, payment status, and note.
