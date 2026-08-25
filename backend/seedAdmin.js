const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("./models/User");

// This is intentionally a one-time bootstrap, never a reset. Production
// instances must not recreate a known administrator password on each start.
const bootstrapAdmin = async () => {
  try {
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

    if (!email || !password) {
      console.log("Admin bootstrap skipped: BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are not set");
      return { created: false, reason: "not_configured" };
    }
    if (password.length < 8) {
      throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters");
    }

    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      console.log("Admin bootstrap skipped: account already exists");
      return { created: false, reason: "already_exists" };
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await User.create({
      name: process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "System Administrator",
      email,
      password: hashedPassword,
      role: "admin",
    });

    console.log("Initial administrator account created");
    return { created: true };
  } catch (error) {
    console.error("Could not bootstrap administrator:", error.message);
    throw error;
  }
};

module.exports = bootstrapAdmin;
