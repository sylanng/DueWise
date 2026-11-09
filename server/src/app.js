// server/src/app.js  (entry point: npm run dev / npm start)
import 'dotenv/config';
import { createApp } from './createApp.js';
import { adminAuth, adminDb } from './config/firebaseAdmin.js';
import { createFirestoreStore } from './services/firestore.js';

const PORT = process.env.PORT || 3001;
const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const store = createFirestoreStore(adminDb());

const app = createApp({
  verifyIdToken: (token) => adminAuth().verifyIdToken(token),
  store,
  allowedOrigins,
});

// Connect to Firestore now so the first user request isn't the slow one
store
  .warmUp()
  .then(() => console.log('Firestore connection ready'))
  .catch((err) => console.warn('Firestore warm-up failed (will retry on first request):', err.message));

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}  (allowed origins: ${allowedOrigins.join(', ')})`);
});