// routes/owner.js
const express = require("express");
const bcrypt = require("bcryptjs");
const Owner = require("../models/Owner");
const router = express.Router();

/* =====================================================
   CREATE OWNER  (Only run once)
   POST /api/owner
===================================================== */
router.post("/", async (req, res) => {
  try {
    const { username, password, age } = req.body;

    const exists = await Owner.findOne({ username });
    if (exists) return res.status(400).json({ ok: false, message: "Owner already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const owner = new Owner({
      username,
      password: hashed,
      age
    });

    await owner.save();
    res.json({ ok: true, message: "Owner created", owner });

  } catch (err) {
    console.error("Create owner:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

/* =====================================================
   LOGIN  (Age + Password)
   POST /api/owner/login
===================================================== */
router.post("/login", async (req, res) => {
  try {
    const { age, password } = req.body;

    // find owner
    const owner = await Owner.findOne({ username: "owner" });
    if (!owner) return res.status(404).json({ ok: false, message: "Owner not found" });

    // check AGE
    if (owner.age && Number(age) !== Number(owner.age)) {
      return res.status(401).json({ ok: false, message: "Age does not match" });
    }

    // check PASSWORD
    const match = await bcrypt.compare(String(password), String(owner.password));
    if (!match) return res.status(401).json({ ok: false, message: "Incorrect password" });

    // success
    return res.json({ ok: true, message: "Login successful" });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

/* =====================================================
   UPDATE AGE + PASSWORD
   PUT /api/owner/update
===================================================== */
router.put("/update", async (req, res) => {
  try {
    const { age, password } = req.body;

    const owner = await Owner.findOne({ username: "owner" });
    if (!owner) return res.status(404).json({ ok: false, message: "Owner not found" });

    // update age
    if (age) owner.age = age;

    // update password (hash)
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      owner.password = hashed;
    }

    await owner.save();
    res.json({ ok: true, message: "Owner updated successfully" });

  } catch (err) {
    console.error("Update owner:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

/* =====================================================
   GET OWNER INFO (Used by Dashboard)
   GET /api/owner/info
===================================================== */
router.get("/info", async (req, res) => {
  try {
    const owner = await Owner.findOne({ username: "owner" }, { password: 0 }); // hide password
    if (!owner) return res.json({ exists: false });

    res.json({ exists: true, owner });
  } catch (err) {
    console.error("info error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

module.exports = router;
