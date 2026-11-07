const multer = require('multer');

// Memory storage keeps file buffer in memory so we can upload directly to Cloudflare R2 or local disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedMime.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, PNG, and WebP image formats are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 6 * 1024 * 1024 // 6MB limit per photo
    },
    fileFilter: fileFilter
});

module.exports = upload;
