import DueWiseLogo from "./DueWiseLogo";

function LoadingScreen({ message = "Preparing your financial dashboard..." }) {
  return (
    <div className="duewise-loading-screen">
      <div className="duewise-loading-content">
        <DueWiseLogo size="large" showText={true} />

        <div className="duewise-loading-spinner">
          <span></span>
        </div>

        <p>{message}</p>
        <small>Stay ahead. Pay with confidence.</small>
      </div>
    </div>
  );
}

export default LoadingScreen;