import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { getCurrentUser } from "../utils/auth";

function ActivityHistory() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadActivities = async () => {
      try {
        const response = await api.get("/activities");
        setActivities(response.data);
      } catch (requestError) {
        const msg = requestError.response?.data?.message;
        if (msg && msg.includes("not linked")) {
          // Gracefully show no activities if employee profile is not linked
          setActivities([]);
        } else {
          setError(msg || "Could not load activity history.");
        }
      } finally {
        setLoading(false);
      }
    };

    loadActivities();
  }, []);

  const isAdmin = user?.role === "admin";

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
        <p className="role-label">{isAdmin ? "Administrator" : "Employee"}</p>
        <h1>{isAdmin ? "Activity History" : "Approval History"}</h1>
        <p>
          {isAdmin
            ? "Track all actions performed on visitor requests."
            : "Track actions performed on visitor requests assigned to you."}
        </p>
      </div>

      {error && <p className="error-message">{error}</p>}

      <section className="table-card">
        <h2>Visitor Activity Log</h2>

        {loading ? (
          <p>Loading activity history...</p>
        ) : activities.length === 0 ? (
          <p>No activity has been recorded yet.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Visitor</th>
                  <th>Action</th>
                  <th>Performed By</th>
                  <th>Date & Time</th>
                  <th>Remarks</th>
                </tr>
              </thead>

              <tbody>
                {activities.map((activity) => (
                  <tr key={activity._id}>
                    <td data-label="Visitor">{activity.visit?.visitorName || "-"}</td>
                    <td data-label="Action">{activity.action}</td>
                    <td data-label="Performed by">{activity.performedBy?.name || "-"}</td>
                    <td data-label="Date & time">
                      {new Date(activity.createdAt).toLocaleString()}
                    </td>
                    <td data-label="Remarks">{activity.remarks || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default ActivityHistory;
