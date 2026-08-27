const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Employee = require("../models/Employee");
const { protect } = require("../middleware/authMiddleware");
const { passwordError } = require("../utils/password");

const router = express.Router();

/* =========================================================
   REGISTER ROUTE
========================================================= */

router.post("/register", async (req, res) => {
  try {
    // Public registration is disabled in production unless
    // explicitly enabled through the environment variable.
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_PUBLIC_REGISTRATION !== "true"
    ) {
      return res.status(403).json({
        message:
          "Public registration is disabled. Ask an administrator to create your account.",
      });
    }

    const {
      name,
      email,
      password,
      role = "employee",
    } = req.body;

    // Only employee and receptionist roles can self-register.
    if (!["employee", "receptionist"].includes(role)) {
      return res.status(400).json({
        message:
          "Signup role must be employee or receptionist",
      });
    }

    // Required fields validation
    if (!name || !email || !password) {
      return res.status(400).json({
        message:
          "Name, email, and password are required.",
      });
    }

    // Email validation
    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email.trim()
      )
    ) {
      return res.status(400).json({
        message: "Provide a valid email address",
      });
    }

    // Password validation
    const invalidPassword = passwordError(password);

    if (invalidPassword) {
      return res.status(400).json({
        message: invalidPassword,
      });
    }

    const normalizedEmail = email
      .toLowerCase()
      .trim();

    // Check whether the user already exists
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(400).json({
        message:
          "An account with this email address already exists.",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);

    const hashedPassword = await bcrypt.hash(
      password,
      salt
    );

    let employeeId = null;

    // Create or link employee record
    if (role === "employee") {
      const existingEmployee =
        await Employee.findOne({
          email: normalizedEmail,
        });

      if (existingEmployee) {
        employeeId = existingEmployee._id;
      } else {
        const newEmployee =
          await Employee.create({
            name,
            email: normalizedEmail,
            department: "General",
          });

        employeeId = newEmployee._id;
      }
    }

    // Create user
    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role,
      employee: employeeId,
    });

    return res.status(201).json({
      success: true,
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
    console.error(
      "Registration error:",
      error.message
    );

    return res
      .status(error.code === 11000 ? 409 : 400)
      .json({
        success: false,
        message:
          error.code === 11000
            ? "An account with this email address already exists."
            : error.message ||
              "Registration failed. Please try again.",
      });
  }
});

/* =========================================================
   LOGIN ROUTE
========================================================= */

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Debug: never log the password
    console.log(
      "Login attempt:",
      email
    );

    // Required fields validation
    if (!email || !password) {
      console.log(
        "Login failed: Email or password missing"
      );

      return res.status(400).json({
        success: false,
        message:
          "Email and password are required",
      });
    }

    // Type validation
    if (
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      console.log(
        "Login failed: Invalid data types"
      );

      return res.status(400).json({
        success: false,
        message:
          "Email and password must be text values",
      });
    }

    // Normalize email
    const normalizedEmail = email
      .toLowerCase()
      .trim();

    // Find user
    const user = await User.findOne({
      email: normalizedEmail,
    });

    console.log(
      "User found:",
      !!user
    );

    if (!user) {
      console.log(
        "Login failed: User does not exist"
      );

      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }

    // Check whether the account is active
    if (!user.isActive) {
      console.log(
        "Login failed: Account is inactive"
      );

      return res.status(403).json({
        success: false,
        message:
          "This user account is inactive",
      });
    }

    // Compare password
    const isPasswordCorrect =
      await bcrypt.compare(
        password,
        user.password
      );

    console.log(
      "Password correct:",
      isPasswordCorrect
    );

    if (!isPasswordCorrect) {
      console.log(
        "Login failed: Incorrect password"
      );

      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }

    // Check JWT secret
    if (!process.env.JWT_SECRET) {
      console.error(
        "Login failed: JWT_SECRET is not defined"
      );

      return res.status(500).json({
        success: false,
        message:
          "Server authentication configuration error",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    console.log(
      `Login successful: ${user.email} (${user.role})`
    );

    return res.status(200).json({
      success: true,
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
    console.error(
      "Login error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
});

/* =========================================================
   CURRENT USER ROUTE
========================================================= */

router.get(
  "/me",
  protect,
  (req, res) => {
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  }
);

module.exports = router;
