const express = require("express");
const Employee = require("../models/Employee");
const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();
const mongoose = require("mongoose");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const editableFields = new Set(["name", "email", "department", "designation", "phone", "isActive"]);

const validateEmployeeInput = ({ name, email, department, phone }, partial = false) => {
  if (
    !partial &&
    (typeof name !== "string" || !name.trim() || typeof email !== "string" || !email.trim() ||
      typeof department !== "string" || !department.trim())
  ) {
    return "Name, email, and department are required";
  }
  if (email !== undefined && (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim()) || email.length > 254)) {
    return "Provide a valid email address";
  }
  if (phone !== undefined && phone && (typeof phone !== "string" || !/^\+?[1-9]\d{7,14}$/.test(phone.trim()))) {
    return "Provide a valid phone number";
  }
  return null;
};

// Admin: create an employee
router.post("/", protect, allowRoles("admin"), async (req, res) => {
  try {
    const { name, email, department, designation, phone } = req.body;

    const validationError = validateEmployeeInput({ name, email, department, phone });
    if (validationError) return res.status(400).json({ message: validationError });

    const existingEmployee = await Employee.findOne({
      email: email.toLowerCase(),
    });

    if (existingEmployee) {
      return res.status(400).json({
        message: "An employee with this email already exists",
      });
    }

    const employee = await Employee.create({
      name,
      email: email.toLowerCase(),
      department,
      designation,
      phone,
    });

    res.status(201).json({
      message: "Employee created successfully",
      employee,
    });
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 500).json({
      message: error.code === 11000 ? "An employee with this email already exists" : "Could not create employee",
      error: error.code === 11000 ? null : error.message,
    });
  }
});

// Admin and Receptionist: view active employees
router.get("/", protect, allowRoles("admin", "receptionist"), async (req, res) => {
  try {
    const employees = await Employee.find({ isActive: true }).sort({
      name: 1,
    });

    res.json(employees);
  } catch (error) {
    res.status(500).json({
      message: "Could not fetch employees",
      error: error.message,
    });
  }
});

// Admin: update employee details
router.patch("/:id", protect, allowRoles("admin"), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Employee id is invalid" });
    }

    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([field]) => editableFields.has(field))
    );
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "Provide at least one editable employee field" });
    }
    const validationError = validateEmployeeInput(updates, true);
    if (validationError) return res.status(400).json({ message: validationError });
    if (updates.email) updates.email = updates.email.toLowerCase().trim();

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!employee) {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    res.json({
      message: "Employee updated successfully",
      employee,
    });
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 500).json({
      message: error.code === 11000 ? "An employee with this email already exists" : "Could not update employee",
      error: error.code === 11000 ? null : error.message,
    });
  }
});

// Admin: deactivate an employee instead of permanently deleting data
router.delete("/:id", protect, allowRoles("admin"), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Employee id is invalid" });
    }
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    res.json({
      message: "Employee deactivated successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Could not deactivate employee",
      error: error.message,
    });
  }
});

module.exports = router;
