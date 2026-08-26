const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

/* =========================================================
   IMPORT ROUTES
========================================================= */

const activityRoutes = require("./routes/activityRoutes");
const authRoutes = require("./routes/authRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const userRoutes = require("./routes/userRoutes");
const visitRoutes = require("./routes/visitRoutes");
const reportRoutes = require("./routes/reportRoutes");

const { protect, allowRoles } = require("./middleware/authMiddleware");
const bootstrapAdmin = require("./seedAdmin");

/* =========================================================
   APP
========================================================= */

const app = express();

const PORT = process.env.PORT || 5001;

/* =========================================================
   BASIC MIDDLEWARE
========================================================= */

app.use(express.json({ limit: "1mb" }));

/* =========================================================
   CORS
========================================================= */

// Add your frontend URLs in Render as:
// CORS_ORIGINS=https://your-frontend.vercel.app,http://localhost:5173

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
    : developmentOrigins;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests from Postman, server-to-server,
      // and direct browser navigation.
      if (!origin) {
        return callback(null, true);
      }

      // Allow configured frontend URLs
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(`Blocked CORS origin: ${origin}`);

      return callback(
        new Error("Origin is not allowed by CORS")
      );
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

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

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
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
   DEVELOPMENT ADMIN SEED ROUTE
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
          success: false,
          message: "Admin seeding is disabled",
        });
      }

      const result = await bootstrapAdmin();

      return res.status(200).json({
        success: true,
        message: result.created
          ? "Admin user created successfully"
          : "Admin user already exists",
        data: result,
      });
    } catch (error) {
      console.error(
        "Admin seed error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Could not seed admin user",
      });
    }
  }
);

/* =========================================================
   404 HANDLER
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use((error, req, res, next) => {
  console.error(
    "Unhandled server error:",
    error.message
  );

  if (res.headersSent) {
    return next(error);
  }

  const isCorsError =
    error.message === "Origin is not allowed by CORS";

  return res.status(isCorsError ? 403 : 500).json({
    success: false,
    message: isCorsError
      ? error.message
      : "Internal server error",
  });
});

/* =========================================================
   START SERVER
   IMPORTANT:
   Start the server immediately so Render can detect PORT.
========================================================= */

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log("=================================");
  console.log(`Server running on port ${PORT}`);
  console.log(
    `Environment: ${
      process.env.NODE_ENV || "development"
    }`
  );
  console.log("=================================");
});

/* =========================================================
   CONNECT TO MONGODB
========================================================= */

async function connectDatabase() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined");
    }

    console.log("Connecting to MongoDB...");

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully");

    /* =============================================
       BOOTSTRAP ADMIN
    ============================================= */

    if (typeof bootstrapAdmin === "function") {
      try {
        await bootstrapAdmin();

        console.log(
          "Admin bootstrap completed successfully"
        );
      } catch (error) {
        console.error(
          "Admin bootstrap error:",
          error.message
        );
      }
    }
  } catch (error) {
    console.error(
      "MongoDB connection error:",
      error.message
    );
  }
}

connectDatabase();

/* =========================================================
   MONGOOSE EVENTS
========================================================= */

mongoose.connection.on("connected", () => {
  console.log("MongoDB connection established");
});

mongoose.connection.on("error", (error) => {
  console.error(
    "MongoDB error:",
    error.message
  );
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected");
});

/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);

  server.close(async () => {
    try {
      await mongoose.connection.close();

      console.log(
        "MongoDB connection closed"
      );

      process.exit(0);
    } catch (error) {
      console.error(
        "Shutdown error:",
        error.message
      );

      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("SIGINT", () => shutdown("SIGINT"));
