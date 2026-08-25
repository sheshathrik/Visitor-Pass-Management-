const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const activityRoutes = require("./routes/activityRoutes");
const authRoutes = require("./routes/authRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const userRoutes = require("./routes/userRoutes");
const visitRoutes = require("./routes/visitRoutes");
const reportRoutes = require("./routes/reportRoutes");
const { protect, allowRoles } = require("./middleware/authMiddleware");

const bootstrapAdmin = require("./seedAdmin");

const app = express();

// Keep CORS explicit in production. Set CORS_ORIGINS to a comma-separated
// list of deployed frontend URLs; local Vite URLs remain available in dev.
const configuredOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const developmentOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const allowedOrigins =
  configuredOrigins.length > 0
    ? configuredOrigins
    : process.env.NODE_ENV === "production"
      ? []
      : developmentOrigins;

app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header include server-to-server clients.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin is not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));

// Keep every JSON API response predictable without changing the individual
// route handlers. File downloads use res.send(), so their binary bodies are
// intentionally not affected.
app.use((req, res, next) => {
  const sendJson = res.json.bind(res);

  res.json = (body) => {
    // A handler may already use the shared response helpers.
    if (body && typeof body === "object" && typeof body.success === "boolean") {
      return sendJson(body);
    }

    const isError = res.statusCode >= 400;
    const message = body?.message || (isError ? "Request failed" : "Success");
    const error = body?.error || null;
    let data = body;

    // Do not duplicate display-only fields inside data. This keeps objects
    // such as { message, visit } available as data.visit to API clients.
    if (body && !Array.isArray(body) && typeof body === "object") {
      const { message: _message, error: _error, ...rest } = body;
      data = Object.keys(rest).length ? rest : null;
    }

    return sendJson({
      success: !isError,
      message,
      data: isError ? null : data,
      error: isError ? error : null,
    });
  };

  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/users", userRoutes);
app.use("/api/visits", visitRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/activities", activityRoutes);

// Development-only bootstrap endpoint. It never resets an existing account.
app.post("/api/admin/seed", protect, allowRoles("admin"), async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production" || process.env.ALLOW_ADMIN_SEED !== "true") {
      return res.status(403).json({ message: "Admin seeding is disabled" });
    }
    const result = await bootstrapAdmin();
    res.json({ message: result.created ? "Admin user created successfully" : "No admin user was created", result });
  } catch (err) {
    res.status(500).json({ message: "Could not seed admin user", error: err.message });
  }
});

// Health Check Endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Visitor Pass Management API is running",
  });
});

// Fallback 404 Route Handler
app.use((req, res) => {
  res.status(404).json({ message: `Cannot ${req.method} ${req.originalUrl}` });
});

// Last-resort handler for errors thrown by middleware or route handlers.
// The response envelope middleware above guarantees its shape is consistent.
app.use((error, req, res, next) => {
  console.error("Unhandled API error:", error);
  if (res.headersSent) return next(error);
  const isCorsError = error.message === "Origin is not allowed by CORS";
  res.status(isCorsError ? 403 : 500).json({
    message: isCorsError ? error.message : "An unexpected server error occurred",
    // Do not disclose internals to API consumers in production.
    error: process.env.NODE_ENV === "production" ? null : error.message,
  });
});

const PORT = process.env.PORT || 5001;

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB connected successfully");

    if (typeof bootstrapAdmin === "function") {
      try {
        await bootstrapAdmin();
      } catch (err) {
        console.error("Admin bootstrap error:", err.message);
      }
    }

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error.message);
  });
