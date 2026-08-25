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
// reportRoutes.js: duplicate/active checks by phone+date, employee-scoped
// pending lookups, status filters, and date-sorted history/report views.
visitSchema.index({ phone: 1, visitDate: 1 });
visitSchema.index({ employee: 1, status: 1 });
visitSchema.index({ employee: 1, status: 1, visitDate: -1 });
visitSchema.index({ status: 1 });
visitSchema.index({ visitDate: -1 });
visitSchema.index({ status: 1, visitDate: -1, createdAt: -1 });

module.exports = mongoose.model("Visit", visitSchema);
