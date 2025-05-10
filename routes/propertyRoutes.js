const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const Property = require("../models/Property");

const router = express.Router();

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized: No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret", (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: "Invalid token: " + err.message });
    }
    req.user = user;
    next();
  });
};

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// Fetch Properties API (Supports Home & Hostel Filters)
router.get("/", authenticateToken, async (req, res) => {
  try {
    let { location, type } = req.query;
    let query = {};

    if (location) {
      query.location = { $regex: location.trim(), $options: "i" };
    }

    if (type && ["home", "hostel"].includes(type.toLowerCase())) {
      query.type = type.toLowerCase();
    }

    const properties = await Property.find(query);

    if (!properties.length) {
      return res.status(404).json({ success: false, message: "No properties found." });
    }

    res.json({ success: true, properties });
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// Upload Property API (Supports Home & Hostel Fields)
router.post("/add", authenticateToken, upload.array("images", 5), async (req, res) => {
  try {
    let {
      title,
      location,
      price,
      type,
      ownerName,
      ownerContact,
      facing,
      floor,
      carpetArea,
      sharedBy,
      facilities,
      parking,
    } = req.body;

    const parsedParking = parking ? JSON.parse(parking) : { car: false, bike: false };
    const parsedFacilities = facilities
      ? JSON.parse(facilities)
      : { food: false, wifi: false, transport: false, laundry: false };

    const imagePaths = req.files.map((file) => "/uploads/" + file.filename);

    let propertyData = {
      title,
      location,
      price,
      type,
      owner: { name: ownerName, contact: ownerContact },
      images: imagePaths,
      createdBy: req.user.id,
    };

    if (type === "home") {
      propertyData.homeDetails = {
        facing,
        floor,
        carpetArea,
        parking: parsedParking,
      };
    } else if (type === "hostel") {
      propertyData.hostelDetails = {
        sharedBy,
        facilities: parsedFacilities,
      };
    }

    const property = new Property(propertyData);
    await property.save();

    res.json({ success: true, message: "Property uploaded successfully!", property });
  } catch (error) {
    console.error("Error saving property:", error);
    res.status(500).json({ success: false, message: "Error saving property data: " + error.message });
  }
});

// Delete Property API (Deletes Images Too)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    property.images.forEach((imagePath) => {
      const fullPath = path.join(__dirname, "..", imagePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });

    await Property.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Property deleted successfully!" });
  } catch (error) {
    console.error("Error deleting property:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// Get All Properties
router.get("/properties", authenticateToken, async (req, res) => {
  try {
    const properties = await Property.find();
    res.json(properties);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;