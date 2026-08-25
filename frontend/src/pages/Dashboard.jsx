import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import api from "../services/api";
import { getCurrentUser } from "../utils/auth";

const STATUS_COLORS = {
  pending: "#f59e0b",
  approved: "#0f766e",
  rejected: "#dc2626",
  checkedIn: "#2563eb",
  checkedOut: "#7c3aed",
  cancelled: "#94a3b8",
};

function Dashboard() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trend, setTrend] = useState([]);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [chartsLoading, setChartsLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        if (user.role === "admin") {
          const [reportResponse, employeesResponse, usersResponse] =
            await Promise.all([
              api.get("/reports/summary?period=today"),
              api.get("/employees"),
              api.get("/users"),
            ]);

          const s = reportResponse.data.statistics;
          setStatusBreakdown(
            [
              { name: "Pending", key: "pending", value: s.pending },
              { name: "Approved", key: "approved", value: s.approved },
              { name: "Rejected", key: "rejected", value: s.rejected },
              { name: "Checked In", key: "checkedIn", value: s.checkedIn },
              { name: "Checked Out", key: "checkedOut", value: s.checkedOut },
              { name: "Cancelled", key: "cancelled", value: s.cancelled },
            ].filter((entry) => entry.value > 0)
          );

          setStats([
            {
              label: "Today's Visitors",
              value: reportResponse.data.statistics.totalVisitors,
              path: "/reports",
            },
            {
              label: "Total Employees",
              value: employeesResponse.data.length,
              path: "/employees",
            },
            {
              label: "User Accounts",
              value: usersResponse.data.length,
              path: "/user-accounts",
            },
            {
              label: "Visitors Inside",
              value: reportResponse.data.statistics.currentlyInside,
              path: null,
            },
          ]);

          try {
            const trendResponse = await api.get("/reports/trend");
            setTrend(
              trendResponse.data.map((point) => ({
                ...point,
                label: new Date(point.date).toLocaleDateString(undefined, {
                  weekday: "short",
                }),
              }))
            );
          } catch (trendError) {
            console.error("Could not load trend chart:", trendError);
          } finally {
            setChartsLoading(false);
          }
        } else {
          setChartsLoading(false);
        }

        if (user.role === "receptionist") {
          const [pendingResponse, insideResponse] = await Promise.all([
            api.get("/visits?status=pending"),
            api.get("/visits/active/currently-inside"),
          ]);

          setStats([
            {
              label: "Pending Requests",
              value: pendingResponse.data.length,
              path: "/visitor-history",
            },
            {
              label: "Visitors Inside",
              value: insideResponse.data.length,
              path: "/check-in-out",
            },
            {
              label: "Your Role",
              value: "Receptionist",
              path: null,
            },
          ]);
        }

        if (user.role === "employee") {
          const response = await api.get("/visits/pending");

          setStats([
            {
              label: "Pending Approvals",
              value: response.data.length,
              path: "/approvals",
            },
            {
              label: "Your Role",
              value: "Employee",
              path: null,
            },
            {
              label: "Action Required",
              value: "Review requests",
              path: "/approvals",
            },
          ]);
        }
      } catch (error) {
        console.error("Could not load dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [user.role]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const menuItems = {
    admin: [
      { label: "Dashboard", path: "/dashboard" },
      { label: "Employees", path: "/employees" },
      { label: "User Accounts", path: "/user-accounts" },
      { label: "Reports", path: "/reports" },
      { label: "Activity History", path: "/activity-history" },
    ],
    receptionist: [
      { label: "Dashboard", path: "/dashboard" },
      { label: "Register Visitor", path: "/register-visitor" },
      { label: "Check In / Check Out", path: "/check-in-out" },
      { label: "Visitor History", path: "/visitor-history" },
    ],
    employee: [
      { label: "Dashboard", path: "/dashboard" },
      { label: "Visitor Requests", path: "/approvals" },
      { label: "Approval History", path: "/activity-history" },
    ],
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <h2>VisitorPass</h2>

        <nav>
          {menuItems[user.role]?.map((item) => (
            <button
              className="nav-item"
              type="button"
              key={item.label}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <button className="logout-button" type="button" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <main className="dashboard-content">
        <p className="role-label">{user.role}</p>
        <h1>Welcome, {user.name}</h1>
        <p className="dashboard-subtitle">
          Here is an overview of your visitor management tasks.
        </p>

        {loading ? (
          <p>Loading dashboard...</p>
        ) : (
          <section className="stats-grid">
            {stats.map((stat) => (
              <article
                className={`stat-card ${stat.path ? "clickable" : ""}`}
                key={stat.label}
                onClick={() => stat.path && navigate(stat.path)}
              >
                <p>{stat.label}</p>
                <h2>{stat.value}</h2>
              </article>
            ))}
          </section>
        )}

        {user.role === "admin" && !chartsLoading && (
          <section
            className="dashboard-charts"
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr",
              gap: 24,
              marginTop: 32,
            }}
          >
            <article className="table-card">
              <h2>Visitors — Last 7 Days</h2>
              {trend.length === 0 ? (
                <p>No visitor activity in the last 7 days.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip cursor={{ fill: "rgba(0, 0, 0, 0.04)" }} />
                    <Legend />
                    <Bar dataKey="total" name="Total Requests" fill="#0f766e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="checkedIn" name="Checked In/Out" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cancelled" name="Cancelled" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </article>

            <article className="table-card">
              <h2>Today's Status Breakdown</h2>
              {statusBreakdown.length === 0 ? (
                <p>No visitor requests today yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      outerRadius={75}
                    >
                      {statusBreakdown.map((entry) => (
                        <Cell key={entry.key} fill={STATUS_COLORS[entry.key] || "#0f766e"} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </article>
          </section>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
