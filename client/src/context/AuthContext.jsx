
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
  getAdditionalUserInfo,
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, googleProvider, db } from "../services/firebase";

const AuthContext = createContext(null);
const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
const getVerificationCooldownKey = (uid) =>
  `duewise-verification-resend-until-${uid}`;
const startVerificationResendCooldown = (uid) => {
  const availableAt = Date.now() + VERIFICATION_RESEND_COOLDOWN_MS;
  localStorage.setItem(getVerificationCooldownKey(uid), String(availableAt));
  return availableAt;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verificationResendCooldownUntil, setVerificationResendCooldownUntil] =
    useState(0);
  const [verificationResendSeconds, setVerificationResendSeconds] = useState(0);


const syncUserDocument = async (firebaseUser) => {
  if (!firebaseUser) return;

  const userRef = doc(db, "users", firebaseUser.uid);
  const userSnapshot = await getDoc(userRef);

  const existingData = userSnapshot.exists()
    ? userSnapshot.data()
    : {};

  const provider =
    firebaseUser.providerData?.[0]?.providerId || "password";

  const updates = {
    uid: firebaseUser.uid,
    email: firebaseUser.email || "",
    emailVerified: firebaseUser.emailVerified,
    provider,
  };

  // Only fill in the name if it is missing
  if (!existingData.fullName && firebaseUser.displayName) {
    updates.fullName = firebaseUser.displayName;
  }

  // Preserve the original account creation timestamp
  if (!existingData.createdAt) {
    updates.createdAt = serverTimestamp();
  }

  await setDoc(userRef, updates, { merge: true });
};


  useEffect(() => {
    let loadingTimer;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
  console.log(
    "AUTH STATE CHANGED:",
    currentUser ? currentUser.email : "SIGNED OUT",
    currentUser ? currentUser.emailVerified : null
  );

  setUser(currentUser);
    const cooldownUntil = currentUser
      ? Number(localStorage.getItem(getVerificationCooldownKey(currentUser.uid)))
      : 0;
    const activeCooldownUntil =
      Number.isFinite(cooldownUntil) && cooldownUntil > Date.now()
        ? cooldownUntil
        : 0;
    if (currentUser && !activeCooldownUntil) {
      localStorage.removeItem(getVerificationCooldownKey(currentUser.uid));
    }
    setVerificationResendCooldownUntil(activeCooldownUntil);
    setVerificationResendSeconds(
      activeCooldownUntil
        ? Math.ceil((activeCooldownUntil - Date.now()) / 1000)
        : 0
    );

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

  useEffect(() => {
    const pendingEmailVerificationUid =
      user &&
      !user.emailVerified &&
      user.providerData.some((provider) => provider.providerId === "password")
        ? user.uid
        : null;

    if (!pendingEmailVerificationUid) return;

    let active = true;
    let refreshing = false;

    const refreshVerificationStatus = async () => {
      if (document.visibilityState === "hidden" || refreshing) return;

      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== pendingEmailVerificationUid) return;

      refreshing = true;
      try {
        await currentUser.reload();
        if (active && currentUser.emailVerified) {
          setUser({ ...currentUser });

          try {
            await syncUserDocument(currentUser);
          } catch (error) {
            console.error("Failed to sync verified user profile:", error);
          }
        }
      } catch (error) {
        console.error("Email verification status refresh failed:", error);
      } finally {
        refreshing = false;
      }
    };

    const interval = setInterval(refreshVerificationStatus, 5000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshVerificationStatus();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", refreshVerificationStatus);
    refreshVerificationStatus();

    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", refreshVerificationStatus);
    };
  }, [user]);

  useEffect(() => {
    if (!verificationResendCooldownUntil || !user?.uid) return;

    const updateCooldown = () => {
      const secondsLeft = Math.max(
        0,
        Math.ceil((verificationResendCooldownUntil - Date.now()) / 1000)
      );
      setVerificationResendSeconds(secondsLeft);

      if (secondsLeft === 0) {
        localStorage.removeItem(getVerificationCooldownKey(user.uid));
        setVerificationResendCooldownUntil(0);
      }
    };

    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [verificationResendCooldownUntil, user?.uid]);

  // Google authentication
  
const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);

    const additionalInfo = getAdditionalUserInfo(result);

    // Create or complete the Firestore user document
    await syncUserDocument(result.user);

    setUser({ ...result.user });

    return {
      user: result.user,
      isNewUser: additionalInfo?.isNewUser ?? false,
    };
  } catch (error) {
    console.error("Google authentication error:", error);
    throw error;
  }
};


  // Register with email and password
  
const registerWithEmail = async (email, password, fullName) => {
  try {
    const result = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

    await updateProfile(result.user, {
      displayName: fullName.trim(),
    });

    // Create the user's Firestore document
    await setDoc(
      doc(db, "users", result.user.uid),
      {
        uid: result.user.uid,
        fullName: fullName.trim(),
        email: email.trim(),
        emailVerified: false,
        provider: "password",
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Send email verification
    await sendEmailVerification(result.user);
    setVerificationResendCooldownUntil(
      startVerificationResendCooldown(result.user.uid)
    );

    setUser({ ...result.user });

    return result.user;
  } catch (error) {
    console.error("Email registration error:", error);
    throw error;
  }
};

  // Sign in with email and password
 
const loginWithEmail = async (email, password) => {
  try {
    const result = await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

    await result.user.reload();
    await syncUserDocument(result.user);

    if (!result.user.emailVerified) {
      setUser({ ...result.user });

      throw {
        code: "auth/email-not-verified",
        message: "Please verify your email address before signing in.",
      };
    }

    setUser({ ...result.user });

    return result.user;
  } catch (error) {
    console.error("Email login error:", error);
    throw error;
  }
};


  // Send password reset email
  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return true;
    } catch (error) {
      console.error("Password reset error:", error);
      throw error;
    }
  };

  // Resend email verification
  const resendVerificationEmail = async () => {
    try {
      if (!auth.currentUser) {
        throw new Error("No authenticated user found.");
      }

      const cooldownKey = getVerificationCooldownKey(auth.currentUser.uid);
      const cooldownUntil = Number(localStorage.getItem(cooldownKey));
      const secondsLeft = Math.ceil((cooldownUntil - Date.now()) / 1000);
      if (Number.isFinite(cooldownUntil) && secondsLeft > 0) {
        throw new Error(
          `Please wait ${secondsLeft} seconds before requesting another verification email.`
        );
      }

      await auth.currentUser.reload();

      if (auth.currentUser.emailVerified) {
        throw new Error("Your email is already verified. Please continue to DueWise.");
      }

      await sendEmailVerification(auth.currentUser);
      setVerificationResendCooldownUntil(
        startVerificationResendCooldown(auth.currentUser.uid)
      );
      return true;
    } catch (error) {
      console.error("Resend verification error:", error);
      throw error;
    }
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

  // Update profile
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

  // Refresh profile and authentication status
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
    verificationResendSeconds,
    loginWithGoogle,
    registerWithEmail,
    loginWithEmail,
    resetPassword,
    resendVerificationEmail,
    logout,
    updateUserProfile,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
