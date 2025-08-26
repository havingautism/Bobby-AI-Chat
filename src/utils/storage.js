const STORAGE_KEY = "ai-chat-conversations";

export const loadChatHistory = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("加载聊天历史失败:", error);
    return [];
  }
};

export const saveChatHistory = (conversations) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (error) {
    console.error("保存聊天历史失败:", error);
  }
};

export const clearChatHistory = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("清除聊天历史失败:", error);
  }
};
