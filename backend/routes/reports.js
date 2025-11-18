// backend/routes/reports.js
const express = require('express');
const router = express.Router();
const Order = require('../models/Order'); // adjust path if your Order model path differs

// GET /api/reports
// Optional query params:
//   from=YYYY-MM-DD
//   to=YYYY-MM-DD
// Example: /api/reports?from=2025-01-01&to=2025-01-31
router.get('/', async (req, res) => {
  try {
    let { from, to } = req.query;
    const match = { status: "completed" };   // ONLY completed orders


    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate)) match.createdAt = { $gte: fromDate };
    }
    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate)) {
        toDate.setHours(23,59,59,999);
        match.createdAt = match.createdAt || {};
        match.createdAt.$lte = toDate;
      }
    }

    // If you only want "completed" or "paid" orders, uncomment and adjust:
    // match.status = 'paid';

    // 1) total revenue & order count
    const totalPipeline = [
      { $match: match },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $toDouble: "$total" } },
          ordersCount: { $sum: 1 }
        }
      }
    ];

    const totalRes = await Order.aggregate(totalPipeline);
    const totals = totalRes[0] || { totalRevenue: 0, ordersCount: 0 };

    // 2) revenue by day
    const byDayPipeline = [
      { $match: match },
      {
        $project: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $toDouble: "$total" }
        }
      },
      {
        $group: {
          _id: "$day",
          total: { $sum: "$total" },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];
    const byDay = await Order.aggregate(byDayPipeline);

    // 3) breakdown by item (if your orders have items array with { _id, name, qty, price })
    let byItem = [];
    try {
      const byItemPipeline = [
        { $match: match },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items._id",
            name: { $first: "$items.name" },
            qtySold: { $sum: { $toInt: "$items.qty" } },
            revenue: { $sum: { $multiply: [{ $toDouble: "$items.qty" }, { $toDouble: "$items.price" }] } }
          }
        },
        { $sort: { revenue: -1 } }
      ];
      byItem = await Order.aggregate(byItemPipeline);
    } catch (err) {
      // If your Order schema differs (e.g., items stored differently), skip this section
      console.warn("byItem aggregation skipped:", err && err.message);
    }

    return res.json({
      totalRevenue: Number(totals.totalRevenue || 0),
      ordersCount: totals.ordersCount || 0,
      byDay,
      byItem
    });
  } catch (err) {
    console.error("GET /api/reports error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
