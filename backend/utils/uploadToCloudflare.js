const axios = require("axios");
const FormData = require("form-data");

const uploadToCloudflare = async (file) => {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error(
      "Cloudflare credentials (CF_ACCOUNT_ID / CF_API_TOKEN) are required"
    );
  }

  const form = new FormData();
  form.append("file", file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype,
  });

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`;

  const headers = {
    Authorization: `Bearer ${apiToken}`,
    ...form.getHeaders(),
  };

  try {
    const resp = await axios.post(url, form, { headers });

    if (!resp || !resp.data) throw new Error("Empty response from Cloudflare");
    if (!resp.data.success)
      throw new Error("Cloudflare upload failed: " + JSON.stringify(resp.data));

    // Cloudflare Images returns delivery URLs in result.variants
    const variants = resp.data.result && resp.data.result.variants;
    if (variants && variants.length) return variants[0];

    // Fallback: return result object
    return resp.data.result;
  } catch (err) {
    if (err && err.response && err.response.data) {
      console.error(
        "Cloudflare upload error response:",
        JSON.stringify(err.response.data, null, 2)
      );
      throw new Error(
        "Cloudflare upload failed: " + JSON.stringify(err.response.data)
      );
    }

    console.error(
      "Cloudflare upload error:",
      err && err.message ? err.message : err
    );
    throw err;
  }
};

module.exports = uploadToCloudflare;
