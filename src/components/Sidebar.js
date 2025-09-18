import React, { useState, useMemo, useRef, useEffect } from "react";
import { getRoleById } from "../utils/roles";
import { getCurrentTheme, toggleTheme } from "../utils/theme";
import { getCurrentLanguage, t } from "../utils/language";
import { isTauriEnvironment } from "../utils/tauriDetector";
import { apiSessionManager } from "../utils/apiSessionManager";
import DeleteConfirmModal from "./DeleteConfirmModal";
import LanguageToggle from "./LanguageToggle";
import RoleModelManager from "./RoleModelManager";
import "./Sidebar.css";

const Sidebar = ({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onUpdateConversation,
  isOpen,
  onToggle,
  isCollapsed,
  onToggleCollapse,
  onOpenSettings,
  onOpenAbout,
  onOpenKnowledgeBase,
  onOpenRoleModelManager,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("all");
  const [showRoleFilter, setShowRoleFilter] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => getCurrentTheme());
  const [currentLanguage, setCurrentLanguage] = useState(() => getCurrentLanguage());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState(null);
  const [roleModelManagerOpen, setRoleModelManagerOpen] = useState(false);
  const [roles, setRoles] = useState([]);
  const roleFilterRef = useRef(null);

  // 点击外部关闭角色筛选下拉菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        roleFilterRef.current &&
        !roleFilterRef.current.contains(event.target)
      ) {
        setShowRoleFilter(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 监听主题变化
  useEffect(() => {
    const handleThemeChange = (event) => {
      setCurrentTheme(event.detail);
    };

    window.addEventListener("themeChanged", handleThemeChange);
    return () => {
      window.removeEventListener("themeChanged", handleThemeChange);
    };
  }, []);

  // 监听语言变化
  useEffect(() => {
    const handleLanguageChange = (event) => {
      setCurrentLanguage(event.detail);
    };

    window.addEventListener("languageChanged", handleLanguageChange);
    return () => {
      window.removeEventListener("languageChanged", handleLanguageChange);
    };
  }, []);

  // 加载角色列表
  useEffect(() => {
    const loadRoles = async () => {
      try {
        // 尝试从数据库加载角色
        const { dbManager, getAllRoles } = await import('../utils/database');
        await dbManager.init();

        const rolesFromDB = await getAllRoles();
        console.log('Sidebar从数据库加载的角色:', rolesFromDB);

        if (rolesFromDB && rolesFromDB.length > 0) {
          setRoles(rolesFromDB);
        } else {
          // 如果数据库中没有角色，使用默认角色
          const { AI_ROLES } = require('../utils/roles');
          setRoles(AI_ROLES);
        }
      } catch (error) {
        console.error("从数据库加载角色失败，降级到localStorage:", error);

        // 降级到localStorage
        try {
          const savedRoles = localStorage.getItem('ai-roles-updated');
          const customRoles = localStorage.getItem('custom-roles');

          let rolesToUse = [];

          if (savedRoles) {
            rolesToUse = JSON.parse(savedRoles);
          } else if (customRoles) {
            rolesToUse = JSON.parse(customRoles);
          } else {
            // 如果没有保存的角色，使用默认角色
            const { AI_ROLES } = require('../utils/roles');
            rolesToUse = AI_ROLES;
          }

          setRoles(rolesToUse);
        } catch (fallbackError) {
          console.error("从localStorage加载角色也失败:", fallbackError);
          // 最终降级到默认角色
          const { AI_ROLES } = require('../utils/roles');
          setRoles(AI_ROLES);
        }
      }
    };

    loadRoles();

    // 监听角色更新事件
    const handleRolesUpdated = (event) => {
      console.log('Sidebar接收到rolesUpdated事件:', event.detail);
      setRoles(event.detail);
    };

    const handleRolesReset = () => {
      console.log('Sidebar接收到rolesReset事件');
      const { AI_ROLES } = require('../utils/roles');
      setRoles(AI_ROLES);
    };

    window.addEventListener('rolesUpdated', handleRolesUpdated);
    window.addEventListener('rolesReset', handleRolesReset);

    return () => {
      window.removeEventListener('rolesUpdated', handleRolesUpdated);
      window.removeEventListener('rolesReset', handleRolesReset);
    };
  }, []);

  // 处理主题切换
  const handleThemeToggle = () => {
    toggleTheme();
  };

  // 处理删除确认
  const handleDeleteConfirm = (conversation) => {
    setConversationToDelete(conversation);
    setDeleteModalOpen(true);
  };

  // 处理移动端会话选择（自动关闭侧边栏）
  const handleMobileConversationSelect = (conversationId) => {
    onSelectConversation(conversationId);
    // 在移动端且侧边栏展开时，选择会话后立即关闭侧边栏
    // 移除延迟逻辑，优化移动端性能
    if (window.innerWidth <= 768 && isOpen && !isCollapsed) {
      onToggle();
    }
  };

  // 确认删除
  const confirmDelete = () => {
    if (conversationToDelete) {
      onDeleteConversation(conversationToDelete.id);
    }
    setDeleteModalOpen(false);
    setConversationToDelete(null);
    
    // 移动端优化：删除后立即关闭侧边栏，避免卡顿
    if (window.innerWidth <= 768 && isOpen && !isCollapsed) {
      setTimeout(() => {
        onToggle();
      }, 50);
    }
  };

  // 取消删除
  const cancelDelete = () => {
    setDeleteModalOpen(false);
    setConversationToDelete(null);
  };

  
  // 过滤对话
  const filteredConversations = useMemo(() => {
    let filtered = conversations;

    // 按角色筛选
    if (selectedRoleFilter !== "all") {
      filtered = filtered.filter(
        (conversation) => conversation.role === selectedRoleFilter
      );
    }

    // 按搜索关键词筛选
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (conversation) =>
          conversation.title
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          conversation.messages.some((message) =>
            message.content.toLowerCase().includes(searchQuery.toLowerCase())
          )
      );
    }

    return filtered;
  }, [conversations, searchQuery, selectedRoleFilter]);

  // 分组对话
  const groupedConversations = useMemo(() => {
    const today = new Date();
    const todayStr = today.toDateString();

    const todayConversations = filteredConversations.filter((conv) => {
      const date = new Date(conv.createdAt);
      return date.toDateString() === todayStr;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // 按创建时间倒序排列

    const previousConversations = filteredConversations.filter((conv) => {
      const date = new Date(conv.createdAt);
      return date.toDateString() !== todayStr;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // 按创建时间倒序排列

    return { today: todayConversations, previous: previousConversations };
  }, [filteredConversations]);

  return (
    <>
      {isOpen && !isCollapsed && <div className="sidebar-overlay" onClick={onToggle} />}
      <div
        className={`sidebar glass-pane ${isOpen ? "open" : ""} ${
          isCollapsed ? "collapsed" : ""
        }`}
      >
        <div className="sidebar-header">
          <div className="header-top">
            <button className="new-chat-btn" onClick={onNewConversation}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14m-7-7h14" />
              </svg>
              {!isCollapsed && <span>{t("newChat", currentLanguage)}</span>}
            </button>
          </div>

          {!isCollapsed && (
            <div className="search-container">
              <div className="search-input-wrapper">
                {/* <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="search-icon"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg> */}
                <input
                  type="text"
                  placeholder="搜索Bobby的记忆... 🔮"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                {searchQuery && (
                  <button
                    className="clear-search-btn"
                    onClick={() => setSearchQuery("")}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              {/* 角色筛选 */}
              <div className="role-filter-container" ref={roleFilterRef}>
                <button
                  className="role-filter-trigger"
                  onClick={() => setShowRoleFilter(!showRoleFilter)}
                >
                  <div className="role-filter-display">
                    {selectedRoleFilter === "all" ? (
                      <>
                        <span className="filter-icon">🎭</span>
                        <span className="filter-text">{currentLanguage === "zh" ? "所有角色" : "All Roles"}</span>
                      </>
                    ) : (
                      <>
                        <span
                          className="filter-icon"
                          style={{
                            color: getRoleById(selectedRoleFilter).color,
                          }}
                        >
                          {getRoleById(selectedRoleFilter).icon}
                        </span>
                        <span className="filter-text">
                          {getRoleById(selectedRoleFilter).name}
                        </span>
                      </>
                    )}
                  </div>
                  <svg
                    className={`filter-arrow ${showRoleFilter ? "open" : ""}`}
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {showRoleFilter && (
                  <div className="role-filter-dropdown">
                    <button
                      className={`role-filter-option ${
                        selectedRoleFilter === "all" ? "selected" : ""
                      }`}
                      onClick={() => {
                        setSelectedRoleFilter("all");
                        setShowRoleFilter(false);
                      }}
                    >
                      <span className="option-icon">🎭</span>
                      <span className="option-text">{currentLanguage === "zh" ? "所有角色" : "All Roles"}</span>
                      {selectedRoleFilter === "all" && (
                        <svg
                          className="check-icon"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="m9 12 2 2 4-4" />
                        </svg>
                      )}
                    </button>
                    {roles.map((role) => (
                      <button
                        key={role.id}
                        className={`role-filter-option ${
                          selectedRoleFilter === role.id ? "selected" : ""
                        }`}
                        onClick={() => {
                          setSelectedRoleFilter(role.id);
                          setShowRoleFilter(false);
                        }}
                      >
                        <span
                          className="option-icon"
                          style={{ color: role.color }}
                        >
                          {role.icon}
                        </span>
                        <span className="option-text">{role.name}</span>
                        {selectedRoleFilter === role.id && (
                          <svg
                            className="check-icon"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="m9 12 2 2 4-4" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 角色模型管理按钮 */}
        {!isCollapsed && (
          <div className="role-model-section">
            <button
              className="role-model-button"
              onClick={() => setRoleModelManagerOpen(true)}
              title={currentLanguage === "zh" ? "角色与模型管理" : "Role & Model Management"}
            >
              <div className="role-model-icon">
             

    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" >{/* Icon from Iconoir by Luca Burgio - https://github.com/iconoir-icons/iconoir/blob/main/LICENSE */}<g fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 16V8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 14.5s-1.5 2-4.5 2s-4.5-2-4.5-2" /><path fill="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M8.5 10a.5.5 0 1 1 0-1a.5.5 0 0 1 0 1m7 0a.5.5 0 1 1 0-1a.5.5 0 0 1 0 1" /></g></svg>
 
              </div>
              <span className="role-model-text">
                {currentLanguage === "zh" ? "角色 / 模型管理" : "Roles & Models"}
              </span>
            </button>
          </div>
        )}

        {/* 知识库按钮 - 仅在Tauri环境显示 */}
        {!isCollapsed && isTauriEnvironment() && (
          <div className="knowledge-base-section">
            <button
              className="knowledge-base-button"
              onClick={onOpenKnowledgeBase}
              title={currentLanguage === "zh" ? "知识库管理" : "Knowledge Base"}
            >
              <div className="knowledge-base-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  <path d="M8 7h8"/>
                  <path d="M8 11h8"/>
                  <path d="M8 15h5"/>
                </svg>
              </div>
              <span className="knowledge-base-text">
                {currentLanguage === "zh" ? "知识库" : "Knowledge Base"}
              </span>
            </button>
          </div>
        )}

        <div className="conversations-list">
          {isCollapsed ? (
            // 收起状态：只显示图标
            <div className="collapsed-conversations">
              {/* 今日 */}
              {groupedConversations.today.length > 0 && (
                <>
                  {([...groupedConversations.today]
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 50)).map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`conversation-item collapsed ${
                        currentConversationId === conversation.id ? "active" : ""
                      }`}
                      onClick={() => handleMobileConversationSelect(conversation.id)}
                      title={conversation.title}
                    >
                      <div className="role-avatar" style={{ color: getRoleById(conversation.role)?.color }}>
                        {conversation.role ? (getRoleById(conversation.role)?.avatar) : "💬"}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* 分割线，仅当两组都存在时显示 */}
              {groupedConversations.today.length > 0 && groupedConversations.previous.length > 0 && (
                <div className="collapsed-divider" />
              )}

              {/* 之前 */}
              {groupedConversations.previous.length > 0 && (
                <>
                  {([...groupedConversations.previous]
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 50)).map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`conversation-item collapsed ${
                        currentConversationId === conversation.id ? "active" : ""
                      }`}
                      onClick={() => handleMobileConversationSelect(conversation.id)}
                      title={conversation.title}
                    >
                      <div className="role-avatar" style={{ color: getRoleById(conversation.role)?.color }}>
                        {conversation.role ? (getRoleById(conversation.role)?.avatar) : "💬"}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : (
            // 展开状态：显示完整内容
            <>
              {(searchQuery || selectedRoleFilter !== "all") && (
                <div className="search-results-info">
                  {searchQuery && selectedRoleFilter !== "all" ? (
                    <>
                      <span
                        className="filter-icon"
                        style={{ color: getRoleById(selectedRoleFilter).color }}
                      >
                        {getRoleById(selectedRoleFilter).icon}
                      </span>
                      找到 {filteredConversations.length} 个"
                      {getRoleById(selectedRoleFilter).name}"的结果
                    </>
                  ) : searchQuery ? (
                    <>🔍 找到 {filteredConversations.length} 个搜索结果</>
                  ) : (
                    <>
                      <span
                        className="filter-icon"
                        style={{ color: getRoleById(selectedRoleFilter).color }}
                      >
                        {getRoleById(selectedRoleFilter).icon}
                      </span>
                      {filteredConversations.length} 个"
                      {getRoleById(selectedRoleFilter).name}"对话
                    </>
                  )}
                </div>
              )}

              {groupedConversations.today.length > 0 && (
                <div className="conversations-section">
                  <div className="section-title">{currentLanguage === "zh" ? "今天" : "Today"}</div>
                  {groupedConversations.today.map((conversation) => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      isActive={currentConversationId === conversation.id}
                      onSelect={handleMobileConversationSelect}
                      onDelete={handleDeleteConfirm}
                      onUpdateTitle={(id, title) => onUpdateConversation(id, { title })}
                      searchQuery={searchQuery}
                      currentLanguage={currentLanguage}
                    />
                  ))}
                </div>
              )}

              {groupedConversations.previous.length > 0 && (
                <div className="conversations-section">
                  <div className="section-title">
                    {searchQuery ? 
                      (currentLanguage === "zh" ? "其他结果" : "Other Results") : 
                      (currentLanguage === "zh" ? "之前" : "Previous")
                    }
                  </div>
                  {groupedConversations.previous.map((conversation) => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      isActive={currentConversationId === conversation.id}
                      onSelect={handleMobileConversationSelect}
                      onDelete={handleDeleteConfirm}
                      onUpdateTitle={(id, title) => onUpdateConversation(id, { title })}
                      searchQuery={searchQuery}
                      currentLanguage={currentLanguage}
                    />
                  ))}
                </div>
              )}

              {filteredConversations.length === 0 && searchQuery && (
                <div className="no-results">
                  <div className="no-results-icon">🙀</div>
                  <div className="no-results-text">Bobby找不到相关记忆</div>
                  <div className="no-results-hint">试试其他关键词喵~ 🐱</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部按钮区域 */}
        <div className="sidebar-footer">
          <div className="footer-buttons">
            {/* 关于按钮 */}
            <button
              className="theme-toggle-btn"
              onClick={onOpenAbout}
              title="关于"
            >
           

    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 512 512" >{/* Icon from Siemens Industrial Experience Icons by Siemens AG - https://github.com/siemens/ix-icons/blob/main/LICENSE.md */}<path fill="currentColor" fillRule="evenodd" d="M256 42.667C138.18 42.667 42.667 138.179 42.667 256c0 117.82 95.513 213.334 213.333 213.334c117.822 0 213.334-95.513 213.334-213.334S373.822 42.667 256 42.667m0 384c-94.105 0-170.666-76.561-170.666-170.667S161.894 85.334 256 85.334c94.107 0 170.667 76.56 170.667 170.666S350.107 426.667 256 426.667m26.714-256c0 15.468-11.262 26.667-26.497 26.667c-15.851 0-26.837-11.2-26.837-26.963c0-15.15 11.283-26.37 26.837-26.37c15.235 0 26.497 11.22 26.497 26.666m-48 64h42.666v128h-42.666z" /></svg>

            </button>

            {/* 设置按钮 */}
            <button
              className="theme-toggle-btn"
              onClick={onOpenSettings}
              title={t("settings", currentLanguage)}
            >
             

    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" >{/* Icon from Material Symbols by Google - https://github.com/google/material-design-icons/blob/master/LICENSE */}<path fill="currentColor" d="m9.25 22l-.4-3.2q-.325-.125-.612-.3t-.563-.375L4.7 19.375l-2.75-4.75l2.575-1.95Q4.5 12.5 4.5 12.338v-.675q0-.163.025-.338L1.95 9.375l2.75-4.75l2.975 1.25q.275-.2.575-.375t.6-.3l.4-3.2h5.5l.4 3.2q.325.125.613.3t.562.375l2.975-1.25l2.75 4.75l-2.575 1.95q.025.175.025.338v.674q0 .163-.05.338l2.575 1.95l-2.75 4.75l-2.95-1.25q-.275.2-.575.375t-.6.3l-.4 3.2zM11 20h1.975l.35-2.65q.775-.2 1.438-.587t1.212-.938l2.475 1.025l.975-1.7l-2.15-1.625q.125-.35.175-.737T17.5 12t-.05-.787t-.175-.738l2.15-1.625l-.975-1.7l-2.475 1.05q-.55-.575-1.212-.962t-1.438-.588L13 4h-1.975l-.35 2.65q-.775.2-1.437.588t-1.213.937L5.55 7.15l-.975 1.7l2.15 1.6q-.125.375-.175.75t-.05.8q0 .4.05.775t.175.75l-2.15 1.625l.975 1.7l2.475-1.05q.55.575 1.213.963t1.437.587zm1.05-4.5q1.45 0 2.475-1.025T15.55 12t-1.025-2.475T12.05 8.5q-1.475 0-2.488 1.025T8.55 12t1.013 2.475T12.05 15.5M12 12" /></svg>

            </button>

            {/* 主题切换按钮 */}
            <button
              className="theme-toggle-btn"
              onClick={handleThemeToggle}
              title={
                currentTheme === "dark" ? "切换到明亮模式" : "切换到暗夜模式"
              }
            >
              {currentTheme === "dark" ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            {/* 语言切换按钮 */}
            <LanguageToggle />
          </div>

          {/* 收起按钮 - 右对齐 */}
          <button
            className="theme-toggle-btn"
            onClick={onToggleCollapse}
            title={isCollapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                transform: isCollapsed ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.3s ease",
              }}
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* 删除确认Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        title={conversationToDelete?.title}
        currentLanguage={currentLanguage}
      />

      {/* 角色模型管理Modal */}
      <RoleModelManager
        isOpen={roleModelManagerOpen}
        onClose={() => setRoleModelManagerOpen(false)}
      />
      
          </>
  );
};

// 对话项组件
const ConversationItem = ({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onUpdateTitle,
  searchQuery,
  currentLanguage,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);
  const [showMenu, setShowMenu] = useState(false);
  const inputRef = useRef(null);
  const menuRef = useRef(null);

  // 开始编辑
  const startEdit = (e) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditTitle(conversation.title);
  };

  // 保存编辑
  const saveEdit = () => {
    if (editTitle.trim() && editTitle.trim() !== conversation.title) {
      onUpdateTitle(conversation.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  // 取消编辑
  const cancelEdit = () => {
    setIsEditing(false);
    setEditTitle(conversation.title);
  };

  // 处理删除确认
  const handleDeleteClick = (e) => {
    e.stopPropagation();
    onDelete(conversation);
  };

  // 取消删除确认
  const cancelDelete = (e) => {
    e.stopPropagation();
  };

  // 处理菜单点击
  const handleMenuClick = (e) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  // 处理重命名
  const handleRename = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    startEdit(e);
  };

  // 处理删除
  const handleDelete = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    handleDeleteClick(e);
  };

  
  // 处理键盘事件
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  // 当进入编辑模式时自动聚焦
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 高亮搜索关键词
  const highlightText = (text, query) => {
    if (!query) return text;

    const regex = new RegExp(`(${query})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="search-highlight">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div
      className={`conversation-item ${isActive ? "active" : ""}`}
      onClick={() => onSelect(conversation.id)}
    >
      <div className="conversation-icon">
        {conversation.role ? (
          <span
            className="role-avatar"
            style={{ color: getRoleById(conversation.role).color }}
          >
            {getRoleById(conversation.role).avatar}
          </span>
        ) : (
          <span className="cat-chat-icon">💬</span>
        )}
      </div>
      <div className="conversation-content">
        <div className="conversation-title">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={saveEdit}
              className="title-edit-input"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span onDoubleClick={startEdit} className={conversation.isTitleGenerating ? "title-generating" : ""} title={conversation.title}>
              {conversation.isTitleGenerating && (
                <span className="title-loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              )}
              <span className="title-text">
                {highlightText(conversation.title, searchQuery)}
              </span>
            </span>
          )}
        </div>
        <div className="conversation-role-row">
          {conversation.role && (
            <div
              className="conversation-role"
              style={{ color: getRoleById(conversation.role).color }}
            >
              {getRoleById(conversation.role).name}
            </div>
          )}
          <div className={`conversation-actions${showMenu ? " menu-open" : ""}`}>
            <button
              className="menu-btn"
              onClick={handleMenuClick}
              title={currentLanguage === "zh" ? "更多操作" : "More Options"}
              ref={menuRef}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="1" />
                <circle cx="19" cy="12" r="1" />
                <circle cx="5" cy="12" r="1" />
              </svg>
              {showMenu && (
                <div className="conversation-menu">
                  {conversation.role && (
                    <button
                      className="menu-item"
                      onClick={handleRename}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      <span>{currentLanguage === "zh" ? "重命名对话" : "Rename conversation"}</span>
                    </button>
                  )}
                                    <button
                    className="menu-item"
                    onClick={handleDelete}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    <span>{currentLanguage === "zh" ? "删除对话" : "Delete conversation"}</span>
                  </button>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
