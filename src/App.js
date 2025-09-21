import React, { useState, useEffect } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
} from "react-router-dom";
import { SessionProvider, useSession } from "./contexts/SessionContext";
import ChatInterface from "./components/ChatInterface";
import WelcomeContent from "./components/WelcomeContent";
import Sidebar from "./components/Sidebar";
import Settings from "./components/Settings";
import AboutModal from "./components/AboutModal";
import KnowledgeBase from "./components/KnowledgeBase";
import RoleModelManager from "./components/RoleModelManager";
import TestRoleManager from "./components/TestRoleManager";
import TauriInitializer from "./components/TauriInitializer";
import { initTheme } from "./utils/theme";
import { smartCacheCleanup } from "./utils/cacheManager";
import { initializeApiSessionManager } from "./utils/apiSessionManager";
import { isTauriEnvironment } from "./utils/tauriDetector";
import "./utils/mobileCacheOptimizer";
import "./utils/mobileFontOptimizer";
import "./App.css";
import "./styles/theme.css";
import "./styles/glassmorphism.css";

const MainContent = () => {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const {
    conversations,
    currentConversationId,
    setCurrentConversationId,
    createNewConversation,
    deleteConversation,
    updateConversation,
    toggleConversationFavorite,
    setDefaultModel,
  } = useSession();

  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [knowledgeBaseOpen, setKnowledgeBaseOpen] = useState(false);
  const [roleModelManagerOpen, setRoleModelManagerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        initTheme();
        await smartCacheCleanup();
        await initializeApiSessionManager();
      } catch (error) {
        console.error("初始化应用失败:", error);
      }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile && sidebarOpen && !sidebarCollapsed) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sidebarOpen, sidebarCollapsed]);

  // 初始化时检查路由参数并同步到状态
  useEffect(() => {
    if (conversations.length > 0 && conversationId) {
      const conversation = conversations.find(
        (conv) => conv.id === conversationId
      );
      if (conversation) {
        setCurrentConversationId(conversationId);
      } else {
        // 路由中的conversationId不存在，重定向到首页
        navigate("/", { replace: true });
      }
    }
  }, [conversations, conversationId, setCurrentConversationId, navigate]);

  // 首页自动重定向到最新对话
  useEffect(() => {
    // 只有在首页（没有conversationId）且有currentConversationId时才重定向
    if (!conversationId && currentConversationId && conversations.length > 0) {
      console.log("首页自动重定向到最新对话:", currentConversationId);
      navigate(`/chat/${currentConversationId}`, { replace: true });
    }
  }, [conversationId, currentConversationId, conversations.length, navigate]);

  const currentConversation = conversations.find(
    (conv) => conv.id === currentConversationId
  );

  const handleNewConversation = () => {
    const newConversationId = createNewConversation();
    // 创建新对话后导航到聊天页面，使用具体的conversationId
    setTimeout(() => {
      navigate(`/chat/${newConversationId}`);
    }, 100);

    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  const handleSelectConversation = (id) => {
    setCurrentConversationId(id);
    navigate(`/chat/${id}`);
  };

  return (
    <TauriInitializer>
      <div className="app-container">
        <Sidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={deleteConversation}
          onUpdateConversation={updateConversation}
          onToggleFavorite={toggleConversationFavorite}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => {
            const next = !sidebarCollapsed;
            setSidebarCollapsed(next);
            if (next) {
              setSidebarOpen(true);
            }
          }}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenAbout={() => setAboutOpen(true)}
          onOpenKnowledgeBase={
            isTauriEnvironment() ? () => setKnowledgeBaseOpen(true) : undefined
          }
          onOpenRoleModelManager={() => setRoleModelManagerOpen(true)}
        />

        {sidebarOpen && !sidebarCollapsed && isMobile && (
          <div
            className="sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div
          className={`glass-pane chat-interface ${
            isMobile && sidebarOpen && sidebarCollapsed
              ? "with-collapsed-sidebar"
              : ""
          }`}
        >
          <Routes>
            <Route
              path="/"
              element={
                <WelcomeContent
                  onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                  onOpenSettings={() => setSettingsOpen(true)}
                  onOpenKnowledgeBase={() => setKnowledgeBaseOpen(true)}
                />
              }
            />
            <Route
              path="/chat"
              element={
                currentConversation ? (
                  <ChatInterface
                    conversation={currentConversation}
                    onUpdateConversation={updateConversation}
                    onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    onOpenSettings={() => setSettingsOpen(true)}
                    onOpenKnowledgeBase={() => setKnowledgeBaseOpen(true)}
                  />
                ) : (
                  <WelcomeContent
                    onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    onOpenSettings={() => setSettingsOpen(true)}
                    onOpenKnowledgeBase={() => setKnowledgeBaseOpen(true)}
                  />
                )
              }
            />
            <Route
              path="/chat/:conversationId"
              element={
                currentConversation ? (
                  <ChatInterface
                    conversation={currentConversation}
                    onUpdateConversation={updateConversation}
                    onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    onOpenSettings={() => setSettingsOpen(true)}
                    onOpenKnowledgeBase={() => setKnowledgeBaseOpen(true)}
                  />
                ) : (
                  <Navigate to="/chat" replace />
                )
              }
            />
          </Routes>
        </div>

        <Settings
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onModelChange={(newModel) => {
            setDefaultModel(newModel);

            if (currentConversation) {
              if (currentConversation.messages.length === 0) {
                updateConversation(currentConversation.id, { model: newModel });
              }
            }
          }}
        />

        <AboutModal isOpen={aboutOpen} onClose={() => setAboutOpen(false)} />

        {isTauriEnvironment() && (
          <KnowledgeBase
            isOpen={knowledgeBaseOpen}
            onClose={() => setKnowledgeBaseOpen(false)}
          />
        )}
        {/* 测试版本 - 用于调试编辑按钮问题 */}
        <TestRoleManager
          isOpen={roleModelManagerOpen}
          onClose={() => setRoleModelManagerOpen(false)}
        />
        {/*
        <RoleModelManager
          isOpen={roleModelManagerOpen}
          onClose={() => setRoleModelManagerOpen(false)}
        />
        */}
      </div>
    </TauriInitializer>
  );
};

function App() {
  return (
    <SessionProvider>
      <Router>
        <Routes>
          <Route path="*" element={<MainContent />} />
        </Routes>
      </Router>
    </SessionProvider>
  );
}

export default App;
