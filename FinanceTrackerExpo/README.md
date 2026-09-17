# Finance Tracker mobile app

This is the Expo SDK 57 mobile client for Ledger. It uses the same email OTP service as the web app and stores transactions locally on the device.

The transaction screen supports type, category, and inclusive From/To date filters. Transaction dates and filter dates use the native Android/iOS date picker.

## Run in Expo Go

Requirements: Node.js, an Android or iOS phone, and the current Expo Go app compatible with SDK 57.

```bash
cd FinanceTrackerExpo
npm install
npm start
```

Keep the phone and computer on the same Wi-Fi network, then scan the QR code from Expo Go. The start command clears stale Metro cache automatically.

If Expo Go cannot open the LAN URL, use a tunnel instead:

```bash
npm run start:tunnel
```

If Expo Go reports that the project is incompatible, update Expo Go. Android users can also install the matching Expo Go version from `https://expo.dev/go`.

The production authentication API is the default. To use another Netlify site, copy `.env.example` to `.env`, update `EXPO_PUBLIC_API_BASE_URL`, and restart Expo after changing it.

## Native builds

```bash
npm run android
npm run ios
```

These commands create/run native development builds and require the corresponding Android or iOS toolchain.

## Checks

```bash
npx tsc --noEmit
npx expo-doctor@latest
```
