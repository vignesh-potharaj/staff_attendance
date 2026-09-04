import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smartadmin.app.test',
  appName: 'Smart Admin (Test)',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
