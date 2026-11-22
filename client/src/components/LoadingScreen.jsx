
import DueWiseLogo from "./DueWiseLogo";

function LoadingScreen({
  message = "Preparing your financial dashboard...",
  isExiting = false,
}) {
  return (
    <div
      className={`duewise-loading-screen ${
        isExiting ? "is-exiting" : ""
      }`}
    >
      <div className="duewise-loading-content">

        <div className="loading-logo-wrapper">
          <DueWiseLogo size="large" showText={true} />
        </div>

        <div className="duewise-loading-spinner">
          <span></span>
        </div>

        <div className="loading-message-wrapper" role="status" aria-live="polite">
          <h2>{message}</h2>

          <p>
            Please wait while we securely process your request.
          </p>
        </div>

        <span className="loading-security-note">
          <span>♢</span> Secure authentication by DueWise
        </span>

      </div>
    </div>
  );
}

export default LoadingScreen;
