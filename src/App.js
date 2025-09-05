import React, { useState, useEffect } from "react";
import ChatInterface from "./components/ChatInterface";
import Sidebar from "./components/Sidebar";
import Settings from "./components/Settings";
import TauriInitializer from "./components/TauriInitializer";
import { loadChatHistory, saveChatHistory, migrateFromLocalStorage } from "./utils/storageAdapter";
import { initTheme } from "./utils/theme";
import { getApiConfig } from "./utils/api";
import { smartCacheCleanup } from "./utils/cacheManager";
import { initializeApiSessionManager } from "./utils/apiSessionManager";
import "./utils/mobileCacheOptimizer"; // Import mobile cache optimizer
import { v4 as uuidv4 } from "uuid";
import "./App.css";
import "./styles/theme.css";
import "./styles/glassmorphism.css"; // Import the new theme
import "./utils/mobileFontOptimizer"; // Import mobile font optimizer

function App() {
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [defaultModel, setDefaultModel] = useState("deepseek-ai/DeepSeek-V3.1");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [lastResponseMode, setLastResponseMode] = useState(() => {
    // 从 localStorage 读取保存的响应模式，默认为 "normal"
    return localStorage.getItem('lastResponseMode') || "normal";
  });

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      // 在移动端时，如果侧边栏是展开状态，自动收起
      if (mobile && sidebarOpen && !sidebarCollapsed) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen, sidebarCollapsed]);

  // 同步默认模型与API配置
  useEffect(() => {
    const apiConfig = getApiConfig();
    setDefaultModel(apiConfig.model || "deepseek-ai/DeepSeek-V3.1");
    
    // 初始化移动字体优化器
    if (window.MobileFontOptimizer) {
      const fontOptimizer = new window.MobileFontOptimizer();
      window.fontOptimizer = fontOptimizer; // 全局访问
    }
  }, []);

  // 监听默认模型变化，更新空对话的模型
  useEffect(() => {
    // 更新所有空对话的模型为新的默认模型
    setConversations(prev => prev.map(conv => {
      if (conv.messages.length === 0) {
        // 如果对话是空的，使用新的默认模型
        return { ...conv, model: defaultModel };
      }
      return conv;
    }));
  }, [defaultModel]);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 初始化主题
        initTheme();

        // 智能清理过期缓存（保护IndexedDB数据）
        await smartCacheCleanup();

        // 获取默认模型配置
        const apiConfig = getApiConfig();
        setDefaultModel(apiConfig.model || "deepseek-ai/DeepSeek-V3.1");
        
        // 初始化API会话管理器
        await initializeApiSessionManager();

        // 迁移旧数据
        await migrateFromLocalStorage();

        // 加载对话历史
        const savedConversations = await loadChatHistory();
        console.log("加载的对话历史:", savedConversations);

        if (savedConversations.length > 0) {
          // 为没有 responseMode 的对话添加默认值，使用最后保存的响应模式
          const migratedConversations = savedConversations.map(conv => ({
            ...conv,
            responseMode: conv.responseMode || lastResponseMode
          }));
          setConversations(migratedConversations);
          // 优先选择最新的对话（第一个）
          setCurrentConversationId(migratedConversations[0].id);
        } else {
          // 创建初始对话
          const initialConversation = {
            id: uuidv4(),
            title: "新对话",
            messages: [],
            createdAt: new Date().toISOString(),
            role: null, // 初始对话没有角色
            model: defaultModel, // 使用当前默认模型
            responseMode: lastResponseMode, // 使用最后选择的响应模式
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
          model: defaultModel,
          responseMode: lastResponseMode, // 使用最后选择的响应模式
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
        responseMode: lastResponseMode, // 使用最后选择的响应模式
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
      const currentConv = prev.find(conv => conv.id === currentConversationId);
      
      // 判断是否为新对话页面（当前对话没有消息）
      const isNewConversationPage = currentConv && currentConv.messages.length === 0;

      if (isNewConversationPage) {
        // 新对话页面删除任何对话：跳到按时间排序的最新对话
        if (filtered.length > 0) {
          const sortedByTime = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setCurrentConversationId(sortedByTime[0].id);
        } else {
          // 如果没有任何对话了，创建一个新的空对话
          const newConversation = {
            id: uuidv4(),
            title: "新对话",
            messages: [],
            createdAt: new Date().toISOString(),
            role: null,
            model: defaultModel, // 使用当前配置的默认模型
            responseMode: lastResponseMode, // 使用最后选择的响应模式
          };
          setCurrentConversationId(newConversation.id);
          return [newConversation];
        }
      } else {
        // 其他页面删除：保持当前会话不变（除非删除的是当前对话）
        if (currentConversationId === id) {
          // 删除的是当前对话，需要切换到其他对话
          if (filtered.length > 0) {
            // 优先选择同角色的对话，或者按时间排序的最新对话
            const deletedConv = prev.find(conv => conv.id === id);
            const sameRoleConversations = filtered.filter(conv => conv.role === deletedConv?.role);
            if (sameRoleConversations.length > 0) {
              setCurrentConversationId(sameRoleConversations[0].id);
            } else {
              const sortedByTime = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
              setCurrentConversationId(sortedByTime[0].id);
            }
          } else {
            // 如果没有任何对话了，创建一个新的空对话
            const newConversation = {
              id: uuidv4(),
              title: "新对话",
              messages: [],
              createdAt: new Date().toISOString(),
              role: null,
              model: defaultModel, // 使用当前配置的默认模型
              responseMode: lastResponseMode, // 使用最后选择的响应模式
            };
            setCurrentConversationId(newConversation.id);
            return [newConversation];
          }
        }
        // 如果删除的不是当前对话，保持当前会话不变
      }

      return filtered;
    });
  };

  const updateConversation = (id, updates) => {
    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id === id) {
          const updatedConv = { ...conv, ...updates };
          // 如果更新了响应模式，同时更新最后选择的模式
          if (updates.responseMode !== undefined) {
            setLastResponseMode(updates.responseMode);
            // 保存到 localStorage
            localStorage.setItem('lastResponseMode', updates.responseMode);
          }
          return updatedConv;
        }
        return conv;
      })
    );
  };

  const currentConversation = conversations.find(
    (conv) => conv.id === currentConversationId
  );

  return (
    <TauriInitializer>
      <div className="app-container">
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
        onToggleCollapse={() => {
          const next = !sidebarCollapsed;
          setSidebarCollapsed(next);
          // 切到收起 -> 以窄栏显示，需要打开
          if (next) {
            setSidebarOpen(true);
          }
        }}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      {/* 移动端侧边栏遮罩层：仅宽栏打开时显示 */}
      {sidebarOpen && !sidebarCollapsed && isMobile && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className={`glass-pane chat-interface ${isMobile && sidebarOpen && sidebarCollapsed ? 'with-collapsed-sidebar' : ''}`}>
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
          
          // 更新当前对话的模型（如果对话还没有消息）
          if (currentConversation) {
            if (currentConversation.messages.length === 0) {
              // 如果是空对话，使用新的默认模型
              updateConversation(currentConversation.id, { model: newModel });
            }
            // 如果对话已有消息，保持当前手动选择的模型不变
          }
        }}
      />
    </div>
    </TauriInitializer>
  );
}

export default App;
