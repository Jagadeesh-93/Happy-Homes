const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/User");

const router = express.Router();

// ✅ Updated Register Route with Username Field
router.post("/register", async (req, res) => {
    try {
        const { username, firstName, lastName, email, password } = req.body;

        // Check if username or email already exists
        const existingUser = await User.findOne({ username });
        const existingEmail = await User.findOne({ email });

        if (existingUser) return res.status(400).json({ message: "Username already taken!" });
        if (existingEmail) return res.status(400).json({ message: "Email already registered!" });

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Save user to DB
        const newUser = new User({ username, firstName, lastName, email, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ message: "User registered successfully!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
