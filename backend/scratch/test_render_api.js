async function test() {
    const url = 'https://quotation-management-2znu.onrender.com/api/customers';
    console.log('Testing GET against:', url);
    try {
        const res = await fetch(url);
        console.log('Status:', res.status);
        console.log('Headers:');
        res.headers.forEach((val, key) => console.log(`  ${key}: ${val}`));
        console.log('Body:', await res.text());
    } catch (err) {
        console.error('Error:', err);
    }
}
test();
