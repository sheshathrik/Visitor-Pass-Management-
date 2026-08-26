const express = require("express");
const Visit = require("../models/Visit");
const Employee = require("../models/Employee");
const User = require("../models/User");
const ActivityLog = require("../models/ActivityLog");
const { protect, allowRoles } = require("../middleware/authMiddleware");

const {
  notifyVisitCreated,
  notifyVisitorRegistered,
  notifyVisitDecision,
  notifyCheckIn,
  notifyCheckOut,
} = require('../utils/notify');

const router = express.Router();

const parseDateOnly = (dateValue) => {
  if (typeof dateValue !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return null;
  }
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  // Date's constructor silently rolls invalid input such as 2026-02-31 into
  // March. Reject it so business rules are enforced by the API, not the UI.
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
};

const validStatuses = new Set([
  "pending", "approved", "rejected", "checked_in", "checked_out", "cancelled",
]);

const safeSearch = (value) => String(value).trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const validIds = (ids) =>
  Array.isArray(ids) && ids.length > 0 && ids.length <= 100 &&
  ids.every((id) => typeof id === "string" && require("mongoose").isValidObjectId(id));

const safeFilePart = (value) =>
  String(value || "visitor")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "visitor";

// A single-visitor export is normally saved or emailed as an individual
// record, so make its filename immediately identifiable to an administrator.
// Strip path/control characters rather than trusting database content.
const visitorReportFileName = (visitorName, extension) => {
  const name = String(visitorName || "Visitor")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 80) || "Visitor";
  return `${name}_Reports.${extension}`;
};

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

