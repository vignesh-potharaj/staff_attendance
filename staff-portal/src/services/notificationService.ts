/**
 * Browser Notification & WebPush VAPID Helper Service (Web PWA + Capacitor Native)
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
  console.log(`[Push Diagnostic] 🔍 Initiating WebPush VAPID subscription on ${Capacitor.isNativePlatform() ? 'Native Android App' : 'Web/PWA'}`);

  // Request native permission first if on Capacitor Android
  if (Capacitor.isNativePlatform()) {
    try {
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive !== 'granted') {
        await PushNotifications.requestPermissions();
      }
    } catch (err) {
      console.warn('Native permission check exception:', err);
    }
  }

  const perm = getNotificationPermission();
  if (perm !== 'granted' && !Capacitor.isNativePlatform()) {
    const msg = `Notification permission is '${perm}'. User must allow notifications.`;
    console.warn(`[Push Diagnostic] ⚠️ ${msg}`);
    return { success: false, message: msg };
  }

  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      const msg = 'ServiceWorker or PushManager is not supported in this browser.';
      console.warn(`[Push Diagnostic] ⚠️ ${msg}`);
      return { success: false, message: msg };
    }

    console.log('[Push Diagnostic] ⏳ Waiting for ServiceWorker registration...');
    const registration = await navigator.serviceWorker.ready;
    console.log('[Push Diagnostic] ✅ ServiceWorker ready. Active worker scope:', registration.scope);

    let existingSub = await registration.pushManager.getSubscription();

    if (existingSub && forceRefresh) {
      console.log('[Push Diagnostic] 🔄 Force refresh requested. Unsubscribing stale endpoint...');
      try {
        await existingSub.unsubscribe();
        console.log('[Push Diagnostic] 🗑️ Stale subscription unsubscribed.');
        existingSub = null;
      } catch (unsubErr) {
        console.warn('[Push Diagnostic] Failed to unsubscribe stale push endpoint:', unsubErr);
      }
    }

    console.log('[Push Diagnostic] 🔑 Fetching VAPID public key from /notifications/vapid-public-key...');
    const keyRes = await apiClient.get('/notifications/vapid-public-key');
    const publicKey = keyRes.data?.publicKey;

    if (!publicKey) {
      const msg = 'Backend returned empty VAPID public key.';
      console.error(`[Push Diagnostic] ❌ ${msg}`);
      return { success: false, message: msg };
    }

    console.log(`[Push Diagnostic] 🔑 Received VAPID Public Key (${publicKey.length} chars):`, publicKey);
    const convertedKey = urlBase64ToUint8Array(publicKey);

    let subscription = existingSub;

    if (!subscription) {
      console.log('[Push Diagnostic] 📲 Calling PushManager.subscribe()...');
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey as any,
        });
        console.log('[Push Diagnostic] 🎉 PushManager.subscribe() succeeded!');
      } catch (subErr: any) {
        console.error('[Push Diagnostic] ❌ PushManager.subscribe() threw an error:', subErr);

        if (existingSub) {
          try {
            console.log('[Push Diagnostic] Attempting emergency un-register retry...');
            await existingSub.unsubscribe();
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: convertedKey as any,
            });
            console.log('[Push Diagnostic] 🎉 Emergency retry PushManager.subscribe() succeeded!');
          } catch (retryErr) {
            console.error('[Push Diagnostic] ❌ Emergency retry failed:', retryErr);
          }
        }
      }
    }

    if (!subscription) {
      const msg = 'Browser/App failed to create Web Push subscription endpoint.';
      console.error(`[Push Diagnostic] ❌ ${msg}`);
      return { success: false, message: msg };
    }

    const subJson = subscription.toJSON();
    if (!subJson.endpoint || !subJson.keys) {
      const msg = 'Push subscription JSON missing endpoint or keys.';
      console.error(`[Push Diagnostic] ❌ ${msg}`, subJson);
      return { success: false, message: msg };
    }

    console.log('[Push Diagnostic] 🚀 Syncing VAPID push subscription keys with backend POST /notifications/subscribe...');
    await apiClient.post('/notifications/subscribe', {
      endpoint: subJson.endpoint,
      keys: {
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      },
    });

    console.log('[Push Diagnostic] ✅ WebPush VAPID subscription synced successfully with backend!');
    return {
      success: true,
      message: 'Subscribed and synced WebPush VAPID keys successfully!',
      endpoint: subJson.endpoint
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error('❌ [Push Diagnostic Error] Unexpected failure during push subscription:', err);
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
  console.log(`[Push Diagnostic] 🧪 Scheduling delayed test notification in ${delayMs}ms...`);
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
