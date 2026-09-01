import { registerPlugin, Capacitor } from '@capacitor/core';

export interface BatteryOptimizationPlugin {
  requestIgnoreBatteryOptimizations(): Promise<{ status: string }>;
}

const BatteryOptimization = registerPlugin<BatteryOptimizationPlugin>('BatteryOptimization');

export const requestIgnoreBatteryOptimizations = async (): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
    try {
      await BatteryOptimization.requestIgnoreBatteryOptimizations();
      return true;
    } catch (err) {
      console.error('Failed to trigger native battery optimization prompt:', err);
    }
  }
  
  // Fallback for Web/PWA or if native call fails
  const a = document.createElement('a');
  a.href = 'intent:#Intent;action=android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS;end';
  a.click();
  return false;
};

export default BatteryOptimization;
