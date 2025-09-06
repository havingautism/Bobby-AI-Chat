/**
 * 嵌入服务 - 使用Tauri后端生成高质量向量
 */
class EmbeddingService {
  constructor() {
    this.isTauriEnvironment = this.checkTauriEnvironment();
  }

  checkTauriEnvironment() {
    if (typeof window === 'undefined') return false;
    
    // 检查多种Tauri标识
    const hasTauri = window.__TAURI__ || 
                    window.__TAURI_INTERNALS__ || 
                    window.__TAURI_METADATA__ ||
                    window.navigator?.userAgent?.includes('Tauri') ||
                    Object.keys(window).some(key => key.includes('TAURI'));
    
    console.log('🔍 Tauri环境检测:', {
      __TAURI__: !!window.__TAURI__,
      __TAURI_INTERNALS__: !!window.__TAURI_INTERNALS__,
      __TAURI_METADATA__: !!window.__TAURI_METADATA__,
      userAgent: window.navigator?.userAgent,
      hasTauri: hasTauri
    });
    
    // 即使检测到Tauri，也要测试IPC是否可用
    if (hasTauri) {
      try {
        // 测试IPC是否可用
        if (window.__TAURI__ && window.__TAURI__.invoke) {
          console.log('✅ Tauri IPC可用');
          return true;
        } else {
          console.warn('⚠️ Tauri环境检测到但IPC不可用，降级到前端嵌入');
          return false;
        }
      } catch (error) {
        console.warn('⚠️ Tauri IPC测试失败，降级到前端嵌入:', error);
        return false;
      }
    }
    
    return false;
  }

  /**
   * 生成单个文本的嵌入向量
   * @param {string} text - 要生成嵌入的文本
   * @param {string} model - 模型名称（可选）
   * @returns {Promise<Object>} 嵌入结果
   */
  async generateEmbedding(text, model = 'simple-tfidf') {
    if (!this.isTauriEnvironment) {
      console.warn('⚠️ 非Tauri环境，使用前端简单嵌入');
      return this.generateSimpleEmbedding(text);
    }

    try {
      const { invoke } = await import('@tauri-apps/api');
      
      const result = await invoke('generate_embedding', {
        request: {
          text: text,
          model: model
        }
      });

      console.log(`✅ 嵌入生成成功: ${text.substring(0, 50)}... (${result.dimensions}维)`);
      return result;
    } catch (error) {
      console.error('❌ 嵌入生成失败:', error);
      // 降级到前端简单嵌入
      return this.generateSimpleEmbedding(text);
    }
  }

  /**
   * 批量生成嵌入向量
   * @param {string[]} texts - 文本数组
   * @param {string} model - 模型名称（可选）
   * @returns {Promise<Object>} 批量嵌入结果
   */
  async generateBatchEmbeddings(texts, model = 'simple-tfidf') {
    if (!this.isTauriEnvironment) {
      console.warn('⚠️ 非Tauri环境，使用前端简单嵌入');
      const embeddings = texts.map(text => this.generateSimpleEmbedding(text));
      return {
        embeddings: embeddings,
        model: 'simple-frontend',
        dimensions: 384
      };
    }

    try {
      const { invoke } = await import('@tauri-apps/api');
      
      const result = await invoke('generate_batch_embeddings', {
        request: {
          texts: texts,
          model: model
        }
      });

      console.log(`✅ 批量嵌入生成成功: ${texts.length} 个文本 (${result.dimensions}维)`);
      return result;
    } catch (error) {
      console.error('❌ 批量嵌入生成失败:', error);
      // 降级到前端简单嵌入
      const embeddings = texts.map(text => this.generateSimpleEmbedding(text));
      return {
        embeddings: embeddings,
        model: 'simple-frontend',
        dimensions: 384
      };
    }
  }

  /**
   * 计算两个嵌入向量的相似度
   * @param {number[]} embedding1 - 第一个嵌入向量
   * @param {number[]} embedding2 - 第二个嵌入向量
   * @returns {Promise<number>} 相似度分数 (0-1)
   */
  async calculateSimilarity(embedding1, embedding2) {
    if (!this.isTauriEnvironment) {
      return this.cosineSimilarity(embedding1, embedding2);
    }

    try {
      const { invoke } = await import('@tauri-apps/api');
      
      const similarity = await invoke('calculate_similarity', {
        embedding1: embedding1,
        embedding2: embedding2
      });

      return similarity;
    } catch (error) {
      console.error('❌ 相似度计算失败:', error);
      return this.cosineSimilarity(embedding1, embedding2);
    }
  }

