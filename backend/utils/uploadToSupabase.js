const crypto = require("crypto");
const supabase = require("../config/supabase");

const uploadToSupabase = async (file) => {
    const fileName = `uploads/${crypto.randomUUID()}-${file.originalname}`;

    const { error } = await supabase.storage
        .from("images")
        .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
        });

    if (error) throw error;

    const { data } = supabase.storage
        .from("images")
        .getPublicUrl(fileName);

    return data.publicUrl;
};

module.exports = uploadToSupabase;
