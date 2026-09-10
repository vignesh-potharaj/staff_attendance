import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ncccadet.app',
  appName: 'NCC Cadet',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
