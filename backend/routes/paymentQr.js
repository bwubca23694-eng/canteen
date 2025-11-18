// routes/paymentQr.js
const express = require('express');
const router = express.Router();
const PaymentQr = require('../models/PaymentQr');
const cloudinary = require('cloudinary').v2;

/*
 FIXES APPLIED:
 1. Added safe fallback for providerMeta (avoid crashes if null).
 2. Added old Cloudinary QR deletion during UPDATE (PUT) – optional but recommended.
 3. Improved response handling.
*/

//
// GET /api/payment-qr
// Return the most recent QR (by createdAt). 404 if none.
//
router.get('/', async (req, res) => {
  try {
    const qr = await PaymentQr.findOne().sort({ createdAt: -1 }).lean();
    if (!qr) return res.status(404).json({ message: 'No payment QR found' });
    res.json(qr);
  } catch (err) {
    console.error('GET /api/payment-qr error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

//
// POST /api/payment-qr
// Body: { url: string, providerMeta?: object }
// Creates a new entry.
//
router.post('/', async (req, res) => {
  try {
    const { url, providerMeta } = req.body;
    if (!url) return res.status(400).json({ message: 'url is required' });

    const doc = new PaymentQr({
      url,
      providerMeta: providerMeta || {}
    });

    await doc.save();
    res.status(201).json(doc);
  } catch (err) {
    console.error('POST /api/payment-qr error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

//
// PUT /api/payment-qr/:id
// Updates existing QR and deletes old Cloudinary image automatically.
//
router.put('/:id', async (req, res) => {
  try {
    const { url, providerMeta } = req.body;
    if (!url) return res.status(400).json({ message: 'url is required' });

    const existing = await PaymentQr.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Not found' });

    // DELETE OLD CLOUDINARY IMAGE (if exists)
    const oldPublicId =
      existing.providerMeta &&
      existing.providerMeta.public_id;

    if (oldPublicId) {
      try {
        const result = await cloudinary.uploader.destroy(oldPublicId);
        console.log("Old QR removed:", result);
      } catch (err) {
        console.warn("Failed to delete old image:", err?.message);
      }
    }

    // UPDATE DB ENTRY
    existing.url = url;
    existing.providerMeta = providerMeta || {};
    await existing.save();

    res.json(existing);
  } catch (err) {
    console.error('PUT /api/payment-qr/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

//
// DELETE /api/payment-qr/:id
// Deletes DB record + cloudinary asset
//
router.delete('/:id', async (req, res) => {
  try {
    const existing = await PaymentQr.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Not found' });

    const publicId =
      existing.providerMeta &&
      existing.providerMeta.public_id;

    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.warn("Error deleting cloudinary asset:", err?.message);
      }
    }

    await existing.remove();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('DELETE /api/payment-qr/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
