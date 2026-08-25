import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import { PASSWORD_HINT, PASSWORD_PATTERN } from "../utils/password";

export default function Register() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "employee",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!PASSWORD_PATTERN.test(formData.password)) {
      setError(PASSWORD_HINT);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Password and confirmation password do not match.");
      return;
    }

    setLoading(true);

    try {
      const registrationData = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
      };

      await api.post("/auth/register", registrationData);
      setLoading(false);

      navigate("/login", {
        state: { message: "Account created successfully! Please sign in." },
      });
    } catch (err) {
      setLoading(false);
      const backendError =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Registration failed. Please try again.";
      setError(backendError);
    }
  };

  return (
    <main className="login-page">
      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #f8fafc;
          padding: 24px 16px;
          box-sizing: border-box;
        }
        .login-card {
          width: 100%;
          max-width: 440px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
          padding: 32px 28px;
          box-sizing: border-box;
        }
        .app-name {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #0f766e;
          margin: 0 0 4px 0;
        }
        .login-title {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 6px 0;
        }
        .login-subtitle {
          font-size: 14px;
          color: #64748b;
          margin: 0 0 20px 0;
          line-height: 1.4;
        }
        .register-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-group label {
          font-size: 13px;
          font-weight: 600;
          color: #334155;
        }
        .form-input,
        .form-select {
          width: 100%;
          height: 42px;
          padding: 0 12px;
          font-size: 14px;
          color: #0f172a;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .form-input:focus,
        .form-select:focus {
          border-color: #0f766e;
          box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.15);
        }
        .password-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .password-input-wrapper input {
          padding-right: 40px;
        }
        .password-toggle-btn {
          position: absolute;
          right: 8px;
          background: none;
          border: none;
          padding: 4px 6px;
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          user-select: none;
        }
        .password-toggle-btn:hover {
          color: #0f172a;
        }
        .field-hint {
          font-size: 12px;
          color: #64748b;
          line-height: 1.3;
          margin-top: 2px;
        }
        .error-banner {
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          padding: 10px 12px;
          border-radius: 6px;
          font-size: 13px;
          line-height: 1.4;
          margin-bottom: 16px;
        }
        .btn-register-submit {
          width: 100%;
          height: 42px;
          background-color: #0f766e;
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.15s ease;
          margin-top: 4px;
        }
        .btn-register-submit:hover:not(:disabled) {
          background-color: #115e59;
        }
        .btn-register-submit:disabled {
          background-color: #94a3b8;
          cursor: not-allowed;
        }
        .register-footer {
          text-align: center;
          font-size: 14px;
          color: #64748b;
          margin-top: 24px;
          margin-bottom: 0;
        }
        .register-footer a {
          color: #0f766e;
          font-weight: 600;
          text-decoration: none;
        }
        .register-footer a:hover {
          text-decoration: underline;
        }
      `}</style>

      <section className="login-card">
        <p className="app-name">VisitorPass</p>
        <h1 className="login-title">Create an account</h1>
        <p className="login-subtitle">
          Sign up to access visitor management services.
        </p>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="register-form" noValidate>
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              name="name"
              className="form-input"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="John Doe"
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              name="email"
              className="form-input"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="name@company.com"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Account Type</label>
            <select
              id="role"
              name="role"
              className="form-select"
              value={formData.role}
              onChange={handleChange}
            >
              <option value="employee">Employee</option>
              <option value="receptionist">Receptionist</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                className="form-input"
                value={formData.password}
                onChange={handleChange}
                required
                minLength="8"
                maxLength="128"
                autoComplete="new-password"
                placeholder="Create a strong password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <small className="field-hint">{PASSWORD_HINT}</small>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="password-input-wrapper">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                className="form-input"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                minLength="8"
                maxLength="128"
                autoComplete="new-password"
                placeholder="Re-enter your password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex="-1"
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-register-submit"
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        <p className="register-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
