// 使用 xlsx 解析表格文件 (.xlsx/.xls/.csv) 为文本
import * as XLSX from 'xlsx';

class SpreadsheetParser {
  async parse(file) {
    if (!file) return { success: false, error: '文件为空' };
    const name = file.name.toLowerCase();
    if (!(/\.xlsx$/.test(name) || /\.xls$/.test(name) || /\.csv$/.test(name))) {
      return { success: false, error: '仅支持 .xlsx/.xls/.csv 文件' };
    }

    try {
      const arrayBuffer = await this.readFileAsArrayBuffer(file);
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetNames = workbook.SheetNames || [];
      let mergedText = '';

      sheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        mergedText += `\n# Sheet: ${sheetName}\n` + csv;
      });

      const text = mergedText.trim();
      return {
        success: true,
        text,
        fileName: file.name,
        fileSize: file.size,
        extractedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('表格解析失败:', error);
      return { success: false, error: error.message || '表格解析失败' };
    }
  }

  readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
      reader.readAsArrayBuffer(file);
    });
  }
}

const spreadsheetParser = new SpreadsheetParser();
export default spreadsheetParser;


