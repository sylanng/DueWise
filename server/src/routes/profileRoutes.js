
const express = require('express');
const multer = require('multer');

const verifyToken = require('../middleware/authMiddleware');
const {
  uploadProfilePicture,
} = require('../controllers/profileController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error('Only JPG, PNG, and WebP images are allowed.')
      );
    }

    callback(null, true);
  },
});

router.use(verifyToken);

router.post(
  '/picture',
  upload.single('profilePicture'),
  uploadProfilePicture
);

module.exports = router;
