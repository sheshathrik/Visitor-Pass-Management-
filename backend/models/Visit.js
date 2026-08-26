const mongoose = require("mongoose");

const visitSchema = new mongoose.Schema(
  {
    visitorName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    idProof: {
      type: String,
      trim: true,
    },
    purpose: {
      type: String,
      required: true,
      trim: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    visitDate: {
      type: Date,
      required: true,
    },
    expectedArrivalTime: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "checked_in",
        "checked_out",
        "cancelled",
      ],
      default: "pending",
    },
    remarks: {
      type: String,
      trim: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    checkInTime: {
      type: Date,
      default: null,
    },
    checkOutTime: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes for the query patterns actually used across visitRoutes.js /
// reportRoutes.js.
//
// { employee: 1, status: 1 } and { status: 1 } were intentionally removed
// below: both are strict prefixes of the compound indexes that already
// exist ({ employee: 1, status: 1, visitDate: -1 } and
// { status: 1, visitDate: -1, createdAt: -1 } respectively). MongoDB can
// serve any query matched by a prefix using the longer compound index, so
// keeping the shorter duplicate only adds write overhead and storage with
// no query-planner benefit.
visitSchema.index({ phone: 1, visitDate: 1 });      // duplicate-visit-on-same-date check
visitSchema.index({ phone: 1, status: 1 });          // NEW: active-visit check (POST / handler) - was previously unindexed
visitSchema.index({ employee: 1, status: 1, visitDate: -1 }); // pending-per-employee count, GET /pending list
visitSchema.index({ visitDate: -1 });                 // date-range/report queries with no status filter
visitSchema.index({ status: 1, visitDate: -1, createdAt: -1 }); // history list, active-only filter, sorted views

module.exports = mongoose.model("Visit", visitSchema);