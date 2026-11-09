// client/src/services/authBridge.js
// api.js is plain JavaScript (not a React component), so it cannot call hooks.
// AuthProvider registers its functions here, and api.js reads them from here.
// Tokens stay in memory only. Nothing is ever written to localStorage or Firestore.

let bridge = {
  getIdToken: async () => null,
  getGoogleToken: () => null,
  onUnauthorized: () => {},
};

export function registerAuthBridge(next) {
  bridge = { ...bridge, ...next };
}

export const getIdToken = () => bridge.getIdToken();
export const getGoogleToken = () => bridge.getGoogleToken();
export const notifyUnauthorized = () => bridge.onUnauthorized();