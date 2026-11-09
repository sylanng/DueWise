// client/src/services/authErrors.js
// Turns Firebase sign-in error codes into messages a student can act on.

export function describeAuthError(error) {
  switch (error?.code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled. Click "Sign in with Google" to try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.';
    case 'auth/user-cancelled':
    case 'auth/access-denied':
      return 'Google permissions were not granted. DueWise needs them to send reminders and add calendar events.';
    case 'auth/unauthorized-domain':
      return 'This website is not authorized for sign-in yet. Add it under Firebase > Authentication > Settings > Authorized domains.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled. Turn it on in Firebase > Authentication > Sign-in method.';
    case 'auth/network-request-failed':
      return 'Network problem. Check your internet connection and try again.';
    case 'auth/invalid-api-key':
    case 'auth/configuration-not-found':
    case 'app/missing-config':
      return 'Firebase is not set up correctly. Check the VITE_FIREBASE_* values in client/.env and restart the app.';
    default:
      return 'Could not sign in. Please try again.';
  }
}