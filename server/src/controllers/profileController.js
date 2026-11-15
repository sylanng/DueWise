
const cloudinary = require('../config/cloudinary');
const { getAuth } = require('firebase-admin/auth');

const uploadProfilePicture = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please select an image.',
      });
    }

    const uid = req.user.uid;

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'duewise/profile-pictures',
          public_id: uid,
          overwrite: true,
          resource_type: 'image',
          transformation: [
            { width: 500, height: 500, crop: 'limit' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      stream.end(req.file.buffer);
    });

    await getAuth().updateUser(uid, {
      photoURL: result.secure_url,
    });

    return res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully.',
      data: {
        photoURL: result.secure_url,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadProfilePicture,
};
