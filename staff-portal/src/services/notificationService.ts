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
    icon: '/icons/icon-192.png',
    badge: '/favicon.svg',
    tag: 'smart-attend-instant',
    data: { url: '/staff/dashboard' },
    ...options,
  };

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, defaultOptions);
      return;
    }
  } catch (err) {
    console.warn('Service worker notification failed, falling back to Notification API:', err);
  }

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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const subscribeUserToPush = async (
  apiClient: { get: Function; post: Function },
  forceRefresh: boolean = false
): Promise<{ success: boolean; message: string; endpoint?: string }> => {
  console.log(`[Push Service Option 2] 🔍 Initiating subscription on ${Capacitor.isNativePlatform() ? 'Native Android App (FCM Token)' : 'Web PWA (VAPID Keys)'}`);

  // -------------------------------------------------------------
  // PATHWAY 1: NATIVE ANDROID APK (FCM TOKEN REGISTRATION)
  // -------------------------------------------------------------
  if (Capacitor.isNativePlatform()) {
    try {
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive !== 'granted') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive === 'granted') {
        await PushNotifications.register();
        return new Promise((resolve) => {
          PushNotifications.addListener('registration', async (token) => {
            console.log('[Push Service] 📲 Native FCM Token registered:', token.value);
            try {
              await apiClient.post('/notifications/subscribe', {
                endpoint: `fcm_${token.value}`,
                keys: { p256dh: 'native_fcm', auth: 'native_fcm' }
              });
              resolve({
                success: true,
                message: 'Native Android FCM Token registered & synced with backend!',
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
            console.error('[Push Service] Native FCM registration error:', err);
            resolve({ success: false, message: `Native FCM Error: ${JSON.stringify(err)}` });
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

  // -------------------------------------------------------------
  // PATHWAY 2: WEB PWA BROWSER (VAPID WEBPUSH REGISTRATION)
  // -------------------------------------------------------------
  const perm = getNotificationPermission();
  if (!isNotificationSupported()) {
    const msg = 'Notification API is not supported in this browser.';
    console.warn(`[Push Service] ⚠️ ${msg}`);
    return { success: false, message: msg };
  }

  if (perm !== 'granted') {
    const msg = `Notification permission is '${perm}'. User must allow notifications.`;
    console.warn(`[Push Service] ⚠️ ${msg}`);
    return { success: false, message: msg };
  }

  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      const msg = 'ServiceWorker or PushManager is not supported in this browser.';
      console.warn(`[Push Service] ⚠️ ${msg}`);
      return { success: false, message: msg };
    }

    console.log('[Push Service] ⏳ Waiting for ServiceWorker registration...');
    const registration = await navigator.serviceWorker.ready;
    console.log('[Push Service] ✅ ServiceWorker ready. Scope:', registration.scope);

    let existingSub = await registration.pushManager.getSubscription();

    if (existingSub && forceRefresh) {
      console.log('[Push Service] 🔄 Force refresh requested. Unsubscribing stale endpoint...');
      try {
        await existingSub.unsubscribe();
        existingSub = null;
      } catch (unsubErr) {
        console.warn('[Push Service] Failed to unsubscribe stale push endpoint:', unsubErr);
      }
    }

    console.log('[Push Service] 🔑 Fetching VAPID public key from /notifications/vapid-public-key...');
    const keyRes = await apiClient.get('/notifications/vapid-public-key');
    const publicKey = keyRes.data?.publicKey;

    if (!publicKey) {
      const msg = 'Backend returned empty VAPID public key.';
      console.error(`[Push Service] ❌ ${msg}`);
      return { success: false, message: msg };
    }

    console.log(`[Push Service] 🔑 Received VAPID Public Key (${publicKey.length} chars):`, publicKey);
    const convertedKey = urlBase64ToUint8Array(publicKey);

    let subscription = existingSub;

    if (!subscription) {
      console.log('[Push Service] 📲 Calling PushManager.subscribe()...');
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey as any,
        });
        console.log('[Push Service] 🎉 PushManager.subscribe() succeeded!');
      } catch (subErr: any) {
        console.error('[Push Service] ❌ PushManager.subscribe() threw an error:', subErr);

        if (existingSub) {
          try {
            await existingSub.unsubscribe();
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: convertedKey as any,
            });
          } catch (retryErr) {
            console.error('[Push Service] ❌ Emergency retry failed:', retryErr);
          }
        }
      }
    }

    if (!subscription) {
      const msg = 'Browser failed to create Web Push subscription endpoint.';
      console.error(`[Push Service] ❌ ${msg}`);
      return { success: false, message: msg };
    }

    const subJson = subscription.toJSON();
    if (!subJson.endpoint || !subJson.keys) {
      const msg = 'Push subscription JSON missing endpoint or keys.';
      console.error(`[Push Service] ❌ ${msg}`, subJson);
      return { success: false, message: msg };
    }

    console.log('[Push Service] 🚀 Syncing WebPush VAPID keys with backend POST /notifications/subscribe...');
    await apiClient.post('/notifications/subscribe', {
      endpoint: subJson.endpoint,
      keys: {
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      },
    });

    console.log('[Push Service] ✅ WebPush VAPID subscription synced successfully with backend!');
    return {
      success: true,
      message: 'Subscribed and synced WebPush VAPID keys successfully!',
      endpoint: subJson.endpoint
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error('❌ [Push Service Error] Unexpected failure during push subscription:', err);
    return { success: false, message: `Subscription failed: ${errorMsg}` };
  }
};

export const initNativePushListeners = (): void => {
  if (Capacitor.isNativePlatform()) {
    try {
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
