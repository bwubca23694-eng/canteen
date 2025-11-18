// backend/routes/tables.js
const express = require('express');
const router = express.Router();
const Table = require('../models/Table');

// GET /api/tables  - list all tables (owner)
router.get('/', async (req, res) => {
  try {
    const tables = await Table.find().sort({ createdAt: -1 });
    res.json(tables);
  } catch (err) {
    console.error('GET /api/tables', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/tables - create table
router.post('/', async (req, res) => {
  try {
    const { number, link } = req.body;
    if (!number) return res.status(400).json({ message: 'Table number required' });
    const tbl = new Table({ number: String(number).trim(), link: link || "" });
    await tbl.save();
    res.status(201).json(tbl);
  } catch (err) {
    console.error('POST /api/tables', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/tables/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Table.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/tables/:id', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
