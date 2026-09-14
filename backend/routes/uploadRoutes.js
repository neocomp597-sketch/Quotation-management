const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const { uploadPdf } = require('../middlewares/upload');
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

// POST endpoint for PDF document uploads (Max 10MB)
router.post('/pdf', uploadPdf.single('file'), async (req, res) => {
    try {
        const file = req.file || (req.files && req.files.file && req.files.file[0]) || (req.files && req.files.pdf && req.files.pdf[0]);
        if (!file) {
            return res.status(400).json({ message: 'PDF file required' });
        }

        const fileUrl = await uploadToSupabase(file);

        res.status(201).json({
            success: true,
            message: 'PDF document uploaded successfully',
            url: fileUrl,
            fileUrl,
            imageUrl: fileUrl
        });
    } catch (err) {
        console.error('PDF upload error:', err);
        res.status(500).json({ message: err.message || 'PDF upload failed' });
    }
});

module.exports = router;
