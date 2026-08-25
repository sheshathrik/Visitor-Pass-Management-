import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { getCurrentUser } from "../utils/auth";

const safeFilePart = (value) =>
  String(value || "visitor")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "visitor";

function Reports() {
  const navigate = useNavigate();
  const reportOwner = safeFilePart(getCurrentUser()?.name);
  const [period, setPeriod] = useState("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleExport = async (format) => {
    setExporting(true);
    setError("");
    try {
      let url = `/reports/export/${format}?period=${period}`;
      if (period === "custom") {
        if (!startDate || !endDate) {
          setError("Choose both start and end dates before exporting.");
          return;
        }
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      if (selectedStatus !== "all") {
        url += `&status=${selectedStatus === "currently_inside" ? "checked_in" : selectedStatus}`;
      }

      const response = await api.get(url, { responseType: "blob" });
      const ext = format === "pdf" ? "pdf" : "xlsx";
      downloadBlob(response.data, `${reportOwner}_report.${ext}`);
    } catch (exportError) {
      console.error("Export failed:", exportError);
      setError("Could not export the report. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleBulkExport = async (format) => {
    if (selectedIds.length === 0) return;
    setExporting(true);
    try {
      const response = await api.get(
        `/visits/bulk/export?ids=${selectedIds.join(",")}&format=${format}`,
        { responseType: "blob" }
      );
      const ext = format === "pdf" ? "pdf" : "xlsx";
      const selectedVisits = (report?.visits || []).filter((visit) => selectedIds.includes(visit._id));
      const filename =
        selectedVisits.length === 1
          ? `${String(selectedVisits[0].visitorName || "Visitor")
              .normalize("NFKD")
              .replace(/[^a-zA-Z0-9]+/g, "")
              .slice(0, 80) || "Visitor"}_Reports.${ext}`
          : `SelectedVisitors_Reports.${ext}`;
      downloadBlob(response.data, filename);
    } catch (exportError) {
      console.error("Bulk export failed:", exportError);
      setError("Could not export the selected visitors.");
    } finally {
      setExporting(false);
    }
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]
    );
  };

  const loadReport = async () => {
    try {
      setLoading(true);
      setError("");

      let url = `/reports/summary?period=${period}`;

      if (period === "custom") {
        if (!startDate || !endDate) {
          setError("Choose both start and end dates.");
          setLoading(false);
          return;
        }
        if (new Date(startDate) > new Date(endDate)) {
          setError("Start date cannot be after end date.");
          setLoading(false);
          return;
        }

        url += `&startDate=${startDate}&endDate=${endDate}`;
      }

      const response = await api.get(url);
      setReport(response.data);
      setSelectedStatus("all");
      setSelectedIds([]);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Could not load the report."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (period !== "custom") {
      loadReport();
    }
  }, [period]);

  const statistics = report?.statistics;
  const visits = report?.visits || [];

  const filteredVisits = useMemo(() => {
    return visits.filter((visit) => {
      const matchesStatus =
        selectedStatus === "all"
          ? true
          : selectedStatus === "currently_inside"
          ? visit.status === "checked_in"
          : visit.status === selectedStatus;

      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        visit.visitorName?.toLowerCase().includes(q) ||
        visit.phone?.toLowerCase().includes(q) ||
        visit.employee?.name?.toLowerCase().includes(q) ||
        visit.purpose?.toLowerCase().includes(q);

      return matchesStatus && matchesQuery;
    });
  }, [visits, selectedStatus, searchQuery]);

  const cards = statistics
    ? [
        {
          label: "Total Visitors",
          value: statistics.totalVisitors || 0,
          statusKey: "all",
        },
        {
          label: "Pending",
          value: statistics.pending || 0,
          statusKey: "pending",
        },
        {
          label: "Approved",
          value: statistics.approved || 0,
          statusKey: "approved",
        },
        {
          label: "Rejected",
          value: statistics.rejected || 0,
          statusKey: "rejected",
        },
        {
          label: "Checked In",
          value: statistics.checkedIn || 0,
          statusKey: "checked_in",
        },
        {
          label: "Checked Out",
          value: statistics.checkedOut || 0,
          statusKey: "checked_out",
        },
        {
          label: "Cancelled",
          value: statistics.cancelled || 0,
          statusKey: "cancelled",
        },
        {
          label: "Currently Inside",
          value: statistics.currentlyInside || 0,
          statusKey: "currently_inside",
        },
      ]
    : [];

  const inputControlStyle = {
    height: "42px",
    padding: "0 12px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    boxSizing: "border-box",
    width: "100%",
    backgroundColor: "#ffffff",
  };

  const labelStyle = {
    display: "block",
    fontSize: "13px",
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: "6px",
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
        <h1>Visitor Reports</h1>
        <p>Review visitor statistics and detailed records by date range.</p>
      </div>

      <section className="form-card" style={{ marginBottom: "24px", padding: "20px" }}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            loadReport();
          }}
          style={{
            display: "grid",
            gridTemplateColumns: period === "custom" ? "repeat(auto-fit, minmax(180px, 1fr))" : "260px",
            gap: "16px",
            alignItems: "end",
          }}
        >
          <div>
            <label htmlFor="period" style={labelStyle}>Report period</label>
            <select
              id="period"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              style={inputControlStyle}
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {period === "custom" && (
            <>
              <div>
                <label htmlFor="startDate" style={labelStyle}>Start date</label>
                <input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  style={inputControlStyle}
                  required
                />
              </div>

              <div>
                <label htmlFor="endDate" style={labelStyle}>End date</label>
                <input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  style={inputControlStyle}
                  required
                />
              </div>

              <div>
                <button
                  type="submit"
                  style={{
                    ...inputControlStyle,
                    backgroundColor: "#0f766e",
                    color: "#ffffff",
                    fontWeight: "600",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Generate Report
                </button>
              </div>
            </>
          )}
        </form>
      </section>

      {error && <p className="error-message">{error}</p>}

      {statistics && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <button type="button" disabled={exporting} onClick={() => handleExport("excel")}>
            {exporting ? "Exporting..." : "Export All (Excel)"}
          </button>
          <button type="button" disabled={exporting} onClick={() => handleExport("pdf")}>
            {exporting ? "Exporting..." : "Export All (PDF)"}
          </button>
          {selectedIds.length > 0 && (
            <>
              <button type="button" disabled={exporting} onClick={() => handleBulkExport("excel")}>
                Export Selected ({selectedIds.length}) — Excel
              </button>
              <button type="button" disabled={exporting} onClick={() => handleBulkExport("pdf")}>
                Export Selected ({selectedIds.length}) — PDF
              </button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <p>Loading report...</p>
      ) : statistics ? (
        <>
          <section className="stats-grid">
            {cards.map((card) => (
              <article
                key={card.label}
                className="stat-card clickable"
                onClick={() => setSelectedStatus(card.statusKey)}
                style={{
                  cursor: "pointer",
                  border:
                    selectedStatus === card.statusKey
                      ? "2px solid #0f766e"
                      : "1px solid #e2e8f0",
                }}
              >
                <p>{card.label}</p>
                <h2>{card.value}</h2>
              </article>
            ))}
          </section>

          <article className="table-card" style={{ marginTop: "32px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <h2>
                Visitor Details (
                {selectedStatus === "all"
                  ? "All Visitors"
                  : selectedStatus.replaceAll("_", " ")}
                )
              </h2>

              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Search visitor, phone, host..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    height: "38px",
                    padding: "0 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    minWidth: "240px",
                    boxSizing: "border-box",
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    style={{ height: "38px", padding: "0 14px" }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {filteredVisits.length === 0 ? (
              <p>No visitor records found matching your filters.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={
                            filteredVisits.length > 0 &&
                            filteredVisits.every((v) => selectedIds.includes(v._id))
                          }
                          onChange={(event) =>
                            setSelectedIds(
                              event.target.checked ? filteredVisits.map((v) => v._id) : []
                            )
                          }
                        />
                      </th>
                      <th>Visitor Name</th>
                      <th>Phone</th>
                      <th>Employee to Visit</th>
                      <th>Visit Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVisits.map((visit) => (
                      <tr key={visit._id}>
                        <td data-label="Select" className="table-select-cell">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(visit._id)}
                            onChange={() => toggleSelected(visit._id)}
                          />
                        </td>
                        <td data-label="Visitor name">{visit.visitorName}</td>
                        <td data-label="Phone">{visit.phone || "-"}</td>
                        <td data-label="Employee to visit">{visit.employee?.name || "-"}</td>
                        <td data-label="Visit date">
                          {new Date(visit.visitDate).toLocaleDateString()}
                        </td>
                        <td data-label="Status">{visit.status.replaceAll("_", " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </>
      ) : null}
    </main>
  );
}

export default Reports;
