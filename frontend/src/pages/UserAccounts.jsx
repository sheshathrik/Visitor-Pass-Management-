import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { PASSWORD_HINT, PASSWORD_PATTERN } from "../utils/password";

function UserAccounts() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "receptionist",
    employeeId: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);

      const [usersResponse, employeesResponse] = await Promise.all([
        api.get("/users"),
        api.get("/employees"),
      ]);

      setUsers(usersResponse.data);
      setEmployees(employeesResponse.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Could not load user accounts."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!PASSWORD_PATTERN.test(formData.password)) {
      setError(PASSWORD_HINT);
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Password and confirmation password must match.");
      return;
    }

    try {
      const userData = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        employeeId: formData.employeeId,
      };
      await api.post("/users", userData);

      setMessage("User account created successfully.");
      setFormData({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        role: "receptionist",
        employeeId: "",
      });

      loadData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not create the user account."
      );
    }
  };

  const changeUserStatus = async (user) => {
    try {
      await api.patch(`/users/${user._id}/status`, {
        isActive: !user.isActive,
      });

      loadData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not update the account status."
      );
    }
  };

  return (
    <main className="page-content">
      <button
        className="back-button"
        type="button"
        onClick={() => navigate("/dashboard")}
      >
        ← Back to Dashboard
      </button>

      <div className="page-heading">
        <p className="role-label">Administrator</p>
        <h1>User Accounts</h1>
        <p>Create login accounts and manage user access.</p>
      </div>

      <section className="employee-layout">
        <article className="form-card">
          <h2>Create User Account</h2>

          {message && <p className="success-message">{message}</p>}
          {error && <p className="error-message">{error}</p>}

          <form onSubmit={handleSubmit}>
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />

            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              minLength="8"
              maxLength="128"
              pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,128}"
              title={PASSWORD_HINT}
              autoComplete="new-password"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <small className="field-hint">{PASSWORD_HINT}</small>

            <label htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              minLength="8"
              maxLength="128"
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />

            <label htmlFor="role">Role</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
            >
              <option value="admin">Administrator</option>
              <option value="receptionist">Receptionist</option>
              <option value="employee">Employee</option>
            </select>

            {formData.role === "employee" && (
              <>
                <label htmlFor="employeeId">Employee record</label>
                <select
                  id="employeeId"
                  name="employeeId"
                  value={formData.employeeId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select an employee</option>
                  {employees.map((employee) => (
                    <option key={employee._id} value={employee._id}>
                      {employee.name} - {employee.department}
                    </option>
                  ))}
                </select>
              </>
            )}

            <button type="submit">Create Account</button>
          </form>
        </article>

        <article className="table-card">
          <h2>All User Accounts</h2>

          {loading ? (
            <p>Loading user accounts...</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Employee</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user._id}>
                      <td data-label="Name">{user.name}</td>
                      <td data-label="Email">{user.email}</td>
                      <td data-label="Role">{user.role}</td>
                      <td data-label="Employee">{user.employee?.name || "-"}</td>
                      <td data-label="Status">{user.isActive ? "Active" : "Inactive"}</td>
                      <td data-label="Actions">
                        <button
                          type="button"
                          onClick={() => changeUserStatus(user)}
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}

                  {users.length === 0 && (
                    <tr>
                      <td colSpan="6">No user accounts found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}

export default UserAccounts;
