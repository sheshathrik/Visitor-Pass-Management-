const express = require("express");
const Visit = require("../models/Visit");
const { protect, allowRoles } = require("../middleware/authMiddleware");
const { buildVisitsExcel, buildVisitsPDF } = require("../utils/export");
const { fail } = require("../utils/response");

const router = express.Router();

const safeFilePart = (value) =>
  String(value || "visitor")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "visitor";

const parseDateOnly = (dateValue) => {
  if (typeof dateValue !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
};

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

// Local YYYY-MM-DD, not UTC — toISOString() shifts the date backward for
// any timezone ahead of UTC (e.g. IST), mislabeling "today" as yesterday.
const localDateKey = (value) => {
  const d = new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Shared by /summary, /export/excel, and /export/pdf so all three agree on
// exactly what date range "today" / "week" / "custom" means.
const resolveDateRange = (period, startDate, endDate) => {
  let rangeStart;
  let rangeEnd;

  if (period === "today") {
    rangeStart = startOfToday();
    rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + 1);
  } else if (period === "week") {
    rangeStart = startOfToday();
    const day = rangeStart.getDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    rangeStart.setDate(rangeStart.getDate() - daysSinceMonday);
    rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + 7);
  } else if (period === "custom") {
    if (!startDate || !endDate) {
      return { error: "startDate and endDate are required for a custom report" };
    }
    rangeStart = parseDateOnly(startDate);
    rangeEnd = parseDateOnly(endDate);
    if (!rangeStart || !rangeEnd) {
      return { error: "Use valid YYYY-MM-DD dates for startDate and endDate" };
    }
    if (rangeEnd < rangeStart) {
      return { error: "endDate cannot be earlier than startDate" };
    }
    rangeEnd.setDate(rangeEnd.getDate() + 1);
  } else {
    return { error: "period must be today, week, or custom" };
  }

  return { rangeStart, rangeEnd };
};

// Admin: summary report for today, this week, or a custom range
router.get("/summary", protect, allowRoles("admin"), async (req, res) => {
  try {
    const { period = "today", startDate, endDate } = req.query;

    const range = resolveDateRange(period, startDate, endDate);
    if (range.error) return res.status(400).json({ message: range.error });
    const { rangeStart, rangeEnd } = range;

    const dateFilter = {
      visitDate: {
        $gte: rangeStart,
        $lt: rangeEnd,
      },
    };

    // 1. Fetch matching visit documents and populate host employee details
    const visits = await Visit.find(dateFilter)
      .populate("employee", "name department")
      .sort({ visitDate: -1 });

    // 2. Compute statistics directly from counts
    const [
      totalVisitors,
      pending,
      approved,
      rejected,
      checkedIn,
      checkedOut,
      cancelled,
      currentlyInside,
    ] = await Promise.all([
      Visit.countDocuments(dateFilter),
      Visit.countDocuments({ ...dateFilter, status: "pending" }),
      Visit.countDocuments({ ...dateFilter, status: "approved" }),
      Visit.countDocuments({ ...dateFilter, status: "rejected" }),
      Visit.countDocuments({ ...dateFilter, status: "checked_in" }),
      Visit.countDocuments({ ...dateFilter, status: "checked_out" }),
      Visit.countDocuments({ ...dateFilter, status: "cancelled" }),
      Visit.countDocuments({ status: "checked_in" }),
    ]);

    // 3. Return statistics AND the visits array
    res.json({
      period,
      startDate: rangeStart,
      endDate: rangeEnd,
      statistics: {
        totalVisitors,
        pending,
        approved,
        rejected,
        checkedIn,
        checkedOut,
        cancelled,
        currentlyInside,
      },
      visits,
    });
  } catch (error) {
    res.status(500).json({
      message: "Could not generate report",
      error: error.message,
    });
  }
});

// Admin: Excel export for a period/range, optionally filtered to a status
router.get("/export/excel", protect, allowRoles("admin"), async (req, res) => {
  try {
    const { period = "today", startDate, endDate, status } = req.query;

    const range = resolveDateRange(period, startDate, endDate);
    if (range.error) return fail(res, range.error, 400);

    const filter = { visitDate: { $gte: range.rangeStart, $lt: range.rangeEnd } };
    if (status && status !== "all") filter.status = status;

    const visits = await Visit.find(filter)
      .populate("employee", "name department")
      .sort({ visitDate: -1 });

    const buffer = await buildVisitsExcel(
      visits,
      `Visitor Report (${period}${status && status !== "all" ? `, ${status}` : ""})`
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeFilePart(req.user.name)}_report.xlsx"`
    );
    res.send(buffer);
  } catch (error) {
    fail(res, "Could not export Excel report", 500, error.message);
  }
});

// Admin: PDF export for a period/range, optionally filtered to a status
router.get("/export/pdf", protect, allowRoles("admin"), async (req, res) => {
  try {
    const { period = "today", startDate, endDate, status } = req.query;

    const range = resolveDateRange(period, startDate, endDate);
    if (range.error) return fail(res, range.error, 400);

    const filter = { visitDate: { $gte: range.rangeStart, $lt: range.rangeEnd } };
    if (status && status !== "all") filter.status = status;

    const [visits, statistics] = await Promise.all([
      Visit.find(filter).populate("employee", "name department").sort({ visitDate: -1 }),
      (async () => {
        const [total, pending, approved, rejected, checkedIn, checkedOut, cancelled] =
          await Promise.all([
            Visit.countDocuments(filter),
            Visit.countDocuments({ ...filter, status: "pending" }),
            Visit.countDocuments({ ...filter, status: "approved" }),
            Visit.countDocuments({ ...filter, status: "rejected" }),
            Visit.countDocuments({ ...filter, status: "checked_in" }),
            Visit.countDocuments({ ...filter, status: "checked_out" }),
            Visit.countDocuments({ ...filter, status: "cancelled" }),
          ]);
        return {
          totalVisitors: total,
          pending,
          approved,
          rejected,
          checkedIn,
          checkedOut,
          cancelled,
        };
      })(),
    ]);

    const buffer = await buildVisitsPDF(
      visits,
      `Visitor Report (${period}${status && status !== "all" ? `, ${status}` : ""})`,
      statistics
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeFilePart(req.user.name)}_report.pdf"`
    );
    res.send(buffer);
  } catch (error) {
    fail(res, "Could not export PDF report", 500, error.message);
  }
});

// Admin: last 7 days visitor counts, for the dashboard trend chart
router.get("/trend", protect, allowRoles("admin"), async (req, res) => {
  try {
    const days = 7;
    const end = startOfToday();
    end.setDate(end.getDate() + 1);
    const start = new Date(end);
    start.setDate(start.getDate() - days);

    const visits = await Visit.find({
      visitDate: { $gte: start, $lt: end },
    }).select("visitDate status");

    const buckets = {};
    for (let i = 0; i < days; i += 1) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = localDateKey(d);
      buckets[key] = { date: key, total: 0, checkedIn: 0, cancelled: 0 };
    }

    visits.forEach((visit) => {
      const key = localDateKey(visit.visitDate);
      if (!buckets[key]) return;
      buckets[key].total += 1;
      if (visit.status === "checked_in" || visit.status === "checked_out") {
        buckets[key].checkedIn += 1;
      }
      if (visit.status === "cancelled") buckets[key].cancelled += 1;
    });

    res.json(Object.values(buckets));
  } catch (error) {
    fail(res, "Could not fetch trend data", 500, error.message);
  }
});

module.exports = router;