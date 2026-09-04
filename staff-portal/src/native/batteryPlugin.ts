import { registerPlugin, Capacitor } from '@capacitor/core';

export interface BatteryOptimizationPlugin {
  requestIgnoreBatteryOptimizations(): Promise<{ status: string }>;
  checkNotificationPermission(): Promise<{ granted: boolean; permission: 'granted' | 'denied' }>;
  isBatteryOptimizationIgnored(): Promise<{ isIgnored: boolean }>;
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
  return false;
};

export const checkNativeNotificationPermission = async (): Promise<'granted' | 'denied' | 'default'> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await BatteryOptimization.checkNotificationPermission();
      return res.permission;
    } catch (err) {
      console.warn('Native notification permission check error:', err);
    }
  }
  if (typeof window !== 'undefined' && 'Notification' in window) {
    return Notification.permission;
  }
  return 'denied';
};

export const checkNativeBatteryOptimizationStatus = async (): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await BatteryOptimization.isBatteryOptimizationIgnored();
      return res.isIgnored;
    } catch {
      return false;
    }
  }
  return false;
};

export default BatteryOptimization;
