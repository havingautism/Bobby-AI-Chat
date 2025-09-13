import React, { createContext, useContext, useState, useEffect } from 'react';
import { storageAdapter } from '../utils/storageAdapter';
import { getApiConfig } from '../utils/api';
import { v4 as uuidv4 } from 'uuid';

const SessionContext = createContext();

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

export const SessionProvider = ({ children }) => {
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [defaultModel, setDefaultModel] = useState("deepseek-ai/DeepSeek-V3.1");
  const [lastResponseMode, setLastResponseMode] = useState(() => {
    return localStorage.getItem('lastResponseMode') || "normal";
  });

  // Initialize session
  useEffect(() => {
    const initializeSession = async () => {
      try {
        const savedConversations = await storageAdapter.loadChatHistory();
        const apiConfig = getApiConfig();
        setDefaultModel(apiConfig.model || "deepseek-ai/DeepSeek-V3.1");

        if (savedConversations.length > 0) {
          const migratedConversations = savedConversations.map(conv => ({
            ...conv,
            responseMode: conv.responseMode || lastResponseMode
          }));
          setConversations(migratedConversations);
          
          // 自动设置最新的空对话，如果没有空对话则创建新的
          const emptyConversation = migratedConversations.find(conv => conv.messages.length === 0);
          if (emptyConversation) {
            setCurrentConversationId(emptyConversation.id);
            console.log('自动设置最新空对话:', emptyConversation.id);
          } else {
            // 没有空对话，创建一个新的
            const newConversation = {
              id: uuidv4(),
              title: "新对话",
              messages: [],
              createdAt: new Date().toISOString(),
              role: null,
              model: defaultModel,
              responseMode: lastResponseMode,
            };
            setConversations([newConversation, ...migratedConversations]);
            setCurrentConversationId(newConversation.id);
            console.log('自动创建新对话:', newConversation.id);
          }
        } else {
          // 没有保存的对话，创建一个并自动选择
          const initialConversation = {
            id: uuidv4(),
            title: "新对话",
            messages: [],
            createdAt: new Date().toISOString(),
            role: null,
            model: defaultModel,
            responseMode: lastResponseMode,
          };
          setConversations([initialConversation]);
          setCurrentConversationId(initialConversation.id);
          console.log('首次创建对话:', initialConversation.id);
        }
      } catch (error) {
        console.error("初始化会话失败:", error);
        const fallbackConversation = {
          id: uuidv4(),
          title: "新对话",
          messages: [],
          createdAt: new Date().toISOString(),
          role: null,
          model: defaultModel,
          responseMode: lastResponseMode,
        };
        setConversations([fallbackConversation]);
        setCurrentConversationId(fallbackConversation.id);
        console.log('错误恢复创建对话:', fallbackConversation.id);
      }
      setIsInitialized(true);
    };

    initializeSession();
  }, []);

  // Save conversations to storage
  useEffect(() => {
    if (isInitialized && conversations.length > 0) {
      const saveData = async () => {
        try {
          await storageAdapter.saveChatHistory(conversations);
        } catch (error) {
          console.error("保存对话历史失败:", error);
        }
      };
      saveData();
    }
  }, [conversations, isInitialized]);

  const createNewConversation = () => {
    // 首先查找是否存在没有消息的空对话
    const emptyConversation = conversations.find(conv => conv.messages.length === 0);
    
    if (emptyConversation) {
      // 复用空对话，确保状态正确设置
      setCurrentConversationId(emptyConversation.id);
      console.log('复用空对话:', emptyConversation.id);
      return emptyConversation.id;
    } else {
      // 没有空对话时，创建新的对话
      const newConversation = {
        id: uuidv4(),
        title: "新对话",
        messages: [],
        createdAt: new Date().toISOString(),
        role: null,
        model: defaultModel,
        responseMode: lastResponseMode,
      };
      
      // 将新对话添加到列表开头
      setConversations(prev => [newConversation, ...prev]);
      setCurrentConversationId(newConversation.id);
      
      console.log('创建新对话:', newConversation.id);
      return newConversation.id;
    }
  };

  const deleteConversation = async (id) => {
    try {
      await storageAdapter.deleteConversation(id);
    } catch (error) {
      console.error('从数据库删除对话失败:', error);
    }
    
    setConversations((prev) => {
      const filtered = prev.filter((conv) => conv.id !== id);
      const currentConv = prev.find(conv => conv.id === currentConversationId);
      
      const isNewConversationPage = currentConv && currentConv.messages.length === 0;

      if (isNewConversationPage) {
        if (filtered.length > 0) {
          const sortedByTime = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setCurrentConversationId(sortedByTime[0].id);
        } else {
          const newConversation = {
            id: uuidv4(),
            title: "新对话",
            messages: [],
            createdAt: new Date().toISOString(),
            role: null,
            model: defaultModel,
            responseMode: lastResponseMode,
          };
          setCurrentConversationId(newConversation.id);
          return [newConversation];
        }
      } else {
        if (currentConversationId === id) {
          if (filtered.length > 0) {
            const deletedConv = prev.find(conv => conv.id === id);
            const sameRoleConversations = filtered.filter(conv => conv.role === deletedConv?.role);
            if (sameRoleConversations.length > 0) {
              setCurrentConversationId(sameRoleConversations[0].id);
            } else {
              const sortedByTime = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
              setCurrentConversationId(sortedByTime[0].id);
            }
          } else {
            const newConversation = {
              id: uuidv4(),
              title: "新对话",
              messages: [],
              createdAt: new Date().toISOString(),
              role: null,
              model: defaultModel,
              responseMode: lastResponseMode,
            };
            setCurrentConversationId(newConversation.id);
            return [newConversation];
          }
        }
      }
      return filtered;
    });
  };

  const updateConversation = (id, updates) => {
    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id === id) {
          const updatedConv = { ...conv, ...updates };
          if (updates.responseMode !== undefined) {
            setLastResponseMode(updates.responseMode);
            localStorage.setItem('lastResponseMode', updates.responseMode);
          }
          return updatedConv;
        }
        return conv;
      })
    );
  };

  
  const value = {
    conversations,
    currentConversationId,
    setCurrentConversationId,
    createNewConversation,
    deleteConversation,
    updateConversation,
    isInitialized,
    defaultModel,
    setDefaultModel,
    lastResponseMode,
    setLastResponseMode
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};