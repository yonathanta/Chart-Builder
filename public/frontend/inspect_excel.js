import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '../Population Both sex.xlsx');

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    // Get headers and first few rows
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log("Sheet Name:", sheetName);
    if (data.length > 0) {
        console.log("Columns:", data[0]);
        console.log("First 5 rows of data:");
        data.slice(1, 6).forEach(row => console.log(row));
    }
} catch (e) {
    console.error("Error reading Excel:");
    console.error(e);
    if (e.stack) console.error(e.stack);
}
