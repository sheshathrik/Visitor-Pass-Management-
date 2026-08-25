import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

const INITIAL_FORM_STATE = {
  visitorName: "",
  phone: "",
  email: "",
  idProof: "",
  purpose: "",
  employee: "",
  visitDate: new Date().toISOString().split("T")[0],
  expectedArrivalTime: "",
};

const INITIAL_FILTERS = {
  status: "",
  startDate: "",
  endDate: "",
  employee: "",
};

function Visitors({ viewMode = "all" }) {
  const navigate = useNavigate();

  const [visits, setVisits] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);

  const buildVisitsQuery = (activeFilters) => {
    if (viewMode !== "history") return "";

    const params = new URLSearchParams();
    if (activeFilters.status) params.set("status", activeFilters.status);
    if (activeFilters.startDate) params.set("startDate", activeFilters.startDate);
    if (activeFilters.endDate) params.set("endDate", activeFilters.endDate);
    if (activeFilters.employee) params.set("employeeName", activeFilters.employee.trim());

    const query = params.toString();
    return query ? `?${query}` : "";
  };

  const loadData = async (activeFilters = filters) => {
    setLoading(true);
    setError("");

    try {
      const [visitsResult, employeesResult] = await Promise.allSettled([
        api.get(`/visits${buildVisitsQuery(activeFilters)}`),
        api.get("/employees"),
      ]);

      const errors = [];

      if (visitsResult.status === "fulfilled") {
        setVisits(visitsResult.value.data || []);
      } else {
        errors.push(
          visitsResult.reason?.response?.data?.message || "Could not load visitor records."
        );
      }

      if (employeesResult.status === "fulfilled") {
        setEmployees(employeesResult.value.data || []);
      } else {
        errors.push(
          employeesResult.reason?.response?.data?.message || "Could not load employee list."
        );
      }

      if (errors.length > 0) {
        setError(errors.join(" "));
      }
    } catch {
      setError("An unexpected error occurred while fetching data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [viewMode]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const applyFilters = (e) => {
    e?.preventDefault();
    loadData(filters);
  };

  const clearFilters = () => {
    setFilters(INITIAL_FILTERS);
    loadData(INITIAL_FILTERS);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      await api.post("/visits", formData);
      setMessage("Visitor request created successfully.");
      setFormData(INITIAL_FORM_STATE);
      loadData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Could not create the visitor request."
      );
    }
  };

  const updateVisitStatus = async (visitId, action) => {
    try {
      setActionLoadingId(visitId);
      setError("");
      setMessage("");

      await api.patch(`/visits/${visitId}/${action}`);
      setMessage(
        action === "check-in"
          ? "Visitor checked in successfully."
          : "Visitor checked out successfully."
      );
      loadData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || `Could not ${action} this visitor.`
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredVisits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visits.filter((visit) => {
      const matchesSearch =
        !q ||
        visit.visitorName?.toLowerCase().includes(q) ||
        visit.employee?.name?.toLowerCase().includes(q) ||
        visit.status?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (viewMode === "checkin") {
        return ["approved", "checked_in"].includes(visit.status);
      }

      return true;
    });
  }, [visits, search, viewMode]);

  const showForm = viewMode === "all" || viewMode === "register";
  const showTable = ["all", "checkin", "history"].includes(viewMode);

  return (
    <main className="page-content">
      {/* Scoped CSS resets and alignments for production consistency */}
      <style>{`
        .filter-panel-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }
        .filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)) auto;
          gap: 12px;
          align-items: flex-end;
        }
        .filter-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .filter-field label {
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.025em;
          margin: 0;
        }
        .filter-control {
          height: 38px !important;
          width: 100% !important;
          box-sizing: border-box !important;
          padding: 0 10px !important;
          font-size: 14px !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 6px !important;
          background-color: #ffffff !important;
          color: #1e293b !important;
          outline: none;
          margin: 0 !important;
          display: block !important;
        }
        .filter-control:focus {
          border-color: #0284c7 !important;
          box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15);
        }
        .filter-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: auto;
        }
        .btn-filter-apply {
          height: 38px !important;
          padding: 0 16px !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          color: #ffffff !important;
          background-color: #0284c7 !important;
          border: none !important;
          border-radius: 6px !important;
          cursor: pointer;
          white-space: nowrap;
          margin: 0 !important;
          width: auto !important;
        }
        .btn-filter-apply:hover {
          background-color: #0369a1 !important;
        }
        .btn-filter-clear {
          height: 38px !important;
          padding: 0 16px !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          color: #475569 !important;
          background-color: #e2e8f0 !important;
          border: none !important;
          border-radius: 6px !important;
          cursor: pointer;
          white-space: nowrap;
          margin: 0 !important;
          width: auto !important;
        }
        .btn-filter-clear:hover {
          background-color: #cbd5e1 !important;
        }
        .search-bar-wrapper {
          margin-bottom: 20px;
        }
        .search-control {
          width: 100% !important;
          height: 42px !important;
          padding: 0 14px !important;
          font-size: 14px !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 6px !important;
          background: #ffffff !important;
          box-sizing: border-box !important;
          margin: 0 !important;
        }
        .search-control:focus {
          border-color: #0284c7 !important;
          box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15);
        }
        .status-badge {
          display: inline-block;
          padding: 4px 8px;
          font-size: 12px;
          font-weight: 600;
          text-transform: capitalize;
          border-radius: 4px;
        }
        .status-approved { background: #dcfce7; color: #15803d; }
        .status-checked_in { background: #e0e7ff; color: #4338ca; }
        .status-checked_out { background: #f1f5f9; color: #475569; }
        .status-pending { background: #fef9c3; color: #a16207; }
        .status-rejected { background: #fee2e2; color: #b91c1c; }
        .status-cancelled { background: #f1f5f9; color: #64748b; }
      `}</style>

      <button
        className="back-button"
        type="button"
        onClick={() => navigate("/dashboard")}
      >
        ← Back to Dashboard
      </button>

      <div className="page-heading">
        <p className="role-label">Receptionist</p>
        <h1>
          {viewMode === "register" && "Register Visitor"}
          {viewMode === "checkin" && "Check In / Check Out"}
          {viewMode === "history" && "Visitor History"}
          {viewMode === "all" && "Visitor Management"}
        </h1>
      </div>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      <section className="employee-layout">
        {showForm && (
          <article className="form-card">
            <h2>Register Visitor</h2>
            <form onSubmit={handleSubmit}>
              <label htmlFor="visitorName">Visitor Name</label>
              <input
                id="visitorName"
                name="visitorName"
                value={formData.visitorName}
                onChange={handleChange}
                required
              />

              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                required
              />

              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
              />

              <label htmlFor="idProof">ID Proof</label>
              <input
                id="idProof"
                name="idProof"
                placeholder="ID Type / Number"
                value={formData.idProof}
                onChange={handleChange}
              />

              <label htmlFor="purpose">Purpose of Visit</label>
              <textarea
                id="purpose"
                name="purpose"
                rows="3"
                value={formData.purpose}
                onChange={handleChange}
                required
              />

              <label htmlFor="employee">Employee to Visit</label>
              <select
                id="employee"
                name="employee"
                value={formData.employee}
                onChange={handleChange}
                required
              >
                <option value="">Select an employee</option>
                {employees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.name} — {emp.department}
                  </option>
                ))}
              </select>

              <label htmlFor="visitDate">Visit Date</label>
              <input
                id="visitDate"
                name="visitDate"
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={formData.visitDate}
                onChange={handleChange}
                required
              />

              <label htmlFor="expectedArrivalTime">Expected Arrival Time</label>
              <input
                id="expectedArrivalTime"
                name="expectedArrivalTime"
                type="time"
                value={formData.expectedArrivalTime}
                onChange={handleChange}
                required
              />

              <button type="submit">Create Visitor Request</button>
            </form>
          </article>
        )}

        {showTable && (
          <article className="table-card">
            <h2>Visitor Records</h2>

            {viewMode === "history" && (
              <form className="filter-panel-card" onSubmit={applyFilters}>
                <div className="filter-grid">
                  <div className="filter-field">
                    <label htmlFor="filterStatus">Status</label>
                    <select
                      id="filterStatus"
                      name="status"
                      className="filter-control"
                      value={filters.status}
                      onChange={handleFilterChange}
                    >
                      <option value="">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="checked_in">Checked In</option>
                      <option value="checked_out">Checked Out</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div className="filter-field">
                    <label htmlFor="filterEmployee">Employee</label>
                    <input
                      id="filterEmployee"
                      name="employee"
                      type="text"
                      className="filter-control"
                      placeholder="Search employee..."
                      value={filters.employee}
                      onChange={handleFilterChange}
                    />
                  </div>

                  <div className="filter-field">
                    <label htmlFor="filterStartDate">From</label>
                    <input
                      id="filterStartDate"
                      name="startDate"
                      type="date"
                      className="filter-control"
                      value={filters.startDate}
                      onChange={handleFilterChange}
                    />
                  </div>

                  <div className="filter-field">
                    <label htmlFor="filterEndDate">To</label>
                    <input
                      id="filterEndDate"
                      name="endDate"
                      type="date"
                      className="filter-control"
                      value={filters.endDate}
                      onChange={handleFilterChange}
                    />
                  </div>

                  <div className="filter-actions">
                    <button type="submit" className="btn-filter-apply">
                      Apply
                    </button>
                    <button
                      type="button"
                      className="btn-filter-clear"
                      onClick={clearFilters}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="search-bar-wrapper">
              <input
                type="search"
                className="search-control"
                placeholder="Search by visitor, employee, or status..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loading ? (
              <p className="loading-text">Loading visitor records...</p>
            ) : filteredVisits.length === 0 ? (
              <p className="empty-text">No visitor records found.</p>
            ) : (
              <div className="table-wrapper">
                <table className="visitor-records-table">
                  <thead>
                    <tr>
                      <th>Visitor</th>
                      <th>Employee</th>
                      <th>Visit Date</th>
                      <th>Status</th>
                      {viewMode !== "history" && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVisits.map((visit) => (
                      <tr key={visit._id}>
                        <td data-label="Visitor">{visit.visitorName}</td>
                        <td data-label="Employee">{visit.employee?.name || "—"}</td>
                        <td data-label="Visit date">
                          {visit.visitDate
                            ? new Date(visit.visitDate).toLocaleDateString()
                            : "—"}
                        </td>
                        <td data-label="Status">
                          <span
                            className={`status-badge status-${visit.status?.toLowerCase()}`}
                          >
                            {visit.status?.replace(/_/g, " ") || "—"}
                          </span>
                        </td>
                        {viewMode !== "history" && (
                          <td data-label="Actions">
                            {visit.status === "approved" && (
                              <button
                                type="button"
                                className="check-in-button"
                                disabled={actionLoadingId === visit._id}
                                onClick={() =>
                                  updateVisitStatus(visit._id, "check-in")
                                }
                              >
                                {actionLoadingId === visit._id
                                  ? "Checking in..."
                                  : "Check In"}
                              </button>
                            )}

                            {visit.status === "checked_in" && (
                              <button
                                type="button"
                                className="check-out-button"
                                disabled={actionLoadingId === visit._id}
                                onClick={() =>
                                  updateVisitStatus(visit._id, "check-out")
                                }
                              >
                                {actionLoadingId === visit._id
                                  ? "Checking out..."
                                  : "Check Out"}
                              </button>
                            )}

                            {!["approved", "checked_in"].includes(
                              visit.status
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        )}
      </section>
    </main>
  );
}

export default Visitors;
