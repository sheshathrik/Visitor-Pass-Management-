// Requires 8–128 non-space characters, including lowercase, uppercase,
// a number, and a symbol. Keep this server-side check authoritative.
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,128}$/;

const passwordError = (password) =>
  typeof password !== "string" || !PASSWORD_PATTERN.test(password)
    ? "Password must be 8–128 characters and include uppercase, lowercase, a number, and a special character"
    : null;

module.exports = { passwordError };