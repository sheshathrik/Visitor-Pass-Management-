export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,128}$/;

export const PASSWORD_HINT =
  "Use 8–128 characters with uppercase, lowercase, a number, and a special character.";
