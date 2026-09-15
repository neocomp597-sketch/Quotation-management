const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const { uploadPdf } = require('../middlewares/upload');
const uploadToSupabase = require('../utils/uploadToSupabase');

// POST endpoint for image upload to Supabase
router.post('/image', (req, res, next) => {
    upload.single('image')(req, res, async (err) => {
        if (err) {
            console.error('Multer image upload error:', err);
            return res.status(400).json({ message: err.message || 'Image upload failed' });
        }
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'Image required' });
            }

            const imageUrl = await uploadToSupabase(req.file);

            return res.status(201).json({
                success: true,
                message: 'Image uploaded successfully',
                imageUrl,
            });
        } catch (uploadErr) {
            console.error('Upload error:', uploadErr);
            return res.status(500).json({ message: uploadErr.message || 'Upload failed' });
        }
    });
});

// POST endpoint for PDF document uploads (Max 10MB)
router.post('/pdf', (req, res, next) => {
    uploadPdf.single('file')(req, res, async (err) => {
        if (err) {
            console.error('Multer PDF upload error:', err);
            return res.status(400).json({ message: err.message || 'PDF upload failed' });
        }
        try {
            const file = req.file || (req.files && req.files.file && req.files.file[0]) || (req.files && req.files.pdf && req.files.pdf[0]);
            if (!file) {
                return res.status(400).json({ message: 'PDF file required' });
            }

            const fileUrl = await uploadToSupabase(file);

            return res.status(201).json({
                success: true,
                message: 'PDF document uploaded successfully',
                url: fileUrl,
                fileUrl,
                imageUrl: fileUrl
            });
        } catch (uploadErr) {
            console.error('PDF upload error:', uploadErr);
            return res.status(500).json({ message: uploadErr.message || 'PDF upload failed' });
        }
    });
});

// GET endpoint to view uploaded files inline
router.get('/file/*', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    try {
        const fileRelativePath = req.params[0] || '';
        const cleanPath = fileRelativePath.replace(/^.*\/uploads\//i, '').replace(/\\/g, '/');
        
        const candidatePaths = [
            path.join(__dirname, '../public/uploads', cleanPath),
            path.join(__dirname, '../uploads', cleanPath),
            path.join(__dirname, '../public', cleanPath)
        ];

        let foundPath = null;
        for (const p of candidatePaths) {
            if (fs.existsSync(p) && fs.statSync(p).isFile()) {
                foundPath = p;
                break;
            }
        }

        if (!foundPath) {
            return res.status(404).json({ message: 'File not found on server' });
        }

        const ext = path.extname(foundPath).toLowerCase();
        if (ext === '.pdf') {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline');
        }

        res.sendFile(path.resolve(foundPath));
    } catch (err) {
        console.error('Error serving file:', err);
        res.status(500).json({ message: 'Error opening file' });
    }
});

module.exports = router;
