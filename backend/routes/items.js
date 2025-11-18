// backend/routes/items.js
const express = require('express');
const router = express.Router();
const Item = require('../models/Item');

/**
 * GET /api/items
 * Customer view: only return items that are available (available: true)
 */
router.get('/', async (req, res) => {
  try {
    const items = await Item.find({ available: true }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error('GET /api/items error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/items/all
 * Owner view: return all items, including unavailable ones
 */
router.get('/all', async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error('GET /api/items/all error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/items
 * Create a new item
 */
router.post('/', async (req, res) => {
  try {
    const { name, price, image, description, available } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ message: 'Name and price are required' });
    }
    const parsedPrice = Number(price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ message: 'Price must be a non-negative number' });
    }

    const item = new Item({
      name: name.trim(),
      price: parsedPrice,
      image: image || null,
      description: description || '',
      available: typeof available === 'boolean' ? available : true
    });

    await item.save();
    return res.status(201).json(item);
  } catch (err) {
    console.error('POST /api/items error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * PATCH /api/items/:id
 * Partial update for an item (price, name, available, etc.)
 */
router.patch('/:id', async (req, res) => {
  try {
    const updates = { ...req.body };

    if (updates.price !== undefined) {
      const p = Number(updates.price);
      if (Number.isNaN(p) || p < 0) return res.status(400).json({ message: 'Invalid price' });
      updates.price = p;
    }

    // Ensure we don't accidentally set fields to undefined
    Object.keys(updates).forEach((k) => {
      if (updates[k] === undefined) delete updates[k];
    });

    const updated = await Item.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!updated) return res.status(404).json({ message: 'Item not found' });
    res.json(updated);
  } catch (err) {
    console.error('PATCH /api/items/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * DELETE /api/items/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Item.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Item not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/items/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
