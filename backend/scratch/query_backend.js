const http = require('http');

function getUrl(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: data
                });
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function run() {
    try {
        console.log("Checking categories...");
        const resCat = await getUrl('http://localhost:4003/api/csm/masters/categories');
        console.log("Categories Status:", resCat.statusCode);
        console.log("Categories Data snippet:", resCat.data.slice(0, 100));

        console.log("\nChecking engineers...");
        const resEng = await getUrl('http://localhost:4003/api/csm/masters/engineers');
        console.log("Engineers Status:", resEng.statusCode);
        console.log("Engineers Data snippet:", resEng.data.slice(0, 100));

    } catch (e) {
        console.error("Request failed:", e);
    }
}

run();
