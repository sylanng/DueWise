
import { useEffect, useRef, useState } from 'react';

function CustomDropdown({
  value,
  options,
  onChange,
  placeholder = 'Select an option',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div className="custom-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className={`custom-dropdown-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen((previous) => !previous)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>
          {options.find((option) => option.value === value)?.label ||
            placeholder}
        </span>

        <span className={`custom-dropdown-arrow ${isOpen ? 'rotated' : ''}`}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="custom-dropdown-menu" role="listbox">
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              className={`custom-dropdown-option ${
                value === option.value ? 'selected' : ''
              }`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              role="option"
              aria-selected={value === option.value}
            >
              <span>{option.label}</span>
              {value === option.value && <span>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default CustomDropdown;
