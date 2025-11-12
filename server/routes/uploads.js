const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { authenticateUnifiedToken } = require('../middleware/unifiedAuth');

// Optional Jimp import for image compression
let Jimp;
try {
  Jimp = require('jimp');
} catch (err) {
  console.warn('⚠️  Jimp not installed. Image compression will be skipped. Install with: npm install jimp');
  Jimp = null;
}

const ensureDir = (dirPath) => {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (_) {}
};

const qrStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'tenant_qr');
    ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.png';
    const base = 'qr_' + Date.now();
    cb(null, base + ext);
  }
});

const paymentScreenshotStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'payment_screenshots');
    ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    const base = 'payment_' + Date.now() + '_' + Math.round(Math.random() * 1E9);
    cb(null, base + ext);
  }
});

const qrUpload = multer({ 
  storage: qrStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only PNG, JPEG, WEBP allowed'));
    }
    cb(null, true);
  }
});

const paymentScreenshotUpload = multer({ 
  storage: paymentScreenshotStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/jpg'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only PNG, JPEG, WEBP allowed'));
    }
    cb(null, true);
  }
});

// Upload tenant QR image
router.post('/tenant-qr', authenticateUnifiedToken, qrUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const urlPath = `/uploads/tenant_qr/${req.file.filename}`;
    return res.json({ success: true, url: urlPath, filename: req.file.filename });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

// Upload payment screenshot with compression
router.post('/payment-screenshot', authenticateUnifiedToken, paymentScreenshotUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const originalSize = req.file.size;
    
    // Compress image if Jimp is available
    if (Jimp) {
      try {
        // Compress image while maintaining quality
        const image = await Jimp.read(filePath);
        
        // Resize if image is too large (max width 1920px, maintain aspect ratio)
        if (image.bitmap.width > 1920) {
          image.resize(1920, Jimp.AUTO);
        }
        
        // Compress with high quality (85% quality, good balance between size and quality)
        await image.quality(85).writeAsync(filePath);
        
        const newSize = fs.statSync(filePath).size;
        console.log(`Screenshot compressed: ${(originalSize / 1024 / 1024).toFixed(2)}MB -> ${(newSize / 1024 / 1024).toFixed(2)}MB`);
      } catch (compressErr) {
        console.error('Image compression error (continuing with original):', compressErr);
        // Continue with original file if compression fails
      }
    } else {
      console.log('⚠️  Image compression skipped (Jimp not installed). Original file size:', (originalSize / 1024 / 1024).toFixed(2), 'MB');
    }

    const urlPath = `/uploads/payment_screenshots/${req.file.filename}`;
    return res.json({ success: true, url: urlPath, filename: req.file.filename });
  } catch (err) {
    console.error('Payment screenshot upload error:', err);
    if (err.message && err.message.includes('Only PNG, JPEG, WEBP allowed')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

module.exports = router;