  /**
   * 前端简单嵌入生成（降级方案）
   * @param {string} text - 文本
   * @returns {Object} 嵌入结果
   */
  generateSimpleEmbedding(text) {
    // 预处理文本
    const processedText = text.toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // 分词
    const words = this.tokenize(processedText);
    
    // 计算词频
    const wordFreq = {};
    words.forEach(word => {
      if (word.length > 1) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });
    
    // 生成384维向量
    const embedding = new Array(384).fill(0);
    const wordsList = Object.keys(wordFreq);
    
    for (let i = 0; i < wordsList.length; i++) {
      const word = wordsList[i];
      const freq = wordFreq[word];
      const hash = this.simpleHash(word);
      
      // 确保hash是有效数字
      if (!isFinite(hash) || isNaN(hash)) {
        console.warn('⚠️ 无效的hash值，跳过词:', word, 'hash:', hash);
        continue;
      }
      
      for (let j = 0; j < 8; j++) {
        const dim = (hash + j * 1000) % 384;
        const sinValue = Math.sin(hash + j);
        
        // 确保所有值都是有效数字
        if (isFinite(sinValue) && !isNaN(sinValue) && isFinite(freq) && !isNaN(freq)) {
          const contribution = freq * sinValue * 0.1;
          if (isFinite(contribution) && !isNaN(contribution)) {
            embedding[dim] += contribution;
          }
        }
      }
    }
    
    // 归一化
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0 && isFinite(norm) && !isNaN(norm)) {
      const normalizedEmbedding = embedding.map(val => {
        const normalized = val / norm;
        return isFinite(normalized) && !isNaN(normalized) ? normalized : 0;
      });
      
      return {
        embedding: normalizedEmbedding,
        model: 'simple-frontend',
        dimensions: 384
      };
    }
    
    // 如果归一化失败，返回零向量
    console.warn('⚠️ 归一化失败，返回零向量');
    return {
      embedding: new Array(384).fill(0),
      model: 'simple-frontend',
      dimensions: 384
    };
  }

  /**
   * 简单分词器
   * @param {string} text - 文本
   * @returns {string[]} 词汇数组
   */
  tokenize(text) {
    const words = [];
    
    // 英文分词
    const englishWords = text.match(/[a-zA-Z]+/g) || [];
    words.push(...englishWords);
    
    // 中文分词（简单按字符分割）
    const chineseText = text.replace(/[a-zA-Z0-9\s]/g, '');
    for (let i = 0; i < chineseText.length; i++) {
      const char = chineseText[i];
      if (char.match(/[\u4e00-\u9fff]/)) {
        words.push(char);
      }
    }
    
    // 数字
    const numbers = text.match(/\d+/g) || [];
    words.push(...numbers);
    
    return words;
  }

  /**
   * 简单哈希函数
   * @param {string} str - 字符串
   * @returns {number} 哈希值
   */
  simpleHash(str) {
    if (!str || str.length === 0) return 0;
    
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    // 确保返回有效的数字
    const result = Math.abs(hash);
    return isFinite(result) && !isNaN(result) ? result : 0;
  }

  /**
   * 计算余弦相似度
   * @param {number[]} a - 向量A
   * @param {number[]} b - 向量B
   * @returns {number} 相似度分数
   */
  cosineSimilarity(a, b) {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * 为文档生成嵌入向量
   * @param {string} content - 文档内容
   * @param {number} chunkSize - 分块大小
   * @param {number} overlap - 重叠大小
   * @returns {Promise<Object[]>} 嵌入向量数组
   */
  async generateDocumentEmbeddings(content, chunkSize = 1000, overlap = 200) {
    console.log('🔄 开始为文档生成嵌入向量...');
    
    // 分块
    const chunks = this.chunkText(content, chunkSize, overlap);
    console.log(`📄 文档已分为 ${chunks.length} 个块`);
    
    // 批量生成嵌入
    const result = await this.generateBatchEmbeddings(chunks);
    
    // 组合结果
    const embeddings = result.embeddings.map((embedding, index) => ({
      chunkIndex: index,
      chunkText: chunks[index],
      embedding: embedding,
      model: result.model,
      dimensions: result.dimensions
    }));

    console.log(`✅ 文档嵌入生成完成: ${embeddings.length} 个向量`);
    return embeddings;
  }

  /**
   * 文本分块
   * @param {string} text - 文本
   * @param {number} chunkSize - 块大小
   * @param {number} overlap - 重叠大小
   * @returns {string[]} 文本块数组
   */
  chunkText(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
      let end = start + chunkSize;
      
      if (end < text.length) {
        // 尝试在句号、问号、感叹号处分割
        const sentenceEnd = text.lastIndexOf('。', end);
        const questionEnd = text.lastIndexOf('？', end);
        const exclamationEnd = text.lastIndexOf('！', end);
        const periodEnd = text.lastIndexOf('.', end);
        const questionMarkEnd = text.lastIndexOf('?', end);
        const exclamationMarkEnd = text.lastIndexOf('!', end);
        
        const maxEnd = Math.max(sentenceEnd, questionEnd, exclamationEnd, periodEnd, questionMarkEnd, exclamationMarkEnd);
        
        if (maxEnd > start + chunkSize * 0.5) {
          end = maxEnd + 1;
        }
      }

      const chunk = text.slice(start, end).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      start = end - overlap;
      if (start >= text.length) break;
    }

    return chunks;
  }
}

// 创建全局实例
const embeddingService = new EmbeddingService();

export default embeddingService;