// Receptionist: register a visitor request
router.post("/", protect, allowRoles("receptionist"), async (req, res) => {
  try {
    const {
      visitorName,
      phone,
      email,
      idProof,
      purpose,
      employee,
      visitDate,
      expectedArrivalTime,
    } = req.body;

    if (
      !visitorName ||
      !phone ||
      !purpose ||
      !employee ||
      !visitDate ||
      !expectedArrivalTime
    ) {
      return res.status(400).json({
        message: "All required visitor details must be provided",
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) {
      return res.status(400).json({
        message: "Visit date must use YYYY-MM-DD format",
      });
    }

    if (!/^\d{2}:\d{2}$/.test(expectedArrivalTime)) {
      return res.status(400).json({
        message: "Expected arrival time must use HH:MM format",
      });
    }

    const selectedDate = parseDateOnly(visitDate);
    const [hours, minutes] = expectedArrivalTime.split(":").map(Number);

    if (
      !selectedDate ||
      hours > 23 ||
      minutes > 59
    ) {
      return res.status(400).json({
        message: "Visit date or expected arrival time is invalid",
      });
    }

    // Rule 3
    if (selectedDate < startOfToday()) {
      return res.status(400).json({
        message: "Visit date cannot be earlier than the current date",
      });
    }

    // Rule 4
    const expectedDateTime = new Date(selectedDate);
    expectedDateTime.setHours(hours, minutes, 0, 0);

    const isToday = selectedDate.getTime() === startOfToday().getTime();

    if (isToday && expectedDateTime < new Date()) {
      return res.status(400).json({
        message: "Expected arrival time cannot be earlier than the current time",
      });
    }

    if (!require("mongoose").isValidObjectId(employee)) {
      return res.status(400).json({ message: "Employee id is invalid" });
    }

    const normalizedPhone = String(phone).trim();
    if (!/^\+?[1-9]\d{7,14}$/.test(normalizedPhone)) {
      return res.status(400).json({ message: "Provide a valid phone number" });
    }

    const employeeToVisit = await Employee.findOne({
      _id: employee,
      isActive: true,
    });

    if (!employeeToVisit) {
      return res.status(404).json({
        message: "Selected active employee was not found",
      });
    }

    // Rule 2
    const duplicateVisit = await Visit.findOne({
      phone: normalizedPhone,
      visitDate: selectedDate,
      status: { $ne: "cancelled" },
    });

    if (duplicateVisit) {
      return res.status(400).json({
        message: "This visitor is already registered for the selected date",
      });
    }

    // Rule 1
    const activeVisit = await Visit.findOne({
      phone: normalizedPhone,
      status: { $in: ["approved", "checked_in"] },
    });

    if (activeVisit) {
      return res.status(400).json({
        message: "This visitor already has an active visit",
      });
    }

    // Rule 5
    const pendingRequests = await Visit.countDocuments({
      employee,
      status: "pending",
    });

    if (pendingRequests >= 3) {
      return res.status(400).json({
        message: "This employee already has 3 pending visitor requests",
      });
    }

    const visit = await Visit.create({
      visitorName,
      phone: normalizedPhone,
      email,
      idProof,
      purpose,
      employee,
      visitDate: selectedDate,
      expectedArrivalTime,
      createdBy: req.user._id,
    });

    await ActivityLog.create({
      visit: visit._id,
      action: "Created",
      performedBy: req.user._id,
    });

    // Notify the host employee that a new request is awaiting their approval.
    // Fire-and-forget: notification failures must never block the response.
    User.findOne({ employee: employeeToVisit._id })
      .then((employeeUser) => notifyVisitCreated(visit, employeeUser))
      .catch((err) => console.error("notifyVisitCreated failed:", err.message));

    // Send an SMS confirmation to the VISITOR'S OWN number (the one just
    // entered in the Register Visitor form), confirming their request was
    // received. This is independent of the host-employee email above and
    // does not block the response if it fails.
    notifyVisitorRegistered(visit).catch((err) =>
      console.error("notifyVisitorRegistered failed:", err.message)
    );

    res.status(201).json({
      message: "Visitor request created successfully and is awaiting approval",
      visit,
    });
  } catch (error) {
    res.status(500).json({
      message: "Could not register visitor",
      error: error.message,
    });
  }
});

// Employee: view assigned pending requests
router.get("/pending", protect, allowRoles("employee"), async (req, res) => {
  try {
    if (!req.user.employee) {
      return res.status(400).json({
        message: "Employee account is not linked to an employee record",
      });
    }

    const visits = await Visit.find({
      employee: req.user.employee,
      status: "pending",
    })
      .populate("employee", "name department designation")
      .populate("createdBy", "name email")
      .sort({ visitDate: 1, expectedArrivalTime: 1 });

    res.json(visits);
  } catch (error) {
    res.status(500).json({
      message: "Could not fetch pending visitor requests",
      error: error.message,
    });
  }
});

// NOTE: these /bulk/* routes MUST be registered before /:id/approve,
// /:id/reject, /:id/check-in below — otherwise Express matches "bulk" as
// the :id param and these routes are never reached.

// Employee: bulk-approve multiple requests assigned to them
router.patch("/bulk/approve", protect, allowRoles("employee"), async (req, res) => {
  try {
    const { ids, remarks } = req.body;

    if (!validIds(ids)) {
      return res.status(400).json({ message: "Provide 1 to 100 valid visit ids" });
    }

    if (!req.user.employee) {
      return res.status(400).json({
        message: "Employee account is not linked to an employee record",
      });
    }

    // Only touch requests that are (a) assigned to this employee and (b) still pending.
    // Anything else in the list is silently skipped and reported back.
    const visits = await Visit.find({
      _id: { $in: ids },
      employee: req.user.employee,
      status: "pending",
    });

    const eligibleIds = visits.map((v) => v._id);

    await Visit.updateMany(
      { _id: { $in: eligibleIds } },
      {
        $set: {
          status: "approved",
          approvedBy: req.user._id,
          approvedAt: new Date(),
          ...(remarks ? { remarks } : {}),
        },
      }
    );

    await ActivityLog.insertMany(
      eligibleIds.map((visitId) => ({
        visit: visitId,
        action: "Approved",
        performedBy: req.user._id,
        remarks,
      }))
    );

    visits.forEach((visit) => {
      visit.status = "approved";
      notifyVisitDecision(visit, "approved").catch((err) =>
        console.error("notifyVisitDecision(approved) failed:", err.message)
      );
    });

    res.json({
      message: `${eligibleIds.length} of ${ids.length} requests approved`,
      approvedCount: eligibleIds.length,
      skippedCount: ids.length - eligibleIds.length,
    });
  } catch (error) {
    res.status(500).json({
      message: "Could not bulk approve visitor requests",
      error: error.message,
    });
  }
});

// Employee: bulk-reject multiple requests assigned to them
router.patch("/bulk/reject", protect, allowRoles("employee"), async (req, res) => {
  try {
    const { ids, remarks } = req.body;

    if (!validIds(ids)) {
      return res.status(400).json({ message: "Provide 1 to 100 valid visit ids" });
    }

    if (!req.user.employee) {
      return res.status(400).json({
        message: "Employee account is not linked to an employee record",
      });
    }

    const visits = await Visit.find({
      _id: { $in: ids },
      employee: req.user.employee,
      status: "pending",
    });

    const eligibleIds = visits.map((v) => v._id);

    await Visit.updateMany(
      { _id: { $in: eligibleIds } },
      {
        $set: {
          status: "rejected",
          rejectedBy: req.user._id,
          rejectedAt: new Date(),
          ...(remarks ? { remarks } : {}),
        },
      }
    );

    await ActivityLog.insertMany(
      eligibleIds.map((visitId) => ({
        visit: visitId,
        action: "Rejected",
        performedBy: req.user._id,
        remarks,
      }))
    );

    visits.forEach((visit) => {
      visit.status = "rejected";
      notifyVisitDecision(visit, "rejected").catch((err) =>
        console.error("notifyVisitDecision(rejected) failed:", err.message)
      );
    });

    res.json({
      message: `${eligibleIds.length} of ${ids.length} requests rejected`,
      rejectedCount: eligibleIds.length,
      skippedCount: ids.length - eligibleIds.length,
    });
  } catch (error) {
    res.status(500).json({
      message: "Could not bulk reject visitor requests",
      error: error.message,
    });
  }
});

// Receptionist: bulk check-in approved visitors (e.g. a group arriving together)
router.patch("/bulk/check-in", protect, allowRoles("receptionist"), async (req, res) => {
  try {
    const { ids } = req.body;

    if (!validIds(ids)) {
      return res.status(400).json({ message: "Provide 1 to 100 valid visit ids" });
    }

    const visits = await Visit.find({ _id: { $in: ids }, status: "approved" });
    const eligibleIds = visits.map((v) => v._id);
    const checkInTime = new Date();

    await Visit.updateMany(
      { _id: { $in: eligibleIds } },
      { $set: { status: "checked_in", checkInTime } }
    );

    await ActivityLog.insertMany(
      eligibleIds.map((visitId) => ({
        visit: visitId,
        action: "Checked In",
        performedBy: req.user._id,
      }))
    );

    visits.forEach((visit) => {
      visit.checkInTime = checkInTime;
      notifyCheckIn(visit).catch((err) => console.error("notifyCheckIn failed:", err.message));
    });

    res.json({
      message: `${eligibleIds.length} of ${ids.length} visitors checked in`,
      checkedInCount: eligibleIds.length,
      skippedCount: ids.length - eligibleIds.length,
    });
  } catch (error) {
    res.status(500).json({
      message: "Could not bulk check in visitors",
      error: error.message,
    });
  }
});

// Employee: approve assigned pending request
router.patch("/:id/approve", protect, allowRoles("employee"), async (req, res) => {
  try {
    const { remarks } = req.body;

    if (!req.user.employee) {
      return res.status(400).json({
        message: "Employee account is not linked to an employee record",
      });
    }

    if (!require("mongoose").isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Visitor request id is invalid" });
    }
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        message: "Visitor request not found",
      });
    }

    if (visit.employee.toString() !== req.user.employee.toString()) {
      return res.status(403).json({
        message: "You can approve only requests assigned to you",
      });
    }

    if (visit.status !== "pending") {
      return res.status(400).json({
        message: "Only pending visitor requests can be approved",
      });
    }

    visit.status = "approved";
    visit.approvedBy = req.user._id;
    visit.approvedAt = new Date();
    visit.remarks = remarks || visit.remarks;

    await visit.save();

    await ActivityLog.create({
      visit: visit._id,
      action: "Approved",
      performedBy: req.user._id,
      remarks,
    });

    notifyVisitDecision(visit, "approved").catch((err) =>
      console.error("notifyVisitDecision(approved) failed:", err.message)
    );

    res.json({
      message: "Visitor request approved successfully",
      visit,
    });
  } catch (error) {
    res.status(500).json({
      message: "Could not approve visitor request",
      error: error.message,
    });
  }
});

