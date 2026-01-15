const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const uploadToSupabase = require('../utils/uploadToSupabase');

// POST endpoint for image upload to Supabase
router.post('/image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Image required' });
        }

        const imageUrl = await uploadToSupabase(req.file);

        res.status(201).json({
            success: true,
            message: 'Image uploaded successfully',
            imageUrl,
        });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ message: err.message || 'Upload failed' });
    }
});

module.exports = router;
