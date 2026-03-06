import fs from 'fs';

try {
    const rawData = fs.readFileSync('cookies.json', 'utf-8');
    const parsedData = JSON.parse(rawData);

    // If it's already an array, it's correct Playwright format
    if (Array.isArray(parsedData)) {
        console.log('✅ Cookies already in array format.');
        process.exit(0);
    }

    // hotcleaner specific format
    if (parsedData.data) {
        console.log('🔄 Detected "hotcleaner" encrypted/custom format. Cannot parse this natively for Playwright directly as it requires raw unencrypted name/value pairs.');
        process.exit(1);
    }
} catch (e) {
    console.error('Error reading cookies:', e);
}