// Employee: reject assigned pending request
router.patch("/:id/reject", protect, allowRoles("employee"), async (req, res) => {
  try {
    const { remarks } = req.body;

    if (!req.user.employee) {
      return res.status(400).json({
        message: "Employee account is not linked to an employee record",
      });
    }

    if (!require("mongoose").isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Visitor request id is invalid" });
    }
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        message: "Visitor request not found",
      });
    }

    if (visit.employee.toString() !== req.user.employee.toString()) {
      return res.status(403).json({
        message: "You can reject only requests assigned to you",
      });
    }

    if (visit.status !== "pending") {
      return res.status(400).json({
        message: "Only pending visitor requests can be rejected",
      });
    }

    visit.status = "rejected";
    visit.rejectedBy = req.user._id;
    visit.rejectedAt = new Date();
    visit.remarks = remarks || visit.remarks;

    await visit.save();

    await ActivityLog.create({
      visit: visit._id,
      action: "Rejected",
      performedBy: req.user._id,
      remarks,
    });

    notifyVisitDecision(visit, "rejected").catch((err) =>
      console.error("notifyVisitDecision(rejected) failed:", err.message)
    );

    res.json({
      message: "Visitor request rejected successfully",
      visit,
    });
  } catch (error) {
    res.status(500).json({
      message: "Could not reject visitor request",
      error: error.message,
    });
  }
});

