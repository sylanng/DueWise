// server/src/config/firebaseAdmin.js
// Starts the Firebase Admin SDK once. Credentials come from:
//   1. FIREBASE_SERVICE_ACCOUNT  (the whole key file as one line; use this when deployed)
//   2. server/serviceAccountKey.json  (local development, never committed)

import { readFileSync } from 'node:fs';
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    const account = JSON.parse(raw);
    // Hosting dashboards often turn real newlines into the two characters \n
    if (account.private_key) account.private_key = account.private_key.replace(/\\n/g, '\n');
    return account;
  }
  try {
    return JSON.parse(readFileSync(new URL('../../serviceAccountKey.json', import.meta.url), 'utf8'));
  } catch {
    throw new Error(
      'Firebase credentials not found. Put serviceAccountKey.json in the server folder, ' +
        'or set FIREBASE_SERVICE_ACCOUNT.'
    );
  }
}

function adminApp() {
  return getApps().length ? getApp() : initializeApp({ credential: cert(loadServiceAccount()) });
}

export const adminAuth = () => getAuth(adminApp());
export const adminDb = () => getFirestore(adminApp());