// 使用 FileReader 读取 .txt 或通用文本为字符串
class TextParser {
  async parse(file) {
    if (!file) return { success: false, error: '文件为空' };
    if (!/\.txt$/i.test(file.name)) {
      // 仍允许尝试作为文本读取
      // return { success: false, error: '仅支持 .txt 文件' };
    }

    try {
      const text = await this.readFileAsText(file);
      return {
        success: true,
        text: text || '',
        fileName: file.name,
        fileSize: file.size,
        extractedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('文本读取失败:', error);
      return { success: false, error: error.message || '文本读取失败' };
    }
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
      reader.readAsText(file);
    });
  }
}

const textParser = new TextParser();
export default textParser;