// Receptionist: check in an approved visitor
router.patch("/:id/check-in", protect, allowRoles("receptionist"), async (req, res) => {
  try {
    if (!require("mongoose").isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Visitor request id is invalid" });
    }
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        message: "Visitor request not found",
      });
    }

    // Rules 6, 7, and 9
    if (visit.status !== "approved") {
      return res.status(400).json({
        message: "Only approved visitors can be checked in",
      });
    }

    // A future booking must not be admitted before its scheduled day.
    if (startOfDay(visit.visitDate) > startOfToday()) {
      return res.status(400).json({
        message: "A visitor can only be checked in on or after the scheduled visit date",
      });
    }

    visit.status = "checked_in";
    visit.checkInTime = new Date();

    await visit.save();

    await ActivityLog.create({
      visit: visit._id,
      action: "Checked In",
      performedBy: req.user._id,
    });

    notifyCheckIn(visit).catch((err) =>
      console.error("notifyCheckIn failed:", err.message)
    );

    res.json({
      message: "Visitor checked in successfully",
      visit,
    });
  } catch (error) {
    res.status(500).json({
      message: "Could not check in visitor",
      error: error.message,
    });
  }
});

// Receptionist: check out a checked-in visitor
router.patch("/:id/check-out", protect, allowRoles("receptionist"), async (req, res) => {
  try {
    if (!require("mongoose").isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Visitor request id is invalid" });
    }
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        message: "Visitor request not found",
      });
    }

    if (visit.status !== "checked_in") {
      return res.status(400).json({
        message: "Only checked-in visitors can be checked out",
      });
    }

    const checkOutTime = new Date();

    // Rule 8
    if (!visit.checkInTime || checkOutTime <= visit.checkInTime) {
      return res.status(400).json({
        message: "Check-out time must be later than check-in time",
      });
    }

    visit.status = "checked_out";
    visit.checkOutTime = checkOutTime;

    await visit.save();

    await ActivityLog.create({
      visit: visit._id,
      action: "Checked Out",
      performedBy: req.user._id,
    });

    notifyCheckOut(visit).catch((err) =>
      console.error("notifyCheckOut failed:", err.message)
    );

    res.json({
      message: "Visitor checked out successfully",
      visit,
    });
  } catch (error) {
    res.status(500).json({
      message: "Could not check out visitor",
      error: error.message,
    });
  }
});

