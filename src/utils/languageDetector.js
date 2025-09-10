import { franc } from 'franc';

/**
 * 语言检测和模型选择工具
 * 支持专家模型分离方案
 */

// 支持的语言和对应硅基流动模型映射
const LANGUAGE_MODEL_MAP = {
    'zh': {
        model: 'BAAI/bge-large-zh-v1.5',
        dimensions: 1024,
        collection: 'my_knowledge_bge-large-zh-v1.5'
    },
    'en': {
        model: 'BAAI/bge-large-en-v1.5',
        dimensions: 1024,
        collection: 'my_knowledge_bge-large-en-v1.5'
    },
    'default': {
        model: 'BAAI/bge-m3',
        dimensions: 1024,
        collection: 'my_knowledge_bge-m3'
    }
};

/**
 * 检测文本语言
 * @param {string} text - 要检测的文本
 * @returns {string} 语言代码 (zh, en, 等)
 */
export function detectLanguage(text) {
    if (!text || typeof text !== 'string') {
        return 'default';
    }

    try {
        // 清理文本，移除特殊字符和数字
        const cleanText = text.replace(/[0-9\s\n\r\t]/g, '').trim();
        
        if (cleanText.length < 3) {
            return 'default';
        }

        // 使用 franc 检测语言
        const detected = franc(cleanText);
        console.log(`🔍 语言检测结果: ${detected} (原文: ${text.substring(0, 50)}...)`);
        
        // 映射到我们支持的语言
        if (detected === 'cmn' || detected === 'yue' || detected === 'wuu' || detected === 'und') {
            // und 表示未检测到，对于短文本或混合文本，默认使用中文
            return 'zh';
        } else if (detected === 'eng') {
            return 'en';
        } else {
            // 其他语言默认使用中文模型
            return 'zh';
        }
    } catch (error) {
        console.warn('⚠️ 语言检测失败，使用默认模型:', error);
        return 'default';
    }
}

/**
 * 根据语言获取对应的模型配置
 * @param {string} language - 语言代码
 * @returns {Object} 模型配置 {model, dimensions}
 */
export function getModelConfig(language) {
    const config = LANGUAGE_MODEL_MAP[language] || LANGUAGE_MODEL_MAP['default'];
    console.log(`🎯 选择模型配置: ${config.model}`);
    return config;
}

/**
 * 根据文本自动选择模型配置
 * @param {string} text - 要分析的文本
 * @returns {Object} 模型配置 {model, collection, dimensions, detectedLanguage}
 */
export function autoSelectModel(text) {
    const detectedLanguage = detectLanguage(text);
    const config = getModelConfig(detectedLanguage);
    
    return {
        ...config,
        detectedLanguage
    };
}

/**
 * 获取所有支持的模型名称
 * @returns {Array<string>} 模型名称列表
 */
export function getAllModels() {
    return Object.values(LANGUAGE_MODEL_MAP)
        .map(config => config.model)
        .filter((model, index, self) => self.indexOf(model) === index);
}

export default {
    detectLanguage,
    getModelConfig,
    autoSelectModel,
    getAllModels
};
