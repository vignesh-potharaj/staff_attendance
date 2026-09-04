/**
 * Option 2: Dual-Platform Notification Service (WebPush VAPID for PWA + Native FCM for Android APK)
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export const isNotificationSupported = (): boolean => {
  if (Capacitor.isNativePlatform()) return true;
  return typeof window !== 'undefined' && 'Notification' in window;
};

export const getNotificationPermission = (): NotificationPermission => {
  if (!isNotificationSupported()) return 'denied';
  if (typeof window !== 'undefined' && 'Notification' in window) {
    return Notification.permission;
  }
  return 'default';
};

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await PushNotifications.requestPermissions();
      return res.receive === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }
  if (!isNotificationSupported()) return 'denied';
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return 'denied';
  }
};

export const sendInstantNotification = async (
  title: string,
  body: string,
  options?: NotificationOptions
): Promise<void> => {
  if (!isNotificationSupported()) return;

  const defaultOptions: NotificationOptions = {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: 'smart-attend-instant',
    data: { url: '/staff/dashboard' },
    ...options,
  };

  try {
    new Notification(title, defaultOptions);
  } catch (err) {
    console.error('Failed to trigger browser notification:', err);
  }
};

let shiftStartTimeout: number | null = null;
let shiftEndTimeout: number | null = null;

export const scheduleShiftReminders = (startTimeStr?: string | null, endTimeStr?: string | null): void => {
  if (!isNotificationSupported()) return;

  if (shiftStartTimeout) clearTimeout(shiftStartTimeout);
  if (shiftEndTimeout) clearTimeout(shiftEndTimeout);

  const now = new Date();

  // Schedule 15-minute Pre-Shift Reminder
  if (startTimeStr) {
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const shiftStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startH, startM, 0);
    const reminderTime = new Date(shiftStart.getTime() - 15 * 60 * 1000);

    const msUntilReminder = reminderTime.getTime() - now.getTime();
    if (msUntilReminder > 0 && msUntilReminder < 24 * 60 * 60 * 1000) {
      shiftStartTimeout = window.setTimeout(() => {
        sendInstantNotification(
          '⏰ Shift Starting Soon!',
          `Your shift begins in 15 minutes (${startTimeStr}). Please mark check-in.`,
          { tag: 'shift-reminder', data: { url: '/staff/mark-attendance' } }
        );
      }, msUntilReminder);
      console.log(`⏰ Scheduled shift reminder in ${Math.round(msUntilReminder / 60000)} minutes`);
    }
  }

  // Schedule Check-Out Reminder at Shift End Time
  if (endTimeStr) {
    const [endH, endM] = endTimeStr.split(':').map(Number);
    const shiftEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM, 0);

    const msUntilEnd = shiftEnd.getTime() - now.getTime();
    if (msUntilEnd > 0 && msUntilEnd < 24 * 60 * 60 * 1000) {
      shiftEndTimeout = window.setTimeout(() => {
        sendInstantNotification(
          '🔔 Shift Completed!',
          `Your shift ended at ${endTimeStr}. Don't forget to mark check-out.`,
          { tag: 'checkout-reminder', data: { url: '/staff/mark-attendance' } }
        );
      }, msUntilEnd);
      console.log(`🔔 Scheduled check-out reminder in ${Math.round(msUntilEnd / 60000)} minutes`);
    }
  }
};

export const subscribeUserToPush = async (
  apiClient: { get: Function; post: Function },
  forceRefresh: boolean = false
): Promise<{ success: boolean; message: string; endpoint?: string }> => {
  console.log('[Push Service] 🔍 Initiating FCM token registration for Native App');

  if (forceRefresh) {
    localStorage.removeItem('cached_fcm_token');
  }

  if (Capacitor.isNativePlatform()) {
    try {
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive !== 'granted') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive === 'granted') {
        return new Promise((resolve) => {
          let hasResolved = false;

          PushNotifications.removeAllListeners().then(() => {
            PushNotifications.addListener('registration', async (token) => {
              if (hasResolved) return;
              hasResolved = true;
              console.log('[Push Service] 📲 FRESH Native FCM Token registered:', token.value);
              localStorage.setItem('cached_fcm_token', token.value);
              try {
                await apiClient.post('/notifications/subscribe', {
                  endpoint: `fcm_${token.value}`,
                  keys: { p256dh: 'native_fcm', auth: 'native_fcm' }
                });
                resolve({
                  success: true,
                  message: `Native Android FCM Token synced with backend! (${token.value.slice(0, 10)}...)`,
                  endpoint: token.value
                });
              } catch (syncErr: any) {
                resolve({
                  success: false,
                  message: `Failed to sync native FCM token: ${syncErr?.message || syncErr}`
                });
              }
            });

            PushNotifications.addListener('registrationError', (err) => {
              if (hasResolved) return;
              hasResolved = true;
              console.error('[Push Service] Native FCM registration error:', err);
              resolve({ success: false, message: `Native FCM Error: ${JSON.stringify(err)}` });
            });

            PushNotifications.register().catch((err) => {
              if (hasResolved) return;
              hasResolved = true;
              resolve({ success: false, message: `Register call error: ${err}` });
            });

            setTimeout(() => {
              if (!hasResolved) {
                hasResolved = true;
                resolve({ success: false, message: 'Native FCM token registration timed out. Please retry.' });
              }
            }, 6000);
          });
        });
      } else {
        return { success: false, message: 'Native Android notification permission was denied.' };
      }
    } catch (nativeErr: any) {
      console.warn('[Push Service] Native FCM registration exception:', nativeErr);
      return { success: false, message: `Native FCM registration exception: ${nativeErr?.message || nativeErr}` };
    }
  }

  return { success: false, message: 'Push notifications are enabled exclusively on the native mobile app.' };
};

export const initNativePushListeners = (): void => {
  if (Capacitor.isNativePlatform()) {
    try {
      PushNotifications.addListener('registration', (token) => {
        console.log('📲 Persistent FCM Token listener:', token.value);
        localStorage.setItem('cached_fcm_token', token.value);
      });
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('🔔 Native Push Notification Received:', notification);
      });
      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('🔔 Native Push Action Performed:', notification);
      });
    } catch (err) {
      console.warn('Failed to initialize native push listeners:', err);
    }
  }
};

export const triggerDelayedTestNotification = (delayMs: number = 3000): void => {
  console.log(`[Push Service] 🧪 Scheduling delayed test notification in ${delayMs}ms...`);
  setTimeout(() => {
    sendInstantNotification(
      '🧪 Test Push Notification!',
      'This is a delayed test notification received from Smart Staff.',
      {
        tag: 'delayed-test-notification',
        data: { url: '/staff/dashboard' }
      }
    );
  }, delayMs);
};
