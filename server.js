require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const userRoutes = require("./routes/userRoutes");
const propertyRoutes = require("./routes/propertyRoutes");
const User = require("./models/User");
const Property = require("./models/Property");

const app = express();
app.use(express.json());

// Enable CORS
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://frontend-5s0f.onrender.com",
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));

// Serve Uploaded Images
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));
console.log("📂 Serving images from:", uploadsDir);

// MongoDB Connection
const mongoURI = process.env.MONGO_URI;
if (!mongoURI) {
  throw new Error("MONGO_URI is not defined in environment variables");
}
mongoose
  .connect(mongoURI, { serverSelectionTimeoutMS: 5000 })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err.message));

// Setup Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Middleware to authenticate JWT
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    req.user = decoded; // Attach user data to request
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "Backend is running" });
});

app.post("/api/users/check-username", async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ message: "Username is required" });
  }
  try {
    const user = await User.findOne({ username });
    if (user) {
      return res.status(200).json({ exists: true });
    }
    return res.status(200).json({ exists: false });
  } catch (error) {
    console.error("❌ Error checking username:", error);
    return res.status(500).json({ message: "Server error while checking username" });
  }
});

app.post("/api/register", async (req, res) => {
  const { firstName, lastName, username, email, password } = req.body;
  if (!firstName || !lastName || !username || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }
  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      if (existingUser.username === username) {
        return res.status(400).json({ message: "Username already taken" });
      }
      if (existingUser.email === email) {
        return res.status(400).json({ message: "Email already registered" });
      }
    }
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const newUser = new User({
      firstName,
      lastName,
      username,
      email,
      password: hashedPassword,
    });
    await newUser.save();
    return res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("❌ Error registering user:", error);
    return res.status(500).json({ message: "Server error while registering user" });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: "Invalid username or password" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid username or password" });
    }
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "1h" }
    );
    return res.status(200).json({
      message: "Login successful",
      token,
      user: { username: user.username, email: user.email },
    });
  } catch (error) {
    console.error("❌ Error logging in user:", error);
    return res.status(500).json({ message: "Server error while logging in" });
  }
});

app.get("/api/user/profile", authenticateToken, async (req, res) => {
  try {
    const username = req.user.username; // From JWT
    const dbUser = await User.findOne({ username });
    if (!dbUser) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({
      username: dbUser.username,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
    });
  } catch (error) {
    console.error("❌ Error fetching user profile:", error);
    return res.status(500).json({ message: "Server error while fetching profile" });
  }
});

// Forgot Password - Send Reset Link
app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const resetToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "15m" }
    );
    const resetLink = `https://frontend-5s0f.onrender.com/forgot-password?token=${resetToken}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Password Reset Request",
      text: `Click the following link to reset your password: ${resetLink}\nThis link will expire in 15 minutes.`,
    };
    await transporter.sendMail(mailOptions);
    return res.status(200).json({ message: "Password reset link sent to your email" });
  } catch (error) {
    console.error("❌ Error sending reset link:", error);
    return res.status(500).json({ message: "Server error while sending reset link" });
  }
});

// Reset Password - Using Token from Email
app.post("/api/auth/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ message: "Token and new password are required" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    user.password = hashedPassword;
    await user.save();
    return res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("❌ Error resetting password:", error);
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }
    return res.status(500).json({ message: "Server error while resetting password" });
  }
});

// Change Password - From Profile
app.post("/api/auth/change-password", authenticateToken, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) {
    return res.status(400).json({ message: "New password is required" });
  }
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    user.password = hashedPassword;
    await user.save();
    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("❌ Error changing password:", error);
    return res.status(500).json({ message: "Server error while changing password" });
  }
});

// Property Routes (if propertyRoutes.js is incomplete)
app.post("/api/properties/add", authenticateToken, async (req, res) => {
  try {
    const {
      type,
      title,
      location,
      price,
      ownerName,
      ownerContact,
      facing,
      floor,
      carpetArea,
      parking,
      sharedBy,
      facilities,
    } = req.body;

    const images = req.files?.images
      ? Array.isArray(req.files.images)
        ? req.files.images
        : [req.files.images]
      : [];
    const imagePaths = images.map((file) => file.filename);

    const newProperty = new Property({
      type,
      title,
      location,
      price: Number(price),
      owner: {
        name: ownerName,
        contact: ownerContact,
      },
      facing,
      floor,
      carpetArea,
      parking: parking ? JSON.parse(parking) : { car: false, bike: false },
      sharedBy,
      facilities: facilities ? JSON.parse(facilities) : { food: false, wifi: false, transport: false, laundry: false },
      images: imagePaths,
      createdBy: req.user.id,
    });

    await newProperty.save();
    return res.status(201).json({ message: "Property added successfully" });
  } catch (error) {
    console.error("❌ Error adding property:", error);
    return res.status(500).json({ message: "Server error while adding property" });
  }
});

app.get("/api/properties", authenticateToken, async (req, res) => {
  try {
    const { location, type } = req.query;
    const query = {};
    if (location) query.location = new RegExp(location, "i");
    if (type) query.type = type;

    const properties = await Property.find(query);
    return res.status(200).json({ properties });
  } catch (error) {
    console.error("❌ Error fetching properties:", error);
    return res.status(500).json({ message: "Server error while fetching properties" });
  }
});

app.use("/api", userRoutes);
app.use("/api/properties", propertyRoutes);

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));