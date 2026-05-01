const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const fetch = require("node-fetch");

async function importProducts() {
  try {
    const filePath = "d:\\tally\\Quotations\\products_import_filled (1).xlsx";
    const fileStream = fs.createReadStream(filePath);

    const formData = new FormData();
    formData.append("file", fileStream);

    console.log("Uploading file...");
    const importRes = await fetch("http://localhost:4003/api/import/products", {
      method: "POST",
      body: formData,
      headers: formData.getHeaders(),
    });

    const importData = await importRes.json();
    console.log("Import Response:", JSON.stringify(importData, null, 2));
  } catch (e) {
    console.error("Error during import:", e);
  }
}

importProducts();
