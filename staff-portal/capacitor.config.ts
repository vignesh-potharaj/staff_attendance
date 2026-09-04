import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smartstaff.app.test',
  appName: 'Smart Staff (Test)',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
