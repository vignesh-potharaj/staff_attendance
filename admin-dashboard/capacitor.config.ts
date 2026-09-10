import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nccadmin.app',
  appName: 'NCC Admin',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
