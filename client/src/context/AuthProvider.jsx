import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { getFirebaseAuth, GOOGLE_SCOPES } from '../firebase.js';
import { AuthContext } from './authContext.js';
import { registerAuthBridge } from '../services/authBridge.js';
import { MOCK_MODE } from '../services/api.js';

// Google access tokens last about an hour. We treat ours as expired a little early.
const GOOGLE_TOKEN_LIFETIME_MS = 55 * 60 * 1000;

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  GOOGLE_SCOPES.forEach((scope) => provider.addScope(scope));
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

// Holds who is signed in and the two tokens, in memory only:
//  - Firebase ID token: identifies the user to OUR API (Firebase refreshes it automatically)
//  - Google access token: lets our server call Gmail and Calendar for this user (about 1 hour)
// After a page refresh Firebase restores the user, but Google never re-issues the access
// token silently, so googleStatus becomes 'disconnected' until the user clicks Reconnect.
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!MOCK_MODE);
  const [googleStatus, setGoogleStatus] = useState('disconnected'); // connected | expired | disconnected
  const [notice, setNotice] = useState('');
  const googleTokenRef = useRef(null);
  const expiryTimer = useRef(null);

  const clearGoogle = useCallback(() => {
    clearTimeout(expiryTimer.current);
    googleTokenRef.current = null;
    setGoogleStatus('disconnected');
  }, []);

  const storeGoogleToken = useCallback((accessToken) => {
    clearTimeout(expiryTimer.current);
    googleTokenRef.current = accessToken;
    setGoogleStatus('connected');
    expiryTimer.current = setTimeout(() => {
      googleTokenRef.current = null;
      setGoogleStatus('expired');
    }, GOOGLE_TOKEN_LIFETIME_MS);
  }, []);

  // Follow Firebase's own sign-in state (restores the user after a page refresh)
  useEffect(() => {
    if (MOCK_MODE) return undefined;
    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(getFirebaseAuth(), (nextUser) => {
        setUser(nextUser);
        setLoading(false);
        if (!nextUser) clearGoogle();
      });
    } catch {
      setLoading(false); // Firebase not configured: the login page explains how to fix it
    }
    return () => {
      unsubscribe();
      clearTimeout(expiryTimer.current);
    };
  }, [clearGoogle]);

  // Opens the Google popup. Used for first sign-in AND for "Reconnect Google".
  const signIn = useCallback(async () => {
    const result = await signInWithPopup(getFirebaseAuth(), createGoogleProvider());
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) storeGoogleToken(credential.accessToken);
    setNotice('');
    return result.user;
  }, [storeGoogleToken]);

  const signOutUser = useCallback(async () => {
    await signOut(getFirebaseAuth());
    clearGoogle();
  }, [clearGoogle]);

  // Registered before any page effect runs, so the very first API call can find the tokens
  useLayoutEffect(() => {
    if (MOCK_MODE) return;
    registerAuthBridge({
      getIdToken: async () => {
        const current = getFirebaseAuth().currentUser;
        return current ? current.getIdToken() : null; // refreshes itself when expired
      },
      getGoogleToken: () => googleTokenRef.current,
      onUnauthorized: () => {
        if (!getFirebaseAuth().currentUser) return;
        setNotice('Your session expired. Please sign in again.');
        signOut(getFirebaseAuth()).catch(() => {});
      },
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      googleStatus,
      notice,
      clearNotice: () => setNotice(''),
      signIn,
      reconnectGoogle: signIn,
      signOutUser,
    }),
    [user, loading, googleStatus, notice, signIn, signOutUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
