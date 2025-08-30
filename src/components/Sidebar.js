import React, { useState, useMemo, useRef, useEffect } from "react";
import { AI_ROLES, getRoleById } from "../utils/roles";
import { getCurrentTheme, toggleTheme } from "../utils/theme";
import { getCurrentLanguage, t } from "../utils/language";
import LanguageToggle from "./LanguageToggle";
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
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("all");
  const [showRoleFilter, setShowRoleFilter] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => getCurrentTheme());
  const [currentLanguage, setCurrentLanguage] = useState(() => getCurrentLanguage());
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

  // 处理主题切换
  const handleThemeToggle = () => {
    toggleTheme();
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
    });

    const previousConversations = filteredConversations.filter((conv) => {
      const date = new Date(conv.createdAt);
      return date.toDateString() !== todayStr;
    });

    return { today: todayConversations, previous: previousConversations };
  }, [filteredConversations]);

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onToggle} />}
      <div
        className={`sidebar ${isOpen ? "open" : ""} ${
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
                <svg
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
                </svg>
                <input
                  type="text"
                  placeholder="搜索Bobby的记忆... 🔍"
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
                    {AI_ROLES.map((role) => (
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

        <div className="conversations-list">
          {isCollapsed ? (
            // 收起状态：只显示图标
            <div className="collapsed-conversations">
              {filteredConversations.slice(0, 10).map((conversation) => (
                <div
                  key={conversation.id}
                  className={`conversation-item collapsed ${
                    currentConversationId === conversation.id ? "active" : ""
                  }`}
                  onClick={() => onSelectConversation(conversation.id)}
                  title={conversation.title}
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
                </div>
              ))}
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
                      onSelect={onSelectConversation}
                      onDelete={onDeleteConversation}
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
                      onSelect={onSelectConversation}
                      onDelete={onDeleteConversation}
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
            {/* 设置按钮 */}
            <button
              className="settings-btn"
              onClick={onOpenSettings}
              title={t("settings", currentLanguage)}
            >
              <div className="bobby-avatar">🐱</div>
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
            className="collapse-toggle-btn"
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
  const inputRef = useRef(null);

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
            <span onDoubleClick={startEdit} className={conversation.isTitleGenerating ? "title-generating" : ""}>
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
        {conversation.role && (
          <div
            className="conversation-role"
            style={{ color: getRoleById(conversation.role).color }}
          >
            {getRoleById(conversation.role).name}
          </div>
        )}
      </div>
      <div className="conversation-actions">
        {!isEditing && (
          <button
            className="edit-btn"
            onClick={startEdit}
            title={currentLanguage === "zh" ? "编辑标题" : "Edit Title"}
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
          </button>
        )}
        <button
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(conversation.id);
          }}
          title={currentLanguage === "zh" ? "删除对话" : "Delete Chat"}
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
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
