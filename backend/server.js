// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

// routes (adjust require paths if your structure differs)
const itemsRouter = require('./routes/items');
const uploadRouter = require('./routes/upload');
const tablesRouter = require('./routes/tables');
const ordersRouter = require('./routes/orders');
const paymentQrRouter = require('./routes/paymentQr'); // if exists
const reportsRouter = require('./routes/reports');     // NEW
const ownerRoutes = require("./routes/owner");







const app = express();
const PORT = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json({ limit: '8mb' })); // body parser for JSON
app.use(express.urlencoded({ extended: true }));  // parse URL-encoded (forms)

// serve uploaded local files if you use local uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// mount routes
app.use('/api/items', itemsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/tables', tablesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/payment-qr', paymentQrRouter);
app.use('/api/reports', reportsRouter);
app.use("/api/owner", ownerRoutes);


app.get('/', (req, res) => res.send('Backend running'));

// connect to mongodb & start
async function start() {
  try {
    const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!MONGO_URI) throw new Error('MONGO_URI not set in env');
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
