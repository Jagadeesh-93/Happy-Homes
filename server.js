require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const userRoutes = require("./routes/userRoutes");
const propertyRoutes = require("./routes/propertyRoutes");
const User = require("./models/User"); // Import the User model

const app = express();
app.use(express.json());

// Enable CORS
const allowedOrigins = [
  "http://localhost:3000", // For local development
  "https://happy-homes-frontend.onrender.com", // Your actual frontend Render URL
];
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};
app.use(cors(corsOptions));

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

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "Backend is running" });
});

// Endpoint to check username availability
app.post("/api/users/check-username", async (req, res) => {
  const { username } = req.body;

  // Validate input
  if (!username) {
    return res.status(400).json({ message: "Username is required" });
  }

  try {
    // Check if username already exists in the database
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

app.use("/api", userRoutes);
app.use("/api/properties", propertyRoutes);

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));