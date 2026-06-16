import { initializeApp, getApp, getApps } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const isFirebaseMessagingSupported = async () => {
  if (typeof window === 'undefined') return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
};

export const getFirebaseMessaging = async () => {
  if (typeof window === 'undefined') return null;
  const supported = await isFirebaseMessagingSupported();
  if (!supported) return null;
  return getMessaging(app);
};

export const getFirebasePushToken = async (serviceWorkerRegistration) => {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return null;

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) return null;

  return getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration,
  });
};

export const subscribeToForegroundPush = async (handler) => {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => {};
  return onMessage(messaging, handler);
};