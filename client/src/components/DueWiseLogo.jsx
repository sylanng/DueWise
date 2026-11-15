function DueWiseLogo({ size = "normal", showText = true }) {
  return (
    <div className={`duewise-logo duewise-logo-${size}`}>
      <img
        src="/duewise-dw-symbol.svg"
        alt="DueWise symbol"
        className="duewise-logo-icon"
      />

      {showText && (
        <div className="duewise-logo-text">
          <span>DueWise</span>
          <small>STAY AHEAD. PAY WITH CONFIDENCE.</small>
        </div>
      )}
    </div>
  );
}

export default DueWiseLogo;