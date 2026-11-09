// server/src/config/cors.js
import cors from 'cors';

// allowedOrigins: e.g. ['http://localhost:5173', 'https://your-app.web.app']
export function buildCors(allowedOrigins) {
  return cors({
    origin(origin, callback) {
      // No Origin header = not a browser (curl, health checks): fine to answer
      callback(null, !origin || allowedOrigins.includes(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    // X-Google-Access-Token is used by the Calendar and Gmail routes (Phases 3 and 4)
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Google-Access-Token', 'Idempotency-Key'],
    maxAge: 600,
  });
}