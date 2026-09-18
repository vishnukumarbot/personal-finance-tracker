# Finance Tracker mobile app

This is the Expo SDK 57 mobile client for Ledger. It uses the same email OTP service and synchronized Netlify data store as the web app. A local device cache keeps the last synchronized data visible if the connection is temporarily unavailable.

Login requires the demonstration password `Cursor@123` followed by the emailed OTP. The fixed client-side password is intentionally simple for project demonstration and should be replaced with server-side authentication for production use.

The transaction screen supports type, category, and inclusive From/To date filters. Transaction dates and filter dates use the native Android/iOS date picker.

Sign in with the same email on web and Android to access the same transactions. The app refreshes every 30 seconds while open and whenever it returns to the foreground. Transaction changes require an internet connection so multiple devices cannot create conflicting offline copies.

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
