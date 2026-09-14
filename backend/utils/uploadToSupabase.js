const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const supabase = require("../config/supabase");

/**
 * Upload file to Supabase Storage with automatic Local Storage fallback
 */
const uploadToSupabase = async (file) => {
    if (!file || !file.buffer) {
        throw new Error("No file content provided");
    }

    const rawExt = path.extname(file.originalname || '');
    const fileExt = rawExt || (file.mimetype?.toLowerCase().includes('pdf') ? '.pdf' : '.png');
    const safeBaseName = path.basename(file.originalname || 'upload', fileExt).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueFileName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeBaseName}${fileExt}`;
    const storagePath = `uploads/${uniqueFileName}`;

    // 1. Try Supabase Storage if configured
    try {
        if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
            const { error } = await supabase.storage
                .from("images")
                .upload(storagePath, file.buffer, {
                    contentType: file.mimetype,
                    upsert: true,
                });

            if (!error) {
                const { data } = supabase.storage
                    .from("images")
                    .getPublicUrl(storagePath);
                if (data?.publicUrl) {
                    return data.publicUrl;
                }
            }
        }
    } catch (supabaseErr) {
        console.warn("Supabase upload failed or not configured, using local storage fallback:", supabaseErr.message);
    }

    // 2. Local Disk Fallback
    const dirsToSave = [
        path.join(__dirname, "../public/uploads"),
        path.join(__dirname, "../uploads")
    ];

    dirsToSave.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(path.join(dir, uniqueFileName), file.buffer);
    });

    return `/uploads/${uniqueFileName}`;
};

module.exports = uploadToSupabase;
