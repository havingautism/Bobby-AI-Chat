import React, { useState, useEffect } from "react";
import ChatInterface from "./components/ChatInterface";
import Sidebar from "./components/Sidebar";
import Settings from "./components/Settings";
import BackgroundSystem from "./components/BackgroundSystem";
import {
  loadChatHistory,
  saveChatHistory,
  migrateFromLocalStorage,
} from "./utils/storage";
import { initTheme } from "./utils/theme";
import { getApiConfig } from "./utils/api";
import { v4 as uuidv4 } from "uuid";
import "./App.css";
import "./styles/theme.css";

function App() {
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [defaultModel, setDefaultModel] = useState("deepseek-ai/DeepSeek-V3.1");

  // 同步默认模型与API配置
  useEffect(() => {
    const apiConfig = getApiConfig();
    setDefaultModel(apiConfig.model || "deepseek-ai/DeepSeek-V3.1");
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 初始化主题
        initTheme();

        // 获取默认模型配置
        const apiConfig = getApiConfig();
        setDefaultModel(apiConfig.model || "deepseek-ai/DeepSeek-V3.1");

        // 迁移旧数据
        await migrateFromLocalStorage();

        // 加载对话历史
        const savedConversations = await loadChatHistory();
        console.log("加载的对话历史:", savedConversations);

        if (savedConversations.length > 0) {
          setConversations(savedConversations);
          // 优先选择最新的对话（第一个）
          setCurrentConversationId(savedConversations[0].id);
        } else {
          // 创建初始对话
          const initialConversation = {
            id: uuidv4(),
            title: "新对话",
            messages: [],
            createdAt: new Date().toISOString(),
            role: null, // 初始对话没有角色
            model: apiConfig.model || "deepseek-ai/DeepSeek-V3.1", // 使用配置的默认模型
          };
          setConversations([initialConversation]);
          setCurrentConversationId(initialConversation.id);
        }

        // 标记初始化完成
        setIsInitialized(true);
      } catch (error) {
        console.error("初始化应用失败:", error);
        // 如果初始化失败，创建一个默认对话
        const initialConversation = {
          id: uuidv4(),
          title: "新对话",
          messages: [],
          createdAt: new Date().toISOString(),
          role: null,
          model: "deepseek-ai/DeepSeek-V3.1",
        };
        setConversations([initialConversation]);
        setCurrentConversationId(initialConversation.id);
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    // 只在初始化完成后才保存对话历史
    if (isInitialized && conversations.length > 0) {
      const saveData = async () => {
        try {
          console.log("保存对话历史:", conversations);
          await saveChatHistory(conversations);
        } catch (error) {
          console.error("保存对话历史失败:", error);
        }
      };
      saveData();
    }
  }, [conversations, isInitialized]);

  const createNewConversation = () => {
    // 检查是否已经有空对话
    const emptyConversation = conversations.find(
      (conv) => conv.messages.length === 0
    );

    if (emptyConversation) {
      // 如果已经有空对话，直接切换到它
      setCurrentConversationId(emptyConversation.id);
    } else {
      // 移除所有空对话，只保留一个新的空对话
      const conversationsWithMessages = conversations.filter(
        (conv) => conv.messages.length > 0
      );
      const newConversation = {
        id: uuidv4(),
        title: "新对话",
        messages: [],
        createdAt: new Date().toISOString(),
        role: null, // 新对话没有角色
        model: defaultModel, // 使用当前配置的默认模型
      };
      setConversations([newConversation, ...conversationsWithMessages]);
      setCurrentConversationId(newConversation.id);
    }

    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  const deleteConversation = (id) => {
    setConversations((prev) => {
      const filtered = prev.filter((conv) => conv.id !== id);

      // 检查是否还有空对话
      const hasEmptyConversation = filtered.some(
        (conv) => conv.messages.length === 0
      );

      if (currentConversationId === id) {
        // 如果删除的是当前对话，切换到其他对话
        if (filtered.length > 0) {
          // 优先切换到空对话，如果没有则切换到第一个有消息的对话
          const emptyConv = filtered.find((conv) => conv.messages.length === 0);
          setCurrentConversationId(emptyConv ? emptyConv.id : filtered[0].id);
        } else {
          // 如果没有任何对话了，创建一个新的空对话
          const newConversation = {
            id: uuidv4(),
            title: "新对话",
            messages: [],
            createdAt: new Date().toISOString(),
            role: null,
            model: defaultModel, // 使用当前配置的默认模型
          };
          setCurrentConversationId(newConversation.id);
          return [newConversation];
        }
      }

      // 如果删除后没有空对话了，创建一个新的空对话
      if (!hasEmptyConversation) {
        const newConversation = {
          id: uuidv4(),
          title: "新对话",
          messages: [],
          createdAt: new Date().toISOString(),
          role: null,
          model: defaultModel, // 使用当前配置的默认模型
        };
        return [newConversation, ...filtered];
      }

      return filtered;
    });
  };

  const updateConversation = (id, updates) => {
    setConversations((prev) =>
      prev.map((conv) => (conv.id === id ? { ...conv, ...updates } : conv))
    );
  };

  const currentConversation = conversations.find(
    (conv) => conv.id === currentConversationId
  );

  return (
    <div className="app">
      <BackgroundSystem />
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={setCurrentConversationId}
        onNewConversation={createNewConversation}
        onDeleteConversation={deleteConversation}
        onUpdateConversation={updateConversation}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div
        className={`main-content ${sidebarOpen ? "sidebar-open" : ""} ${
          sidebarCollapsed ? "sidebar-collapsed" : ""
        }`}
      >
        {currentConversation && (
          <ChatInterface
            conversation={currentConversation}
            onUpdateConversation={updateConversation}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}
      </div>

      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onModelChange={(newModel) => {
          setDefaultModel(newModel);
          // 只更新默认模型，不更新当前对话的模型
          // 当前对话的模型应该保持用户手动选择的状态
        }}
      />
    </div>
  );
}

export default App;
