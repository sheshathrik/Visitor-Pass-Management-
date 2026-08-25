const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Employee = require("../models/Employee");
const { protect } = require("../middleware/authMiddleware");
const { passwordError } = require("../utils/password");

const router = express.Router();

// ==========================================
// REGISTER ROUTE
// ==========================================
router.post("/register", async (req, res) => {
  try {
    // Accounts with access to an organisation's visitor records should be
    // provisioned by an administrator. Public registration is opt-in for
    // development/demo deployments only.
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_PUBLIC_REGISTRATION !== "true") {
      return res.status(403).json({
        message: "Public registration is disabled. Ask an administrator to create your account.",
      });
    }

    const { name, email, password, role = "employee" } = req.body;
    // Self-registration is deliberately limited to operational roles. An
    // administrator can only be created through the protected user API.
    if (!['employee', 'receptionist'].includes(role)) {
      return res.status(400).json({
        message: "Signup role must be employee or receptionist",
      });
    }

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email, and password are required.",
      });
    }

    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ message: "Provide a valid email address" });
    }
    const invalidPassword = passwordError(password);
    if (invalidPassword) return res.status(400).json({ message: invalidPassword });

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        message: "An account with this email address already exists.",
      });
    }

    // 2. Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    let employeeId = null;

    // 3. Handle Employee Linking/Creation safely
    if (role === "employee") {
      let existingEmp = await Employee.findOne({ email: normalizedEmail });

      if (existingEmp) {
        employeeId = existingEmp._id;
      } else {
        const newEmployee = await Employee.create({
          name,
          email: normalizedEmail,
          department: "General",
        });
        employeeId = newEmployee._id;
      }
    }

    // 4. Create User
    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role,
      employee: employeeId,
    });

    res.status(201).json({
      message: "Registration successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        employee: user.employee,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(error.code === 11000 ? 409 : 400).json({
      message: error.code === 11000 ? "An account with this email address already exists." : error.message || "Registration failed. Please try again.",
    });
  }
});

// ==========================================
// LOGIN ROUTE
// ==========================================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "Email and password must be text values" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "This user account is inactive",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        employee: user.employee,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Login failed",
      error: error.message,
    });
  }
});

// ==========================================
// ME ROUTE
// ==========================================
router.get("/me", protect, (req, res) => {
  res.json({
    user: req.user,
  });
});

module.exports = router;
