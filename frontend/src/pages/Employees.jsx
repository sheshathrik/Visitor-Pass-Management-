import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

function Employees() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Tracks which employee row is being edited, if any. null = "add" mode.
  const [editingId, setEditingId] = useState(null);

  const emptyForm = {
    name: "",
    email: "",
    department: "",
    designation: "",
    phone: "",
  };

  const [formData, setFormData] = useState(emptyForm);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const response = await api.get("/employees");
      setEmployees(response.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Could not load employees"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };

  const startEditing = (employee) => {
    setMessage("");
    setError("");
    setEditingId(employee._id);
    setFormData({
      name: employee.name,
      email: employee.email,
      department: employee.department,
      designation: employee.designation || "",
      phone: employee.phone || "",
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      if (editingId) {
        await api.patch(`/employees/${editingId}`, formData);
        setMessage("Employee updated successfully.");
        setEditingId(null);
      } else {
        await api.post("/employees", formData);
        setMessage("Employee created successfully.");
      }

      setFormData(emptyForm);
      loadEmployees();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          (editingId
            ? "Could not update employee"
            : "Could not create employee")
      );
    }
  };

  const deactivateEmployee = async (employee) => {
    setMessage("");
    setError("");

    try {
      await api.delete(`/employees/${employee._id}`);
      setMessage(`${employee.name} was deactivated.`);

      // If the deactivated employee was mid-edit, reset the form.
      if (editingId === employee._id) {
        cancelEditing();
      }

      loadEmployees();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not deactivate employee"
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
        <div>
          <p className="role-label">Administrator</p>
          <h1>Employee Management</h1>
          <p>Add, edit, and deactivate employee records.</p>
        </div>
      </div>

      <section className="employee-layout">
        <article className="form-card">
          <h2>{editingId ? "Edit Employee" : "Add Employee"}</h2>

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

            <label htmlFor="department">Department</label>
            <input
              id="department"
              name="department"
              value={formData.department}
              onChange={handleChange}
              required
            />

            <label htmlFor="designation">Designation</label>
            <input
              id="designation"
              name="designation"
              value={formData.designation}
              onChange={handleChange}
            />

            <label htmlFor="phone">Phone number</label>
            <input
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
            />

            <div className="form-actions">
              <button type="submit">
                {editingId ? "Save Changes" : "Add Employee"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={cancelEditing}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </article>

        <article className="table-card">
          <h2>Active Employees</h2>

          {loading ? (
            <p>Loading employees...</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee._id}>
                      <td data-label="Name">{employee.name}</td>
                      <td data-label="Department">{employee.department}</td>
                      <td data-label="Designation">{employee.designation || "-"}</td>
                      <td data-label="Email">{employee.email}</td>
                      <td data-label="Phone">{employee.phone || "-"}</td>
                      <td data-label="Actions">
                        <button
                          type="button"
                          onClick={() => startEditing(employee)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deactivateEmployee(employee)}
                        >
                          Deactivate
                        </button>
                      </td>
                    </tr>
                  ))}

                  {employees.length === 0 && (
                    <tr>
                      <td colSpan="6">No employees found.</td>
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

export default Employees;
