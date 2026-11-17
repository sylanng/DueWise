
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const serviceAccount = require('../../serviceAccountKey.json');

// Initialize Firebase only once
const firebaseApp = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert(serviceAccount),
    });

// Connect to Firestore and Firebase Authentication
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

module.exports = {
  db,
  auth,
};
