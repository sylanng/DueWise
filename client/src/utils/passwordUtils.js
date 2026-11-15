export const getPasswordRequirements = (password) => [
  {
    label: "At least 8 characters",
    met: password.length >= 8,
  },
  {
    label: "One uppercase letter (A-Z)",
    met: /[A-Z]/.test(password),
  },
  {
    label: "One lowercase letter (a-z)",
    met: /[a-z]/.test(password),
  },
  {
    label: "One number (0-9)",
    met: /[0-9]/.test(password),
  },
  {
    label: "One special character (!@#$%)",
    met: /[^A-Za-z0-9]/.test(password),
  },
];

export const getPasswordStrength = (password) => {
  const requirements = getPasswordRequirements(password);
  const score = requirements.filter((item) => item.met).length;

  if (!password) {
    return { label: "", score: 0 };
  }

  if (score <= 2) {
    return { label: "Weak", score };
  }

  if (score === 3) {
    return { label: "Fair", score };
  }

  if (score === 4) {
    return { label: "Good", score };
  }

  return { label: "Strong", score };
};