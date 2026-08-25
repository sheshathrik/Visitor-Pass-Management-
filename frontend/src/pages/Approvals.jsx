import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

const formatDate = (date) => new Date(date).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });

export default function Approvals() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState([]);
  const [remarks, setRemarks] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkRemarks, setBulkRemarks] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadPending = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/visits/pending");
      setVisits(response.data || []);
      setSelectedIds([]);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not load pending requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPending(); }, []);

  const decide = async (id, decision) => {
    setBusy(`${decision}:${id}`); setError(""); setMessage("");
    try {
      await api.patch(`/visits/${id}/${decision}`, { remarks: remarks[id] || "" });
      setMessage(`Visitor request ${decision}d successfully.`);
      await loadPending();
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Could not ${decision} this request.`);
    } finally { setBusy(""); }
  };

  const bulkDecide = async (decision) => {
    if (!selectedIds.length) return;
    setBusy(`bulk:${decision}`); setError(""); setMessage("");
    try {
      const response = await api.patch(`/visits/bulk/${decision}`, { ids: selectedIds, remarks: bulkRemarks });
      const count = decision === "approve" ? response.data.approvedCount : response.data.rejectedCount;
      const skipped = response.data.skippedCount || 0;
      setMessage(`${count} request${count === 1 ? "" : "s"} ${decision}d${skipped ? `; ${skipped} skipped.` : "."}`);
      setBulkRemarks("");
      await loadPending();
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Could not bulk ${decision} the selected requests.`);
    } finally { setBusy(""); }
  };

  const toggle = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const allSelected = visits.length > 0 && selectedIds.length === visits.length;

  return (
    <main className="page-content approvals-page">
      <button className="back-button" type="button" onClick={() => navigate("/dashboard")}>← Back to Dashboard</button>
      <div className="page-heading"><p className="role-label">Employee</p><h1>Visitor Requests</h1><p>Review pending visitor requests assigned to you and record a decision.</p></div>
      {error && <p className="error-message">{error}</p>}
      {message && <p className="success-message">{message}</p>}

      {loading ? <section className="approval-empty"><h2>Loading requests…</h2></section> : visits.length === 0 ? (
        <section className="approval-empty"><span className="approval-empty-icon">✓</span><h2>You are all caught up</h2><p>There are no visitor requests waiting for your approval.</p></section>
      ) : <>
        <section className="approval-toolbar">
          <label className="select-all-control"><input type="checkbox" checked={allSelected} onChange={(event) => setSelectedIds(event.target.checked ? visits.map((visit) => visit._id) : [])} /><span>Select all <strong>({visits.length})</strong></span></label>
          <input aria-label="Remarks for bulk action" placeholder="Add remarks for selected requests (optional)" value={bulkRemarks} disabled={!selectedIds.length || Boolean(busy)} onChange={(event) => setBulkRemarks(event.target.value)} />
          <div className="approval-toolbar-actions">
            <button type="button" className="approve-button" disabled={!selectedIds.length || Boolean(busy)} onClick={() => bulkDecide("approve")}>{busy === "bulk:approve" ? "Approving…" : `Approve (${selectedIds.length})`}</button>
            <button type="button" className="reject-button" disabled={!selectedIds.length || Boolean(busy)} onClick={() => bulkDecide("reject")}>{busy === "bulk:reject" ? "Rejecting…" : `Reject (${selectedIds.length})`}</button>
          </div>
        </section>
        <section className="approval-list">
          {visits.map((visit) => {
            const selected = selectedIds.includes(visit._id);
            return <article className={`approval-card ${selected ? "is-selected" : ""}`} key={visit._id}>
              <div className="approval-card-header">
                <label className="request-checkbox" aria-label={`Select ${visit.visitorName}`}><input type="checkbox" checked={selected} disabled={Boolean(busy)} onChange={() => toggle(visit._id)} /></label>
                <div><h2>{visit.visitorName}</h2><p className="request-contact">{visit.phone}{visit.email ? ` · ${visit.email}` : ""}</p></div>
                <span className="pending-badge">Pending approval</span>
              </div>
              <div className="request-details">
                <div><span>Purpose</span><strong>{visit.purpose}</strong></div><div><span>Visit schedule</span><strong>{formatDate(visit.visitDate)} · {visit.expectedArrivalTime}</strong></div><div><span>Registered by</span><strong>{visit.createdBy?.name || "Reception"}</strong></div><div><span>ID proof</span><strong>{visit.idProof || "Not provided"}</strong></div>
              </div>
              <div className="request-decision">
                <label htmlFor={`remarks-${visit._id}`}>Decision remarks <em>(optional)</em></label>
                <textarea id={`remarks-${visit._id}`} rows="2" placeholder="Add a note for the visitor or receptionist" value={remarks[visit._id] || ""} disabled={Boolean(busy)} onChange={(event) => setRemarks((current) => ({ ...current, [visit._id]: event.target.value }))} />
                <div className="request-actions"><button type="button" className="reject-button" disabled={Boolean(busy)} onClick={() => decide(visit._id, "reject")}>{busy === `reject:${visit._id}` ? "Rejecting…" : "Reject"}</button><button type="button" className="approve-button" disabled={Boolean(busy)} onClick={() => decide(visit._id, "approve")}>{busy === `approve:${visit._id}` ? "Approving…" : "Approve request"}</button></div>
              </div>
            </article>;
          })}
        </section>
      </>}
    </main>
  );
}
