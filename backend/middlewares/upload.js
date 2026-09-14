const multer = require("multer");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        if (!allowed.includes(file.mimetype)) {
            return cb(new Error("Only images allowed"), false);
        }
        cb(null, true);
    },
});

const uploadPdf = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
        const mime = (file.mimetype || "").toLowerCase();
        const originalName = String(file.originalname || "").toLowerCase().trim();
        const isPdfType = mime.includes("pdf") || mime.includes("octet") || mime.includes("stream") || mime.includes("download") || mime.includes("binary") || mime.includes("application") || !mime;
        const isPdfExt = originalName.endsWith(".pdf") || originalName.includes(".pdf");
        if (!isPdfType && !isPdfExt) {
            return cb(new Error("Only PDF files are allowed"), false);
        }
        cb(null, true);
    },
});

module.exports = upload;
module.exports.uploadPdf = uploadPdf;
