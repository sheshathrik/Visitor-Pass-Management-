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

/* =========================================================
   PORT
========================================================= */

const PORT = process.env.PORT || 5001;

/* =========================================================
   CORS
========================================================= */

const configuredOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const developmentOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const allowedOrigins =
  configuredOrigins.length > 0
    ? configuredOrigins
    : process.env.NODE_ENV === "production"
      ? []
      : developmentOrigins;

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without Origin headers
      // such as server-to-server requests.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn("Blocked CORS origin:", origin);

      return callback(new Error("Origin is not allowed by CORS"));
    },

    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],

    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* =========================================================
   BODY PARSER
========================================================= */

app.use(express.json({ limit: "1mb" }));

/* =========================================================
   STANDARD JSON RESPONSE FORMAT
========================================================= */

app.use((req, res, next) => {
  const sendJson = res.json.bind(res);

  res.json = (body) => {
    // If the route already uses the standard response format,
    // don't modify it.
    if (
      body &&
      typeof body === "object" &&
      typeof body.success === "boolean"
    ) {
      return sendJson(body);
    }

    const isError = res.statusCode >= 400;

    const message =
      body?.message || (isError ? "Request failed" : "Success");

    const error = body?.error || null;

    let data = body;

    // Remove display-only fields from data.
    if (
      body &&
      !Array.isArray(body) &&
      typeof body === "object"
    ) {
      const {
        message: _message,
        error: _error,
        ...rest
      } = body;

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

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Visitor Pass Management API is running",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "connecting",
  });
});

/* =========================================================
   API ROUTES
========================================================= */

app.use("/api/auth", authRoutes);

app.use("/api/employees", employeeRoutes);

app.use("/api/users", userRoutes);

app.use("/api/visits", visitRoutes);

app.use("/api/reports", reportRoutes);

app.use("/api/activities", activityRoutes);

/* =========================================================
   DEVELOPMENT ADMIN SEED
========================================================= */

app.post(
  "/api/admin/seed",
  protect,
  allowRoles("admin"),
  async (req, res) => {
    try {
      if (
        process.env.NODE_ENV === "production" ||
        process.env.ALLOW_ADMIN_SEED !== "true"
      ) {
        return res.status(403).json({
          message: "Admin seeding is disabled",
        });
      }

      const result = await bootstrapAdmin();

      return res.json({
        message: result.created
          ? "Admin user created successfully"
          : "No admin user was created",
        result,
      });
    } catch (err) {
      console.error("Admin seed error:", err);

      return res.status(500).json({
        message: "Could not seed admin user",
        error: err.message,
      });
    }
  }
);

/* =========================================================
   404 HANDLER
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use((error, req, res, next) => {
  console.error("Unhandled API error:", error);

  if (res.headersSent) {
    return next(error);
  }

  const isCorsError =
    error.message === "Origin is not allowed by CORS";

  return res.status(isCorsError ? 403 : 500).json({
    message: isCorsError
      ? error.message
      : "An unexpected server error occurred",

    error:
      process.env.NODE_ENV === "production"
        ? null
        : error.message,
  });
});

/* =========================================================
   START SERVER FIRST
========================================================= */

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

/* =========================================================
   CONNECT TO MONGODB
========================================================= */

async function connectDatabase() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined");
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully");

    // Bootstrap admin after database connection.
    if (typeof bootstrapAdmin === "function") {
      try {
        await bootstrapAdmin();
        console.log("Admin bootstrap completed");
      } catch (err) {
        console.error(
          "Admin bootstrap error:",
          err.message
        );
      }
    }
  } catch (error) {
    console.error(
      "MongoDB connection error:",
      error.message
    );

    // Don't immediately terminate the server.
    // Render can still see the health endpoint and
    // mongoose can be retried.
  }
}

connectDatabase();

/* =========================================================
   MONGOOSE CONNECTION EVENTS
========================================================= */

mongoose.connection.on("connected", () => {
  console.log("MongoDB connection established");
});

mongoose.connection.on("error", (error) => {
  console.error(
    "MongoDB connection error:",
    error.message
  );
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected");
});

/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Shutting down...");

  server.close(async () => {
    await mongoose.connection.close();

    console.log("Server shut down successfully");

    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("SIGINT received. Shutting down...");

  server.close(async () => {
    await mongoose.connection.close();

    console.log("Server shut down successfully");

    process.exit(0);
  });
});
