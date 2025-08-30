// 语言管理工具
const LANGUAGE_STORAGE_KEY = "ai-chat-language";

// 支持的语言
export const LANGUAGES = {
  zh: {
    code: "zh",
    name: "中文",
    flag: "🇨🇳",
  },
  en: {
    code: "en", 
    name: "English",
    flag: "🇺🇸",
  },
};

// 获取当前语言
export const getCurrentLanguage = () => {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return saved || "zh"; // 默认中文
  } catch (error) {
    console.error("加载语言设置失败:", error);
    return "zh";
  }
};

// 设置语言
export const setLanguage = (languageCode) => {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
    // 触发自定义事件通知组件更新
    window.dispatchEvent(new CustomEvent("languageChanged", { detail: languageCode }));
  } catch (error) {
    console.error("保存语言设置失败:", error);
  }
};

// 翻译文本
export const translations = {
  zh: {
    // 应用标题
    appTitle: "AI 智能助手",
    newChat: "新对话",
    settings: "设置",
    
    // 聊天界面
    welcomeTitle: "欢迎使用 AI 智能助手",
    welcomeSubtitle: "选择一个角色开始对话，或直接输入消息",
    typeMessage: "输入消息...",
    send: "发送",
    sending: "发送中...",
    stop: "停止",
    retry: "重试",
    copyReply: "复制回复",
    copyQuestion: "复制问题",
    regenerate: "重新生成",
    copied: "已复制",
    
    // 设置页面
    settingsTitle: "设置",
    apiConfig: "API 配置",
    baseUrl: "API 地址",
    apiKey: "API 密钥",
    model: "模型",
    temperature: "温度",
    maxTokens: "最大令牌数",
    save: "保存",
    cancel: "取消",
    reset: "重置",
    
    // 侧边栏
    chatHistory: "对话历史",
    deleteChat: "删除对话",
    editTitle: "编辑标题",
    
    // 错误信息
    networkError: "网络连接失败，请检查您的网络连接",
    apiError: "API 调用失败",
    configError: "请先配置 API 设置",
    
    // 其他
    confirm: "确认",
    delete: "删除",
    edit: "编辑",
    close: "关闭",
    switchModel: "切换模型",
    
    // 推理过程
    displayThinking: "显示思路",
    analysis: "分析",
    
    // 时间轴
    timeline: "时间轴",
    questions: "个问题",
  },
  en: {
    // 应用标题
    appTitle: "AI Assistant",
    newChat: "New Chat",
    settings: "Settings",
    
    // 聊天界面
    welcomeTitle: "Welcome to AI Assistant",
    welcomeSubtitle: "Choose a role to start chatting, or type a message directly",
    typeMessage: "Type a message...",
    send: "Send",
    sending: "Sending...",
    stop: "Stop",
    retry: "Retry",
    copyReply: "Copy Reply",
    copyQuestion: "Copy Question",
    regenerate: "Regenerate",
    copied: "Copied",
    
    // 设置页面
    settingsTitle: "Settings",
    apiConfig: "API Configuration",
    baseUrl: "API Base URL",
    apiKey: "API Key",
    model: "Model",
    temperature: "Temperature",
    maxTokens: "Max Tokens",
    save: "Save",
    cancel: "Cancel",
    reset: "Reset",
    
    // 侧边栏
    chatHistory: "Chat History",
    deleteChat: "Delete Chat",
    editTitle: "Edit Title",
    
    // 错误信息
    networkError: "Network connection failed, please check your network",
    apiError: "API call failed",
    configError: "Please configure API settings first",
    
    // 其他
    confirm: "Confirm",
    delete: "Delete",
    edit: "Edit",
    close: "Close",
    switchModel: "Switch Model",
    
    // 推理过程
    displayThinking: "Display Thinking",
    analysis: "Analysis",
    
    // 时间轴
    timeline: "Timeline",
    questions: "questions",
  },
};

// 获取翻译文本
export const t = (key, lang = null) => {
  const currentLang = lang || getCurrentLanguage();
  return translations[currentLang]?.[key] || key;
};
