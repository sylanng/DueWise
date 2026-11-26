
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getPasswordRequirements,
  getPasswordStrength,
} from "../utils/passwordUtils";
import LoadingScreen from "../components/LoadingScreen";
import DueWiseLogo from "../components/DueWiseLogo";

const keepLoadingVisible = async (startTime) => {
  const elapsed = Date.now() - startTime;
  const remaining = 2000 - elapsed;

  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
};

function Login() {
  const {
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
    logout,
    resendVerificationEmail,
    verificationResendSeconds,
  } = useAuth();

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loggingIn, setLoggingIn] = useState(false);
  const [mode, setMode] = useState("login");
  const [authLoadingMessage, setAuthLoadingMessage] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);

  const passwordRequirements = getPasswordRequirements(password);
  const passwordStrength = getPasswordStrength(password);

  const validateForm = () => {
    const newErrors = {};

    if (mode === "register" && !fullName.trim()) {
      newErrors.fullName = "Please enter your full name.";
    }

    if (!email.trim()) {
      newErrors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (mode !== "forgot" && !password) {
      newErrors.password = "Password is required.";
    } else if (
      mode === "register" &&
      passwordRequirements.some((requirement) => !requirement.met)
    ) {
      newErrors.password = "Please meet all password requirements.";
    }

    if (mode === "register" && !confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password.";
    } else if (
      mode === "register" &&
      password !== confirmPassword
    ) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    setFieldErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGoogleLogin = async () => {
    const startTime = Date.now();

    try {
      setError("");
      setSuccessMessage("");
      setAuthLoadingMessage("Connecting securely to Google...");
      setLoggingIn(true);

      const { isNewUser } = await loginWithGoogle();

      setAuthLoadingMessage(
        isNewUser
          ? "Creating your DueWise account..."
          : "Signing in to DueWise..."
      );
    } catch (err) {
      console.error("Google authentication error:", err);

      setError(
        err.code === "auth/popup-closed-by-user"
          ? "Google sign-in was cancelled."
          : "Google sign-in failed. Please try again."
      );
    } finally {
      await keepLoadingVisible(startTime);
      setLoggingIn(false);
      setAuthLoadingMessage("");
    }
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccessMessage("");
    setVerificationPending(false);

    if (!validateForm()) return;

    const startTime = Date.now();

    try {
      setLoggingIn(true);

      if (mode === "register") {
        await registerWithEmail(email, password, fullName.trim());

        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setFullName("");
        setFieldErrors({});
        setVerificationPending(true);

        setSuccessMessage(
          "Your DueWise account has been created! A verification email has been sent. Please check your inbox before signing in."
        );
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err) {
      console.error("Email authentication error:", err);

      if (err.code === "auth/email-not-verified") {
        setVerificationPending(true);
        setError(
          "Your email address is not verified yet. Please check your inbox or resend the verification email."
        );
      } else {
        const messages = {
          "auth/email-already-in-use": "This email is already registered.",
          "auth/invalid-email": "Please enter a valid email address.",
          "auth/invalid-credential": "Incorrect email or password.",
          "auth/weak-password": "Please use a stronger password.",
          "auth/user-not-found": "No account found with this email.",
          "auth/wrong-password": "Incorrect email or password.",
          "auth/too-many-requests":
            "Too many attempts. Please try again later.",
        };

        setError(
          messages[err.code] || err.message || "Authentication failed."
        );
      }
    } finally {
      await keepLoadingVisible(startTime);
      setLoggingIn(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError("Please enter your email address first.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setError("");
      setSuccessMessage("");
      setLoggingIn(true);

      await resetPassword(email);

      setSuccessMessage(
        "Password reset email sent. Please check your inbox."
      );
    } catch (err) {
      console.error("Password reset error:", err);
      setError(err.message || "Unable to send password reset email.");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim() || !password) {
      setError(
        "Please enter your email address and password first so we can resend your verification email."
      );
      return;
    }

    try {
      setError("");
      setSuccessMessage("");
      setLoggingIn(true);

      await resendVerificationEmail(email.trim(), password);

      setSuccessMessage(
        "A new verification email has been sent. Please check your inbox."
      );
    } catch (err) {
      console.error("Resend verification error:", err);
      setError(
        err.message || "Unable to resend the verification email."
      );
    } finally {
      setLoggingIn(false);
    }
  };

  if (loggingIn) {
    return (
      <LoadingScreen
        message={
          authLoadingMessage ||
          (mode === "register"
            ? "Creating your DueWise account..."
            : mode === "forgot"
            ? "Sending password reset email..."
            : "Signing in to DueWise...")
        }
      />
    );
  }

  const changeMode = (newMode) => {
    setMode(newMode);
    setError("");
    setSuccessMessage("");
    setPassword("");
    setConfirmPassword("");
    setFieldErrors({});
    setVerificationPending(false);
  };

  return (
    <div className="auth-page">
      <div
        className={`auth-layout ${
          mode === "register" ? "register-mode" : ""
        }`}
      >
        <section className="auth-showcase">
          <div className="showcase-glow glow-one" />
          <div className="showcase-glow glow-two" />

          <div className="showcase-brand">
            <DueWiseLogo size="normal" showText={true} />
          </div>

          <div className="showcase-content auth-welcome-content">
            <div className="welcome-illustration profile-illustration">
              <div className="profile-icon-card">
                <div className="profile-icon-head" />
                <div className="profile-icon-body" />
              </div>

              <div className="profile-status-badge">
                {mode === "login" ? "+" : "✓"}
              </div>
            </div>

            <span className="showcase-label">
              {mode === "login"
                ? "YOUR FINANCIAL JOURNEY STARTS HERE"
                : "WELCOME BACK TO DUEWISE"}
            </span>

            <h2>
              {mode === "login" ? (
                <>
                  New to <span>DueWise?</span>
                </>
              ) : (
                <>
                  Already have an <span>account?</span>
                </>
              )}
            </h2>

            <p>
              {mode === "login"
                ? "Your financial goals are within reach. Start tracking your installments and take control of your money."
                : "Your financial journey is waiting. Sign in and continue managing your money with confidence."}
            </p>

            <button
              type="button"
              className="welcome-switch-button"
              onClick={() =>
                changeMode(mode === "login" ? "register" : "login")
              }
            >
              {mode === "login" ? "Create an account" : "Back to Sign In"}
              <span>→</span>
            </button>

            <span className="welcome-caption">
              {mode === "login"
                ? "Free to start · Stay in control"
                : "Your finances, all in one place"}
            </span>
          </div>

          <div className="showcase-footer">
            <span>© 2026 DueWise</span>
            <span>Stay ahead. Pay with confidence.</span>
          </div>
        </section>

        <section className="auth-form-section">
          <div key={mode} className="auth-card auth-card-transition">
            <div className="auth-mobile-brand">
              <DueWiseLogo size="normal" showText={true} />
            </div>

            <div className="auth-heading">
              <span className="auth-eyebrow">
                {mode === "login"
                  ? "WELCOME BACK"
                  : mode === "register"
                  ? "GET STARTED"
                  : "ACCOUNT RECOVERY"}
              </span>

              <h2>
                {mode === "login"
                  ? "Sign in to DueWise"
                  : mode === "register"
                  ? "Create your account"
                  : "Reset your password"}
              </h2>

              <p>
                {mode === "login"
                  ? "Enter your details to access your financial dashboard."
                  : mode === "register"
                  ? "Create your account and take charge of your finances."
                  : "We'll send you a link to reset your password."}
              </p>
            </div>

            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="auth-success" role="status">
                <span>✓</span>
                {successMessage}
              </div>
            )}

            <form
              onSubmit={handleEmailSubmit}
              className="auth-form"
              noValidate
            >
              {mode === "register" && (
                <label>
                  Full Name

                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    className={fieldErrors.fullName ? "input-error" : ""}
                    onChange={(event) => {
                      setFullName(event.target.value);
                      setFieldErrors((previous) => ({
                        ...previous,
                        fullName: "",
                      }));
                    }}
                    required
                  />

                  {fieldErrors.fullName && (
                    <span className="duewise-field-error" role="alert">
                      <span className="error-icon">!</span>
                      {fieldErrors.fullName}
                    </span>
                  )}
                </label>
              )}

              <label>
                Email Address

                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  className={fieldErrors.email ? "input-error" : ""}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setFieldErrors((previous) => ({
                      ...previous,
                      email: "",
                    }));
                  }}
                  required
                />

                {fieldErrors.email && (
                  <span className="duewise-field-error" role="alert">
                    <span className="error-icon">!</span>
                    {fieldErrors.email}
                  </span>
                )}
              </label>

              {mode !== "forgot" && (
                <label>
                  Password

                  <div className="password-input-wrapper">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      className={fieldErrors.password ? "input-error" : ""}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setFieldErrors((previous) => ({
                          ...previous,
                          password: "",
                        }));
                      }}
                      required
                    />

                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() =>
                        setShowPassword((previous) => !previous)
                      }
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="19"
                        height="19"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {showPassword ? (
                          <>
                            <path d="M3 3l18 18" />
                            <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                            <path d="M9.9 5.2A11 11 0 0 1 12 5c5 0 8.5 4.5 9 7-.2 1-1 2.2-2.2 3.3" />
                            <path d="M6.6 6.6C4.5 7.8 3.3 9.7 3 12c.5 2.5 4 7 9 7 1.1 0 2.1-.2 3-.6" />
                          </>
                        ) : (
                          <>
                            <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>

                  {mode === "register" && password && (
                    <div className="password-strength">
                      <div className="password-strength-heading">
                        <span>Password strength</span>
                        <strong
                          className={`strength-${passwordStrength.label.toLowerCase()}`}
                        >
                          {passwordStrength.label}
                        </strong>
                      </div>

                      <div className="strength-meter">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <span
                            key={level}
                            className={
                              level <= passwordStrength.score
                                ? `strength-fill strength-${passwordStrength.label.toLowerCase()}`
                                : ""
                            }
                          />
                        ))}
                      </div>

                      <div className="password-requirements">
                        <p>Password must contain:</p>

                        {passwordRequirements.map((requirement) => (
                          <div
                            key={requirement.label}
                            className={
                              requirement.met ? "requirement-met" : ""
                            }
                          >
                            <span>
                              {requirement.met ? "✓" : "○"}
                            </span>
                            {requirement.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {fieldErrors.password && (
                    <span className="duewise-field-error" role="alert">
                      <span className="error-icon">!</span>
                      {fieldErrors.password}
                    </span>
                  )}
                </label>
              )}

              {mode === "register" && (
                <label>
                  Confirm Password

                  <div className="password-input-wrapper">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      className={
                        fieldErrors.confirmPassword ? "input-error" : ""
                      }
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        setFieldErrors((previous) => ({
                          ...previous,
                          confirmPassword: "",
                        }));
                      }}
                      required
                    />

                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() =>
                        setShowConfirmPassword((previous) => !previous)
                      }
                      aria-label={
                        showConfirmPassword
                          ? "Hide confirm password"
                          : "Show confirm password"
                      }
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="19"
                        height="19"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {showConfirmPassword ? (
                          <>
                            <path d="M3 3l18 18" />
                            <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                            <path d="M9.9 5.2A11 11 0 0 1 12 5c5 0 8.5 4.5 9 7-.2 1-1 2.2-2.2 3.3" />
                            <path d="M6.6 6.6C4.5 7.8 3.3 9.7 3 12c.5 2.5 4 7 9 7 1.1 0 2.1-.2 3-.6" />
                          </>
                        ) : (
                          <>
                            <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>

                  {fieldErrors.confirmPassword && (
                    <span className="duewise-field-error" role="alert">
                      <span className="error-icon">!</span>
                      {fieldErrors.confirmPassword}
                    </span>
                  )}
                </label>
              )}

              {mode === "login" && (
                <div className="auth-forgot-row">
                  <button
                    type="button"
                    onClick={() => changeMode("forgot")}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {mode === "forgot" ? (
                <button
                  type="button"
                  className="auth-primary-button"
                  onClick={handleForgotPassword}
                  disabled={loggingIn}
                >
                  Send Reset Link
                  <span>→</span>
                </button>
              ) : (
                <button
                  type="submit"
                  className="auth-primary-button"
                  disabled={loggingIn}
                >
                  {mode === "login" ? "Sign In" : "Create Account"}
                  <span>→</span>
                </button>
              )}
            </form>

            {verificationPending && (
              <button
                type="button"
                className="auth-resend-button"
                onClick={handleResendVerification}
                disabled={loggingIn || verificationResendSeconds > 0}
              >
                {verificationResendSeconds > 0
                  ? `Resend available in ${verificationResendSeconds}s`
                  : "Resend verification email"}
              </button>
            )}

            {mode !== "forgot" && (
              <>
                <div className="auth-divider">
                  <span>OR CONTINUE WITH</span>
                </div>

                <button
                  type="button"
                  className="auth-google-button"
                  onClick={handleGoogleLogin}
                  disabled={loggingIn}
                >
                  <svg
                    className="google-g-logo"
                    viewBox="0 0 48 48"
                    width="20"
                    height="20"
                    aria-hidden="true"
                  >
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.75 7.18l7.73 6c4.51-4.18 7.06-10.33 7.06-17.65z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-3-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                  </svg>
                  Continue with Google
                </button>
              </>
            )}

            {mode === "forgot" && (
              <div className="auth-forgot-row auth-back-to-signin">
                <button
                  type="button"
                  onClick={() => changeMode("login")}
                >
                  Back to Sign In
                </button>
              </div>
            )}

            <div className="auth-security-note">
              <span>♢</span>
              Your account and financial information matter to us.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;
