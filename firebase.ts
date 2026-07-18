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

const configuredDatabaseUrl = import.meta.env.VITE_FIREBASE_DATABASE_URL?.replace(/\/$/, '');
const derivedDatabaseUrl = requiredFirebaseConfig.projectId
  ? `https://${requiredFirebaseConfig.projectId}-default-rtdb.europe-west1.firebasedatabase.app`
  : undefined;

export const firebaseDatabaseUrl = configuredDatabaseUrl || derivedDatabaseUrl;

const firebaseConfig = {
  ...requiredFirebaseConfig,
  databaseURL: firebaseDatabaseUrl,
};

export const isFirebaseConfigured = Object.values(requiredFirebaseConfig).every(Boolean);
export const isBringConfigured = isFirebaseConfigured && Boolean(firebaseDatabaseUrl);

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
