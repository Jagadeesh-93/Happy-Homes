// models/Property.js
const mongoose = require("mongoose");

const PropertySchema = new mongoose.Schema({
  title: { type: String, required: true },
  price: { type: Number, required: true },
  location: { type: String, required: true },
  type: { type: String, enum: ["home", "hostel"], required: true }, // Home or Hostel

  owner: {
    name: { type: String, required: true },
    contact: { type: String, required: true },
  },

  images: [{ type: String }], // Array of image URLs

  // 🏡 Home-Specific Fields
  homeDetails: {
    propertyType: { type: String }, // Apartment, Villa, etc.
    facing: { type: String },
    floor: { type: String },
    carpetArea: { type: String },
    parking: {
      car: { type: Boolean, default: false },
      bike: { type: Boolean, default: false },
    },
  },

  // 🏠 Hostel-Specific Fields
  hostelDetails: {
    sharedBy: { type: String, enum: ["1", "2", "3", "4+"] }, // Dropdown selection
    facilities: {
      food: { type: Boolean, default: false },
      wifi: { type: Boolean, default: false },
      transport: { type: Boolean, default: false },
      laundry: { type: Boolean, default: false },
    },
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Property", PropertySchema);