import { getApps, initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';

const requiredFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseConfig = {
  ...requiredFirebaseConfig,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

export const isFirebaseConfigured = Object.values(requiredFirebaseConfig).every(Boolean);
export const isBringConfigured = isFirebaseConfigured && Boolean(firebaseConfig.databaseURL);

const app = isFirebaseConfigured
  ? (getApps()[0] || initializeApp(firebaseConfig))
  : null;

if (app && import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY && typeof window !== 'undefined') {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

export const firebaseAuth = app ? getAuth(app) : null;
export const firebaseDatabase = app && isBringConfigured ? getDatabase(app) : null;
export const firestore = app ? getFirestore(app) : null;

export const prepareFirebaseAuth = async () => {
  if (!firebaseAuth) throw new Error('sync/not-configured');
  await setPersistence(firebaseAuth, browserLocalPersistence);
  return firebaseAuth;
};
