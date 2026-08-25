const express = require("express");
const ActivityLog = require("../models/ActivityLog");
const Visit = require("../models/Visit");
const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

// Admin: full activity log across all visitors.
// Employee: activity log scoped to visits assigned to them only.
router.get("/", protect, allowRoles("admin", "employee"), async (req, res) => {
  try {
    const query = {};

    if (req.user.role === "employee") {
      if (!req.user.employee) {
        return res.status(400).json({
          message: "Employee account is not linked to an employee record",
        });
      }

      const assignedVisits = await Visit.find({
        employee: req.user.employee,
      }).select("_id");

      query.visit = { $in: assignedVisits.map((visit) => visit._id) };
    }

    const activities = await ActivityLog.find(query)
      .populate("visit", "visitorName phone visitDate status")
      .populate("performedBy", "name email role")
      .sort({ createdAt: -1 });

    res.json(activities);
  } catch (error) {
    res.status(500).json({
      message: "Could not fetch activity history",
      error: error.message,
    });
  }
});

module.exports = router;