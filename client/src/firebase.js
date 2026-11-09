// client/src/firebase.js
// Firebase web config comes from client/.env (VITE_FIREBASE_*). These values are
// identifiers, not secrets, but we keep them out of the code anyway.
// Firebase starts only when first needed, so mock mode works without any config.

import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Smallest permissions that do the job:
//  - gmail.send      send email only (cannot read your inbox)
//  - calendar.events create and edit calendar events only
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events',
];

const REQUIRED = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'];

let auth;

export function getFirebaseAuth() {
  if (auth) return auth;

  const missing = REQUIRED.filter((key) => !import.meta.env[key]);
  if (missing.length > 0) {
    throw Object.assign(new Error(`Missing ${missing.join(', ')} in client/.env`), { code: 'app/missing-config' });
  }

  const app =
    getApps()[0] ??
    initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    });
  auth = getAuth(app);
  return auth;
}