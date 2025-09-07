// 使用 mammoth 解析 .docx 文档为纯文本
import mammoth from 'mammoth';

class DocxParser {
  async parseDOCX(file) {
    if (!file) return { success: false, error: '文件为空' };
    if (!/\.docx$/i.test(file.name)) {
      return { success: false, error: '仅支持 .docx 文件' };
    }

    try {
      const arrayBuffer = await this.readFileAsArrayBuffer(file);
      const { value } = await mammoth.extractRawText({ arrayBuffer });
      const text = (value || '').trim();
      return {
        success: true,
        text,
        fileName: file.name,
        fileSize: file.size,
        extractedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('DOCX 解析失败:', error);
      return { success: false, error: error.message || 'DOCX 解析失败' };
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

const docxParser = new DocxParser();
export default docxParser;


