const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Employee = require("../models/Employee");
const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();
const mongoose = require("mongoose");
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const { passwordError } = require("../utils/password");

// Admin: create a user account
router.post("/", protect, allowRoles("admin"), async (req, res) => {
  try {
    const { name, email, password, role, employeeId } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: "Name, email, password, and role are required",
      });
    }

    if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim()) || email.length > 254) {
      return res.status(400).json({ message: "Provide a valid email address" });
    }
    const invalidPassword = passwordError(password);
    if (invalidPassword) return res.status(400).json({ message: invalidPassword });

    if (!["admin", "receptionist", "employee"].includes(role)) {
      return res.status(400).json({
        message: "Role must be admin, receptionist, or employee",
      });
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return res.status(400).json({
        message: "A user with this email already exists",
      });
    }

    let employee = null;

    if (role === "employee") {
      if (!employeeId) {
        return res.status(400).json({
          message: "An employee account requires an employeeId",
        });
      }

      if (!mongoose.isValidObjectId(employeeId)) {
        return res.status(400).json({ message: "employeeId is invalid" });
      }

      employee = await Employee.findById(employeeId);

      if (!employee || !employee.isActive) {
        return res.status(404).json({
          message: "Active employee not found",
        });
      }

      const employeeAlreadyLinked = await User.findOne({
        employee: employeeId,
      });

      if (employeeAlreadyLinked) {
        return res.status(400).json({
          message: "This employee already has a user account",
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      employee: employee ? employee._id : null,
    });

    res.status(201).json({
      message: "User account created successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        employee: user.employee,
      },
    });
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 500).json({
      message: error.code === 11000 ? "A user with this email already exists" : "Could not create user account",
      error: error.code === 11000 ? null : error.message,
    });
  }
});

// Admin: view all user accounts
router.get("/", protect, allowRoles("admin"), async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .populate("employee", "name department designation")
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    res.status(500).json({
      message: "Could not fetch user accounts",
      error: error.message,
    });
  }
});

// Admin: activate or deactivate a user account
router.patch("/:id/status", protect, allowRoles("admin"), async (req, res) => {
  try {
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        message: "isActive must be true or false",
      });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "User id is invalid" });
    }

    // Prevent the currently logged-in Admin from deactivating themselves.
    if (req.user._id.toString() === req.params.id && isActive === false) {
      return res.status(400).json({
        message: "You cannot deactivate your own account",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User account not found",
      });
    }

    res.json({
      message: `User account ${
        isActive ? "activated" : "deactivated"
      } successfully`,
      user,
    });
  } catch (error) {
    res.status(500).json({
      message: "Could not update user status",
      error: error.message,
    });
  }
});

module.exports = router;
