
import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  updateProfile,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "firebase/auth";

import { auth, googleProvider } from "../services/firebase";

const AuthContext = createContext(null);

// Authentication Provider
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Monitor Firebase authentication status
  useEffect(() => {
    let loadingTimer;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      clearTimeout(loadingTimer);

      loadingTimer = setTimeout(() => {
        setLoading(false);
      }, 2000);
    });

    return () => {
      clearTimeout(loadingTimer);
      unsubscribe();
    };
  }, []);

  // Sign in using Google
  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      console.error("Google sign-in error:", error);
      throw error;
    }
  };

  const registerWithEmail = async (email, password, fullName) => {
  const result = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

    await updateProfile(result.user, {
      displayName: fullName,
    });

    await sendEmailVerification(result.user);

    setUser({ ...result.user });

    return result.user;
  };

  const loginWithEmail = async (email, password) => {
    const result = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    return result.user;
  };

  const resetPassword = async (email) => {
    await sendPasswordResetEmail(auth, email);
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) {
      throw new Error("No authenticated user found.");
    }

    await sendEmailVerification(auth.currentUser);
  };

  // Sign out
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign-out error:", error);
      throw error;
    }
  };

  // Update the user's profile information
  const updateUserProfile = async (profileData) => {
    try {
      if (!auth.currentUser) {
        throw new Error("No authenticated user found.");
      }

      await updateProfile(auth.currentUser, profileData);

      setUser({ ...auth.currentUser });

      return auth.currentUser;
    } catch (error) {
      console.error("Profile update error:", error);
      throw error;
    }
  };

  // Refresh the current user's Firebase profile information
  const refreshUser = async () => {
    try {
      if (!auth.currentUser) {
        throw new Error("No authenticated user found.");
      }

      await auth.currentUser.reload();
      setUser({ ...auth.currentUser });

      return auth.currentUser;
    } catch (error) {
      console.error("User refresh error:", error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    loginWithGoogle,
    logout,
    updateUserProfile,
    refreshUser,
    registerWithEmail,
    loginWithEmail,
    resetPassword,
    resendVerificationEmail,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to access authentication
export function useAuth() {
  return useContext(AuthContext);
}