// Receptionist: cancel pending or approved request
router.patch("/:id/cancel", protect, allowRoles("receptionist"), async (req, res) => {
  try {
    const { remarks } = req.body;

    if (!require("mongoose").isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Visitor request id is invalid" });
    }
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        message: "Visitor request not found",
      });
    }

    if (!["pending", "approved"].includes(visit.status)) {
      return res.status(400).json({
        message: "Only pending or approved requests can be cancelled",
      });
    }

    visit.status = "cancelled";
    visit.remarks = remarks || visit.remarks;

    await visit.save();

    await ActivityLog.create({
      visit: visit._id,
      action: "Cancelled",
      performedBy: req.user._id,
      remarks,
    });

    res.json({
      message: "Visitor request cancelled successfully",
      visit,
    });
  } catch (error) {
    res.status(500).json({
      message: "Could not cancel visitor request",
      error: error.message,
    });
  }
});

// All roles: visitor history with search and filters
router.get("/", protect, async (req, res) => {
  try {
    const {
      visitorName,
      employeeName,
      status,
      visitDate,
      startDate,
      endDate,
      activeOnly,
    } = req.query;

    const query = {};

    // Employee can view only their own visitor records.
    if (req.user.role === "employee") {
      query.employee = req.user.employee;
    }

    if (visitorName) {
      query.visitorName = {
        $regex: safeSearch(visitorName),
        $options: "i",
      };
    }

    if (status && !validStatuses.has(status)) {
      return res.status(400).json({ message: "Invalid visitor status filter" });
    }

    if (status) {
      query.status = status;
    }

    // Rule 10: Cancelled visits do not appear in active lists.
    // FIX: previously this overwrote a specific `status` filter above
    // whenever activeOnly=true was also passed (e.g. ?status=pending&activeOnly=true
    // would silently drop the "pending" filter). Now it only widens the
    // filter when no specific status was requested, and short-circuits to
    // an impossible match if the two filters directly contradict
    // (status=cancelled together with activeOnly=true).
    if (activeOnly === "true") {
      if (query.status === "cancelled") {
        query.status = { $in: [] };
      } else if (!query.status) {
        query.status = { $ne: "cancelled" };
      }
    }

    if (employeeName && req.user.role !== "employee") {
      const employees = await Employee.find({
        name: { $regex: safeSearch(employeeName), $options: "i" },
      }).select("_id");

      query.employee = { $in: employees.map((employee) => employee._id) };
    }

    // FIX: `visitDate` (exact day) and `startDate`/`endDate` (range) used to
    // both write to `query.visitDate`, so passing both silently dropped the
    // exact-day filter. Treat them as mutually exclusive: an exact
    // `visitDate` takes precedence over a range.
    if (visitDate) {
      const date = parseDateOnly(visitDate);
      if (!date) return res.status(400).json({ message: "visitDate must use YYYY-MM-DD format" });
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      query.visitDate = {
        $gte: date,
        $lt: nextDate,
      };
    } else if (startDate || endDate) {
      query.visitDate = {};

      if (startDate) {
        const parsedStart = parseDateOnly(startDate);
        if (!parsedStart) return res.status(400).json({ message: "startDate must use YYYY-MM-DD format" });
        query.visitDate.$gte = parsedStart;
      }

      if (endDate) {
        const lastDate = parseDateOnly(endDate);
        if (!lastDate) return res.status(400).json({ message: "endDate must use YYYY-MM-DD format" });
        if (query.visitDate.$gte && lastDate < query.visitDate.$gte) {
          return res.status(400).json({ message: "endDate cannot be earlier than startDate" });
        }
        lastDate.setDate(lastDate.getDate() + 1);
        query.visitDate.$lt = lastDate;
      }
    }

    const visits = await Visit.find(query)
      .populate("employee", "name department designation")
      .populate("createdBy", "name email")
      .sort({ visitDate: -1, createdAt: -1 });

    res.json(visits);
  } catch (error) {
    res.status(500).json({
      message: "Could not fetch visitor history",
      error: error.message,
    });
  }
});

