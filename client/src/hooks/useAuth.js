import { useContext } from 'react';
import { AuthContext } from '../context/authContext.js';

// const { user, googleStatus, signIn, signOutUser, reconnectGoogle } = useAuth();
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}