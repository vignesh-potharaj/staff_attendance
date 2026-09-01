/**
 * Browser Notification & Service Worker Notification Helper Service
 */

export const isNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

export const getNotificationPermission = (): NotificationPermission => {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
};

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
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
  if (!isNotificationSupported() || getNotificationPermission() !== 'granted') {
    return;
  }

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
  if (!isNotificationSupported() || getNotificationPermission() !== 'granted') {
    return;
  }

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
  const perm = getNotificationPermission();
  console.log(`[Push Diagnostic] 🔍 Initiating push subscription. Permission state: '${perm}'`);

  if (!isNotificationSupported()) {
    const msg = 'Notification API is not supported in this browser.';
    console.warn(`[Push Diagnostic] ⚠️ ${msg}`);
    return { success: false, message: msg };
  }

  if (perm !== 'granted') {
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

        // If subscription failed due to key mismatch or corrupt state, attempt 1 reset retry
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
      const msg = 'Browser failed to create Web Push subscription endpoint.';
      console.error(`[Push Diagnostic] ❌ ${msg}`);
      return { success: false, message: msg };
    }

    const subJson = subscription.toJSON();
    if (!subJson.endpoint || !subJson.keys) {
      const msg = 'Push subscription JSON missing endpoint or keys.';
      console.error(`[Push Diagnostic] ❌ ${msg}`, subJson);
      return { success: false, message: msg };
    }

    console.log('[Push Diagnostic] 🚀 Syncing push subscription keys with backend POST /notifications/subscribe...');
    const syncRes = await apiClient.post('/notifications/subscribe', {
      endpoint: subJson.endpoint,
      keys: {
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      },
    });

    console.log('[Push Diagnostic] ✅ Push subscription synced successfully with backend!', syncRes.data);
    return {
      success: true,
      message: 'Subscribed and synced with backend successfully!',
      endpoint: subJson.endpoint
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error('❌ [Push Diagnostic Error] Unexpected failure during push subscription:', err);
    return { success: false, message: `Subscription failed: ${errorMsg}` };
  }
};

export const getNotificationDebugInfo = async (): Promise<{
  supported: boolean;
  permission: NotificationPermission;
  hasServiceWorker: boolean;
  activeEndpoint: string | null;
}> => {
  const supported = isNotificationSupported();
  const permission = getNotificationPermission();
  const hasServiceWorker = typeof window !== 'undefined' && 'serviceWorker' in navigator;
  let activeEndpoint: string | null = null;

  if (hasServiceWorker && 'PushManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub?.endpoint) {
        activeEndpoint = sub.endpoint;
      }
    } catch {
      // Ignore
    }
  }

  return { supported, permission, hasServiceWorker, activeEndpoint };
};

export const triggerDelayedTestNotification = (delayMs: number = 3000): void => {
  console.log(`[Push Diagnostic] 🧪 Scheduling delayed test notification in ${delayMs}ms...`);
  setTimeout(() => {
    sendInstantNotification(
      '🧪 Test Push Notification!',
      'This is a delayed test notification received from Smart Staff (DEV).',
      {
        tag: 'delayed-test-notification',
        data: { url: '/staff/dashboard' }
      }
    );
  }, delayMs);
};