// Admin and Receptionist: visitors currently inside
router.get(
  "/active/currently-inside",
  protect,
  allowRoles("admin", "receptionist"),
  async (req, res) => {
    try {
      const visits = await Visit.find({
        status: "checked_in",
      })
        .populate("employee", "name department designation")
        .sort({ checkInTime: -1 });

      res.json(visits);
    } catch (error) {
      res.status(500).json({
        message: "Could not fetch visitors currently inside",
        error: error.message,
      });
    }
  }
);

// All roles: activity history for one visitor request
router.get("/:id/activity", protect, async (req, res) => {
  try {
    if (!require("mongoose").isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Visitor request id is invalid" });
    }
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        message: "Visitor request not found",
      });
    }

    // Employee can view activity only for requests assigned to them.
    if (
      req.user.role === "employee" &&
      visit.employee.toString() !== req.user.employee.toString()
    ) {
      return res.status(403).json({
        message: "You do not have permission to view this activity history",
      });
    }

    const activities = await ActivityLog.find({
      visit: visit._id,
    })
      .populate("performedBy", "name email role")
      .sort({ createdAt: 1 });

    res.json(activities);
  } catch (error) {
    res.status(500).json({
      message: "Could not fetch activity history",
      error: error.message,
    });
  }
});

// Admin: export a specific selection of visits (e.g. from a filtered/checked
// list in the UI) rather than a whole date range. format=excel|pdf
router.get("/bulk/export", protect, allowRoles("admin"), async (req, res) => {
  try {
    const { ids, format = "excel" } = req.query;

    if (!ids) {
      return res.status(400).json({ message: "Provide ids as a comma-separated query param" });
    }

    const idList = [...new Set(String(ids).split(",").filter(Boolean))];
    if (idList.length > 100 || !idList.every((id) => require("mongoose").isValidObjectId(id))) {
      return res.status(400).json({ message: "Provide 1 to 100 valid visit ids" });
    }
    if (!["excel", "pdf"].includes(format)) {
      return res.status(400).json({ message: "format must be excel or pdf" });
    }

    const visits = await Visit.find({ _id: { $in: idList } })
      .populate("employee", "name department")
      .sort({ visitDate: -1 });

    // Use the visitor's name for an individual export. A plural collection
    // gets a stable generic filename so no one visitor is misrepresented.
    const fileName =
      visits.length === 1
        ? visitorReportFileName(visits[0].visitorName, format === "pdf" ? "pdf" : "xlsx")
        : `SelectedVisitors_Reports.${format === "pdf" ? "pdf" : "xlsx"}`;

    const { buildVisitsExcel, buildVisitsPDF } = require("../utils/export");

    if (format === "pdf") {
      const buffer = await buildVisitsPDF(visits, "Selected Visitors Export");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );
      return res.send(buffer);
    }

    const buffer = await buildVisitsExcel(visits, "Selected Visitors Export");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );
    res.send(buffer);
  } catch (error) {
    res.status(500).json({
      message: "Could not export selected visitors",
      error: error.message,
    });
  }
});

module.exports = router;