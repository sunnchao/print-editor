import { readFile, utils } from 'xlsx';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const filePath = join(__dirname, '调度平台--5月发运信息(1).xlsx');

try {
    const workbook = readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = utils.sheet_to_json(worksheet);
    console.log(JSON.stringify(data, null, 2));
} catch (error) {
    console.error('Error reading Excel file:', error);
}
