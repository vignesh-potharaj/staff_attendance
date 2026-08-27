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
    icon: '/icons/icon-192x192.png',
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
