import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputFilePath = path.join(__dirname, '../Population Both sex.xlsx');
const outputFilePath = path.join(__dirname, 'public/data/population-bar.json');

try {
    console.log(`Reading file: ${inputFilePath}`);
    const workbook = XLSX.readFile(inputFilePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Get headers
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
        throw new Error("No data found in Excel file");
    }

    const transformedData = [];
    const yearRegex = /^\d{4}$/; // Matches 4-digit years

    jsonData.forEach(row => {
        const country = row['Country English'];
        if (!country) return;

        Object.keys(row).forEach(key => {
            // Check if the key is a year (either number or string matching year pattern)
            // The inspection showed keys might be numbers like 1950, or strings "1950"
            if (key !== 'Country English') {
                const value = row[key];
                // Ensure value is a number
                const numericValue = parseFloat(value);

                if (!isNaN(numericValue)) {
                    transformedData.push({
                        category: country,
                        value: numericValue,
                        series: String(key) // Ensure series is a string like "1950"
                    });
                }
            }
        });
    });

    // Ensure directory exists
    const outputDir = path.dirname(outputFilePath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputFilePath, JSON.stringify(transformedData, null, 2));
    console.log(`Successfully created JSON file at: ${outputFilePath}`);
    console.log(`Total records: ${transformedData.length}`);

    if (transformedData.length > 0) {
        console.log("Sample record:", transformedData[0]);
    }

} catch (e) {
    console.error("Error converting Excel to JSON:");
    console.error(e);
}
