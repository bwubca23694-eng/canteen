// backend/routes/upload.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('cloudinary').v2;

// configure cloudinary using env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Accept BOTH field names: "image" and "file"
router.post('/', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'file', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log("Incoming fields:", Object.keys(req.files || {}));

    const filesObj = req.files || {};
    const fileArr = filesObj.image || filesObj.file;

    if (!fileArr || !fileArr.length) {
      return res.status(400).json({ message: 'No file uploaded. Use either "image" or "file".' });
    }

    const file = fileArr[0];

    // Upload to Cloudinary
    const streamUpload = buffer => new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'canteen_items' },
        (error, result) => error ? reject(error) : resolve(result)
      );
      streamifier.createReadStream(buffer).pipe(stream);
    });

    const result = await streamUpload(file.buffer);

    return res.json({
      url: result.secure_url,
      raw: result,
      public_id: result.public_id
    });

  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: 'Upload failed', error: err.message });
  }
});

module.exports = router;
