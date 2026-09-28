// One codebase, two builds: Electron for the desktop, this config for Android.
// The Android project in `android/` is generated from this file — after changing
// it run `npm run android:sync`.
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.tournamentorganizer',
  appName: 'Tournament Organizer',
  webDir: 'dist',
  // The app is offline by design: everything stays on the device, so no
  // server URL and no remote allow-list.
  server: { androidScheme: 'https' },
  android: {
    backgroundColor: '#f4f6f8',
    webContentsDebuggingEnabled: false,
  },
};

export default config;
