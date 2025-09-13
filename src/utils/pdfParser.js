/**
 * PDF解析工具
 * 用于解析PDF文件并提取文本内容
 * 使用CDN方式加载PDF.js，避免webpack chunk问题
 */

class PDFParser {
  constructor() {
    this.isInitialized = false;
    this.pdfjsLib = null;
  }

  /**
   * 初始化PDF解析器
   */
  async initialize() {
    try {
      // 检查是否在浏览器环境中
      if (typeof window === 'undefined') {
        throw new Error('PDF解析器需要在浏览器环境中运行');
      }
      
      // 检查是否已经加载了PDF.js
      if (window.pdfjsLib) {
        this.pdfjsLib = window.pdfjsLib;
        this.isInitialized = true;
        console.log('✅ PDF解析器已存在，直接使用');
        return;
      }
      
      // 从CDN加载PDF.js
      await this.loadPDFJSFromCDN();
      
      this.isInitialized = true;
      console.log('✅ PDF解析器初始化成功');
    } catch (error) {
      console.error('❌ PDF解析器初始化失败:', error);
      throw new Error('PDF解析器初始化失败: ' + error.message);
    }
  }

  /**
   * 从CDN加载PDF.js
   */
  async loadPDFJSFromCDN() {
    return new Promise((resolve, reject) => {
      // 检查是否已经加载
      if (window.pdfjsLib) {
        this.pdfjsLib = window.pdfjsLib;
        resolve();
        return;
      }

      // 创建script标签加载PDF.js - 使用本地文件
      const script = document.createElement('script');
      script.src = '/pdf.min.js';
      script.onload = () => {
        try {
          // 设置worker路径 - 统一使用本地worker文件
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
          
          this.pdfjsLib = window.pdfjsLib;
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      script.onerror = () => {
        reject(new Error('无法加载本地PDF.js文件'));
      };
      
      document.head.appendChild(script);
    });
  }

  /**
   * 解析PDF文件
   * @param {File} file - PDF文件对象
   * @returns {Promise<Object>} 解析结果
   */
  async parsePDF(file) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log(`开始解析PDF文件: ${file.name}`);
      
      // 验证文件类型
      if (file.type !== 'application/pdf') {
        throw new Error('文件类型必须是PDF');
      }

      // 验证文件大小 (限制为10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new Error('PDF文件大小不能超过10MB');
      }

      // 读取文件内容
      const arrayBuffer = await this.readFileAsArrayBuffer(file);
      
      // 使用pdfjs-dist解析PDF
      const pdf = await this.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      
      let fullText = '';
      const pageTexts = [];
      
      // 逐页提取文本
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // 提取页面文本
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ');
        
        pageTexts.push(pageText);
        fullText += pageText + '\n';
      }
      
      // 获取PDF信息
      const info = await pdf.getMetadata();
      const pdfInfo = info.info || {};
      
      console.log(`✅ PDF解析成功: ${numPages}页, ${fullText.length}字符`);
      
      return {
        success: true,
        text: fullText,
        numPages: numPages,
        info: pdfInfo,
        fileName: file.name,
        fileSize: file.size,
        extractedAt: new Date().toISOString(),
        pageTexts: pageTexts
      };
      
    } catch (error) {
      console.error('❌ PDF解析失败:', error);
      return {
        success: false,
        error: error.message,
        fileName: file.name
      };
    }
  }

  /**
   * 将文件读取为ArrayBuffer
   * @param {File} file - 文件对象
   * @returns {Promise<ArrayBuffer>} ArrayBuffer
   */
  readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        resolve(event.target.result);
      };
      
      reader.onerror = (error) => {
        reject(new Error('文件读取失败: ' + error.message));
      };
      
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * 清理和格式化提取的文本
   * @param {string} text - 原始文本
   * @returns {string} 清理后的文本
   */
  cleanText(text) {
    if (!text) return '';
    
    return text
      // 移除多余的空白字符
      .replace(/\s+/g, ' ')
      // 移除多余的换行符
      .replace(/\n\s*\n/g, '\n\n')
      // 移除页眉页脚等重复内容
      .replace(/第\s*\d+\s*页/g, '')
      .replace(/Page\s*\d+/gi, '')
      // 移除特殊字符
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, '')
      // 移除多余的标点符号
      .replace(/[。]{2,}/g, '。')
      .replace(/[.]{2,}/g, '.')
      // 修剪首尾空白
      .trim();
  }

  /**
   * 将文本分块处理
   * @param {string} text - 文本内容
   * @param {number} chunkSize - 每块大小
   * @param {number} overlap - 重叠大小
   * @returns {Array<string>} 文本块数组
   */
  chunkText(text, chunkSize = 1000, overlap = 200) {
    if (!text) return [];
    
    const chunks = [];
    let start = 0;
    
    while (start < text.length) {
      let end = start + chunkSize;
      
      // 尝试在句号或换行符处分割
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('。', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const lastDot = text.lastIndexOf('.', end);
        
        const splitPoint = Math.max(lastPeriod, lastNewline, lastDot);
        if (splitPoint > start + chunkSize * 0.5) {
          end = splitPoint + 1;
        }
      }
      
      const chunk = text.slice(start, end).trim();
      if (chunk) {
        chunks.push(chunk);
      }
      
      start = end - overlap;
    }
    
    return chunks;
  }

  /**
   * 提取PDF元数据
   * @param {Object} info - PDF信息对象
   * @returns {Object} 元数据
   */
  extractMetadata(info) {
    if (!info) return {};
    
    return {
      title: info.Title || '',
      author: info.Author || '',
      subject: info.Subject || '',
      creator: info.Creator || '',
      producer: info.Producer || '',
      creationDate: info.CreationDate || '',
      modificationDate: info.ModDate || '',
      keywords: info.Keywords || ''
    };
  }
}

// 创建单例实例
const pdfParser = new PDFParser();

export default pdfParser;
