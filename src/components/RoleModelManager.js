import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AI_ROLES, updateGlobalRoles } from "../utils/roles";
import { getCurrentLanguage } from "../utils/language";
import {
  dbManager,
  getAllRoles,
  getAllModelGroups,
  getAllModels,
  saveModelGroup,
  saveModel,
  deleteModelGroup,
  deleteModel,
} from "../utils/database";
import {
  DEFAULT_MODEL_GROUPS,
  DEFAULT_MODELS,
  mergeModelsWithDefaults,
} from "../utils/defaultModelConfig";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "./RoleModelManager.css";

const SortableRoleCard = ({ role, loading, onEdit, onDelete, index }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: role.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="role-card">
      <div className="role-info">
        {/* PC端排序号，移动端隐藏 */}
        <div className="sort-order-number">{index + 1}</div>
        <div className="drag-handle" {...attributes} {...listeners}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </div>
        <div className="role-avatar" style={{ backgroundColor: role.color }}>
          {role.icon}
        </div>
        <div className="role-details">
          <h4>{role.name}</h4>
          <p>{role.description}</p>
          <div className="role-params">
            <span>Temperature: {role.temperature}</span>
          </div>
        </div>
      </div>
      <div className="role-actions">
        <button
          className="edit-button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit(role);
          }}
          disabled={loading}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            {/* Icon from Material Symbols by Google - https://github.com/google/material-design-icons/blob/master/LICENSE */}
            <path d="M12 22q-4.025-3.425-6.012-6.362T4 10.2q0-3.75 2.413-5.975T12 2q.675 0 1.338.113t1.287.312L13 4.075q-.25-.05-.488-.062T12 4Q9.475 4 7.738 5.738T6 10.2q0 1.775 1.475 4.063T12 19.35q3.05-2.8 4.525-5.087T18 10.2q0-.3-.025-.6t-.075-.575l1.65-1.65q.225.65.338 1.35T20 10.2q0 2.5-1.987 5.438T12 22m6.35-18.15L17.2 2.7L11 8.9V11h2.1l6.2-6.2zM20 4.1l.7-.7q.275-.275.275-.7T20.7 2l-.7-.7q-.275-.275-.7-.275t-.7.275l-.7.7z" />
          </svg>
        </button>
        <button
          className="delete-button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(role.id);
          }}
          disabled={loading}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// 常用emoji选项
const EMOJI_OPTIONS = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😆",
  "😅",
  "😂",
  "🤣",
  "😊",
  "😇",
  "🙂",
  "😉",
  "😌",
  "😍",
  "🥰",
  "😘",
  "😗",
  "😙",
  "😚",
  "😋",
  "😛",
  "😝",
  "😜",
  "🤪",
  "🤨",
  "🧐",
  "🤓",
  "😎",
  "🤩",
  "🥳",
  "😏",
  "😒",
  "😞",
  "😔",
  "😟",
  "😕",
  "🙁",
  "☹️",
  "😣",
  "😖",
  "😫",
  "😩",
  "🥺",
  "😢",
  "😭",
  "😤",
  "😠",
  "😡",
  "🤬",
  "🤯",
  "😳",
  "🥵",
  "🥶",
  "😱",
  "😨",
  "😰",
  "😥",
  "😓",
  "🤗",
  "🤔",
  "🤭",
  "🤫",
  "🤥",
  "😶",
  "😐",
  "😑",
  "😬",
  "🙄",
  "😯",
  "😦",
  "😧",
  "😮",
  "😲",
  "🥱",
  "😴",
  "🤤",
  "😪",
  "😵",
  "🤐",
  "🥴",
  "🤢",
  "🤮",
  "🤧",
  "😷",
  "🤒",
  "🤕",
  "🤑",
  "🤠",
  "😈",
  "👿",
  "👹",
  "👺",
  "🤡",
  "💩",
  "👻",
  "💀",
  "☠️",
  "👽",
  "👾",
  "🤖",
  "🎃",
  "😺",
  "😸",
  "😹",
  "😻",
  "😼",
  "😽",
  "🙀",
  "😿",
  "😾",
  "🐶",
  "🐱",
  "🐭",
  "🐹",
  "🐰",
  "🦊",
  "🐻",
  "🐼",
  "🐨",
  "🐯",
  "🦁",
  "🐮",
  "🐷",
  "🐸",
  "🐵",
  "🙈",
  "🙉",
  "🙊",
  "🐒",
  "🐔",
  "🐧",
  "🐦",
  "🐤",
  "🐣",
  "🐥",
  "🦆",
  "🦅",
  "🦉",
  "🦇",
  "🐺",
  "🐗",
  "🐴",
  "🦄",
  "🐝",
  "🐛",
  "🦋",
  "🐌",
  "🐞",
  "🐜",
  "🦟",
  "🦗",
  "🕷️",
  "🦂",
  "🐢",
  "🐍",
  "🦎",
  "🦖",
  "🦕",
  "🐙",
  "🦑",
  "🦐",
  "🦞",
  "🦀",
  "🐡",
  "🐠",
  "🐟",
  "🐬",
  "🐳",
  "🐋",
  "🦈",
  "🐊",
  "🐅",
  "🐆",
  "🦓",
  "🦍",
  "🦧",
  "🐘",
  "🦛",
  "🦏",
  "🐪",
  "🐫",
  "🦒",
  "🦘",
  "🦬",
  "🐃",
  "🐂",
  "🐄",
  "🐎",
  "🐖",
  "🐏",
  "🦙",
  "🐐",
  "🦌",
  "🐕",
  "🐩",
  "🦮",
  "🐈",
  "🐓",
  "🦃",
  "🦚",
  "🦜",
  "🦢",
  "🦩",
  "🕊️",
  "🐇",
  "🦝",
  "🦨",
  "🦡",
  "🦦",
  "🦥",
  "🐁",
  "🐀",
  "🐿️",
  "🦔",
  "🐾",
  "🐉",
  "🐲",
  "🌵",
  "🎄",
  "🌲",
  "🌳",
  "🌴",
  "🌱",
  "🌿",
  "☘️",
  "🍀",
  "🎍",
  "🎋",
  "🍃",
  "🍂",
  "🍁",
  "🍄",
  "🐚",
  "🌾",
  "💐",
  "🌷",
  "🌹",
  "🥀",
  "🌺",
  "🌸",
  "🌼",
  "🌻",
  "🌞",
  "🌝",
  "🌛",
  "🌜",
  "🌚",
  "🌕",
  "🌖",
  "🌗",
  "🌘",
  "🌑",
  "🌒",
  "🌓",
  "🌔",
  "⭐",
  "🌟",
  "💫",
  "✨",
  "☄️",
  "☀️",
  "🌤️",
  "⛅",
  "🌥️",
  "☁️",
  "🌦️",
  "🌧️",
  "⛈️",
  "🌩️",
  "❄️",
  "☃️",
  "⛄",
  "🌬️",
  "💨",
  "🌪️",
  "🌫️",
  "🌊",
  "💧",
  "💦",
  "☔",
  "👨‍💼",
  "👩‍💼",
  "👨‍🔬",
  "👩‍🔬",
  "👨‍🎨",
  "👩‍🎨",
  "👨‍🏭",
  "👩‍🏭",
  "👨‍💻",
  "👩‍💻",
  "👨‍🎤",
  "👩‍🎤",
  "👨‍🎧",
  "👩‍🎧",
  "👨‍🎭",
  "👩‍🎭",
  "👨‍🏫",
  "👩‍🏫",
  "👨‍🏢",
  "👩‍🏢",
  "👨‍🌾",
  "👩‍🌾",
  "👨‍🍳",
  "👩‍🍳",
  "👨‍🔧",
  "👩‍🔧",
  "👨‍🔨",
  "👩‍🔨",
  "👨‍⚖️",
  "👩‍⚖️",
  "👨‍✈️",
  "👩‍✈️",
  "👨‍🚀",
  "👩‍🚀",
  "👨‍⚕️",
  "👩‍⚕️",
  "👨‍🌾",
  "👩‍🌾",
  "👨‍🎯",
  "👩‍🎯",
  "🧑",
  "👨",
  "👩",
  "🧔",
  "👱",
  "👨‍🦰",
  "👩‍🦰",
  "👨‍🦱",
  "👩‍🦱",
  "👨‍🦲",
  "👩‍🦲",
  "👨‍🦳",
  "👩‍🦳",
  "🦱",
  "🦲",
  "🦳",
  "👨‍🦼",
  "👩‍🦼",
  "👨‍🦽",
  "👩‍🦽",
  "🦵",
  "🦿",
  "🦶",
  "👣",
  "👂",
  "🦻",
  "👃",
  "🧠",
  "🦷",
  "🦴",
  "👀",
  "👁️",
  "👅",
  "👄",
  "💋",
  "🩸",
  "💌",
  "👤",
  "👥",
  "🫂",
];

// Emoji选择器组件
const EmojiSelector = ({ value, onChange, currentLanguage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const selectorRef = useRef(null);

  // 过滤emoji选项
  const filteredEmojis = EMOJI_OPTIONS.filter((emoji) =>
    emoji.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="emoji-selector" ref={selectorRef}>
      <div
        className="emoji-selector-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="emoji-display">{value || "😀"}</span>
        <span className="emoji-arrow">▼</span>
      </div>

      {isOpen && (
        <div className="emoji-dropdown">
          <div className="emoji-search">
            <input
              type="text"
              placeholder={
                currentLanguage === "zh" ? "搜索emoji..." : "Search emoji..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="emoji-grid">
            {filteredEmojis.map((emoji, index) => (
              <div
                key={index}
                className="emoji-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(emoji);
                  setIsOpen(false);
                  setSearchTerm("");
                }}
              >
                {emoji}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const RoleModelManager = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState("roles"); // 'roles' or 'models'
  const [roles, setRoles] = useState([...AI_ROLES]);
  const [editingRole, setEditingRole] = useState(null);
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [modelGroups, setModelGroups] = useState([]);
  const [models, setModels] = useState([]);
  const [editingModel, setEditingModel] = useState(null);
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState("siliconflow");

  const currentLanguage = getCurrentLanguage();

  // 拖拽传感器配置 - 优化移动端触摸支持
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 需要移动8px才开始拖拽，避免误触
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 角色编辑相关函数
  const handleEditRole = (role) => {
    setEditingRole({ ...role });
  };

  const handleSaveRole = async () => {
    console.log("=== 开始保存角色 ===");
    console.log("当前editingRole:", editingRole);
    console.log("当前roles列表:", roles);
    console.log("isAddingRole:", isAddingRole);

    if (editingRole) {
      // 确保有topP字段
      const roleToSave = {
        ...editingRole,
        topP: typeof editingRole.topP === "number" ? editingRole.topP : 1.0,
      };

      console.log("准备保存的角色:", roleToSave);

      // 验证输入参数
      const validationErrors = validateRoleInput(roleToSave);
      if (validationErrors.length > 0) {
        console.log("验证失败:", validationErrors);
        alert(
          currentLanguage === "zh"
            ? `输入验证失败:\n${validationErrors.join("\n")}`
            : `Input validation failed:\n${validationErrors.join("\n")}`
        );
        return;
      }

      try {
        setLoading(true);
        console.log("开始保存流程...");

        // 首先保存单个角色到数据库
        await dbManager.save("roles", roleToSave);
        console.log("已保存角色到数据库");

        // 重新从数据库获取完整的角色列表
        const allRoles = await getAllRoles();
        console.log("从数据库获取的角色列表:", allRoles);

        // 更新全局角色列表
        updateGlobalRoles(allRoles);
        console.log("已更新全局角色列表");

        // 更新本地状态
        setRoles(allRoles);
        setEditingRole(null);
        setIsAddingRole(false);

        // 如果是新添加的角色，自动选中它
        if (isAddingRole) {
          const { saveSelectedRole } = await import("../utils/roles");
          saveSelectedRole(roleToSave.id);
          console.log("新角色已自动选中:", roleToSave.id);
          // 触发角色选择变化事件，通知其他组件
          window.dispatchEvent(new CustomEvent("roleChanged"));
        }

        console.log("状态已更新");

        setLoading(false);
        console.log("=== 保存流程完成 ===");
      } catch (error) {
        console.error("保存角色失败:", error);
        // 降级到localStorage
        try {
          let updatedRoles;
          if (isAddingRole) {
            updatedRoles = [...roles, roleToSave];
          } else {
            updatedRoles = roles.map((role) =>
              role.id === roleToSave.id ? roleToSave : role
            );
          }

          localStorage.setItem("custom-roles", JSON.stringify(updatedRoles));
          updateGlobalRoles(updatedRoles);
          setRoles(updatedRoles);
          setEditingRole(null);
          setIsAddingRole(false);

          // 如果是新添加的角色，自动选中它
          if (isAddingRole) {
            const { saveSelectedRole } = await import("../utils/roles");
            saveSelectedRole(roleToSave.id);
            console.log("新角色已自动选中（降级模式）:", roleToSave.id);
            // 触发角色选择变化事件，通知其他组件
            window.dispatchEvent(new CustomEvent("roleChanged"));
          }
        } catch (fallbackError) {
          console.error("降级保存也失败:", fallbackError);
        }
        setLoading(false);
      }
    }
  };

  // 验证角色输入参数
  const validateRoleInput = (role) => {
    const errors = [];

    // 验证角色名称
    if (!role.name || role.name.trim().length === 0) {
      errors.push(
        currentLanguage === "zh"
          ? "角色名称不能为空"
          : "Role name cannot be empty"
      );
    }

    // 验证Temperature
    if (typeof role.temperature !== "number" || isNaN(role.temperature)) {
      errors.push(
        currentLanguage === "zh"
          ? "Temperature必须是数字"
          : "Temperature must be a number"
      );
    } else if (role.temperature < 0 || role.temperature > 2) {
      errors.push(
        currentLanguage === "zh"
          ? "Temperature必须在0到2之间"
          : "Temperature must be between 0 and 2"
      );
    }

    // 验证Top P (兼容旧数据)
    const topP = typeof role.topP === "number" ? role.topP : 1.0;
    if (isNaN(topP)) {
      errors.push(
        currentLanguage === "zh" ? "Top P必须是数字" : "Top P must be a number"
      );
    } else if (topP < 0 || topP > 1) {
      errors.push(
        currentLanguage === "zh"
          ? "Top P必须在0到1之间"
          : "Top P must be between 0 and 1"
      );
    }

    // 验证头像
    if (!role.icon || role.icon.trim().length === 0) {
      errors.push(
        currentLanguage === "zh" ? "图标不能为空" : "Icon cannot be empty"
      );
    }

    // 验证系统提示词
    if (!role.systemPrompt || role.systemPrompt.trim().length === 0) {
      errors.push(
        currentLanguage === "zh"
          ? "系统提示词不能为空"
          : "System prompt cannot be empty"
      );
    }

    return errors;
  };

  // 拖拽结束处理
  const handleDragEnd = async (event) => {
    const { active, over } = event;

    // 恢复页面滚动
    document.body.style.overflow = "";

    if (active.id !== over.id) {
      setRoles((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);

        // 立即更新全局状态
        updateGlobalRoles(newItems);

        // 异步保存到数据库
        saveRolesToDatabase(newItems).catch((error) => {
          console.error("拖拽排序保存到数据库失败:", error);
          // 降级到localStorage
          localStorage.setItem("custom-roles", JSON.stringify(newItems));
        });

        return newItems;
      });
    }
  };

  // 保存角色到数据库
  const saveRolesToDatabase = async (rolesToSave) => {
    try {
      // 逐个保存角色到数据库（支持IndexedDB和SQLite），添加sortOrder字段
      for (let i = 0; i < rolesToSave.length; i++) {
        const roleWithSort = {
          ...rolesToSave[i],
          sortOrder: i,
        };
        await dbManager.save("roles", roleWithSort);
      }
    } catch (error) {
      console.error("保存角色到数据库失败:", error);
    }
  };

  const handleDeleteRole = async (roleId) => {
    console.log("删除角色被点击:", roleId); // 调试日志
    if (
      window.confirm(
        currentLanguage === "zh"
          ? "确定要删除这个角色吗？"
          : "Are you sure you want to delete this role?"
      )
    ) {
      try {
        // 从数据库删除
        await dbManager.delete("roles", roleId);
        console.log("已从数据库删除角色");

        // 重新从数据库获取角色列表
        const allRoles = await getAllRoles();
        console.log("从数据库获取的角色列表:", allRoles);

        // 更新状态
        setRoles(allRoles);
        updateGlobalRoles(allRoles);
        console.log("角色删除成功"); // 调试日志
      } catch (error) {
        console.error("删除角色失败:", error);
        // 降级到localStorage
        try {
          const updatedRoles = roles.filter((role) => role.id !== roleId);
          setRoles(updatedRoles);
          localStorage.setItem("custom-roles", JSON.stringify(updatedRoles));
          updateGlobalRoles(updatedRoles);
          console.log("角色删除成功（降级模式）"); // 调试日志
        } catch (fallbackError) {
          console.error("降级删除也失败:", fallbackError);
        }
      }
    }
  };

  const handleAddRole = () => {
    const newRole = {
      id: `custom-${Date.now()}`,
      name: currentLanguage === "zh" ? "新角色" : "New Role",
      icon: "🤖",
      description: currentLanguage === "zh" ? "自定义角色" : "Custom role",
      temperature: 0.7,
      topP: 1.0,
      systemPrompt:
        currentLanguage === "zh"
          ? "你是一个有帮助的AI助手。"
          : "You are a helpful AI assistant.",
      color: "#6366f1",
      sortOrder: roles.length,
    };
    setEditingRole(newRole);
    setIsAddingRole(true);
  };

  const handleResetRoles = async () => {
    if (
      window.confirm(
        currentLanguage === "zh"
          ? "确定要重置所有角色为默认设置吗？这将删除所有自定义角色。"
          : "Are you sure you want to reset all roles to default settings? This will delete all custom roles."
      )
    ) {
      try {
        // 清除数据库中的所有自定义角色（除了默认角色）
        const defaultRoleIds = [
          "bobby",
          "developer",
          "creative",
          "analyst",
          "teacher",
          "writer",
        ];
        const allRoles = await getAllRoles();

        // 删除非默认角色
        for (const role of allRoles) {
          if (!defaultRoleIds.includes(role.id)) {
            await dbManager.delete("roles", role.id);
          }
        }

        // 重新获取角色列表（应该只有默认角色了）
        const remainingRoles = await getAllRoles();

        // 如果默认角色不存在，添加它们
        const defaultRoles = [...AI_ROLES];
        for (const defaultRole of defaultRoles) {
          if (!remainingRoles.find((role) => role.id === defaultRole.id)) {
            await dbManager.save("roles", defaultRole);
          }
        }

        // 获取最终的角色列表
        const finalRoles = await getAllRoles();

        // 更新状态
        setRoles(finalRoles);
        updateGlobalRoles(finalRoles);

        // 清除localStorage中的缓存
        localStorage.removeItem("custom-roles");
        localStorage.removeItem("ai-roles-updated");

        // 触发重置事件
        window.dispatchEvent(new CustomEvent("rolesReset"));

        console.log("角色重置完成");
      } catch (error) {
        console.error("重置角色失败:", error);
        // 降级处理
        setRoles([...AI_ROLES]);
        localStorage.removeItem("custom-roles");
        localStorage.removeItem("ai-roles-updated");
        window.dispatchEvent(new CustomEvent("rolesReset"));
      }
    }
  };

  // 模型分组管理相关函数
  const handleAddGroup = () => {
    const newGroup = {
      id: `group-${Date.now()}`,
      name: currentLanguage === "zh" ? "新分组" : "New Group",
      provider: selectedProvider,
      description: "",
      sortOrder: modelGroups.length,
    };
    setEditingGroup(newGroup);
    setIsAddingGroup(true);
  };

  const handleEditGroup = (group) => {
    setEditingGroup({ ...group });
  };

  const handleSaveGroup = async () => {
    if (editingGroup) {
      try {
        setLoading(true);

        // 检查是否为默认分组
        const isDefaultGroup = DEFAULT_MODEL_GROUPS.some(
          (g) => g.id === editingGroup.id
        );

        const groupToSave = {
          ...editingGroup,
          isDefault: isDefaultGroup,
          isModified: isDefaultGroup && !isAddingGroup, // 标记修改的默认分组
          createdAt: editingGroup.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await saveModelGroup(groupToSave);

        // 重新加载数据以保持混合逻辑的一致性
        const savedGroups = (await getAllModelGroups()) || [];
        const savedModels = (await getAllModels()) || [];

        const { mergedGroups, mergedModels } = mergeModelsWithDefaults(
          DEFAULT_MODEL_GROUPS,
          DEFAULT_MODELS,
          savedGroups,
          savedModels
        );

        setModelGroups(mergedGroups);
        setModels(mergedModels);

        setEditingGroup(null);
        setIsAddingGroup(false);
        setLoading(false);
      } catch (error) {
        console.error("保存分组失败:", error);
        setLoading(false);
        alert(
          currentLanguage === "zh" ? "保存分组失败" : "Failed to save group"
        );
      }
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (
      window.confirm(
        currentLanguage === "zh"
          ? "确定要删除这个分组吗？这将同时删除分组下的所有模型。"
          : "Are you sure you want to delete this group? This will also delete all models in this group."
      )
    ) {
      try {
        setLoading(true);

        // 检查是否为默认分组
        const isDefaultGroup = DEFAULT_MODEL_GROUPS.some(
          (g) => g.id === groupId
        );

        if (isDefaultGroup) {
          alert(
            currentLanguage === "zh"
              ? "不能删除默认分组，但可以禁用其中的模型"
              : "Cannot delete default groups, but you can disable models within them"
          );
          setLoading(false);
          return;
        }

        await deleteModelGroup(groupId);

        // 重新加载数据以保持混合逻辑的一致性
        const savedGroups = (await getAllModelGroups()) || [];
        const savedModels = (await getAllModels()) || [];

        const { mergedGroups, mergedModels } = mergeModelsWithDefaults(
          DEFAULT_MODEL_GROUPS,
          DEFAULT_MODELS,
          savedGroups,
          savedModels
        );

        setModelGroups(mergedGroups);
        setModels(mergedModels);

        setLoading(false);
      } catch (error) {
        console.error("删除分组失败:", error);
        setLoading(false);
        alert(
          currentLanguage === "zh" ? "删除分组失败" : "Failed to delete group"
        );
      }
    }
  };

  // 模型管理相关函数
  const handleToggleModel = async (modelId) => {
    try {
      const updatedModels = models.map((model) =>
        model.id === modelId ? { ...model, enabled: !model.enabled } : model
      );
      setModels(updatedModels);

      // 检查是否为默认模型
      const isDefaultModel = DEFAULT_MODELS.some((m) => m.id === modelId);
      const modelToUpdate = updatedModels.find((m) => m.id === modelId);

      if (modelToUpdate) {
        const modelToSave = {
          ...modelToUpdate,
          isDefault: isDefaultModel,
          isModified: isDefaultModel, // 标记修改的默认模型
        };

        await saveModel(modelToSave);
      }
    } catch (error) {
      console.error("更新模型状态失败:", error);
      alert(
        currentLanguage === "zh"
          ? "更新模型状态失败"
          : "Failed to update model status"
      );
    }
  };

  const handleEditModel = (model) => {
    setEditingModel({ ...model });
  };

  const handleSaveModel = async () => {
    if (editingModel) {
      try {
        setLoading(true);

        // 检查是否为默认模型
        const isDefaultModel = DEFAULT_MODELS.some(
          (m) => m.id === editingModel.id
        );

        const modelToSave = {
          ...editingModel,
          isDefault: isDefaultModel,
          isModified: isDefaultModel && !isAddingModel, // 标记修改的默认模型
          createdAt: editingModel.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await saveModel(modelToSave);

        // 重新加载数据以保持混合逻辑的一致性
        const savedGroups = (await getAllModelGroups()) || [];
        const savedModels = (await getAllModels()) || [];

        const { mergedGroups, mergedModels } = mergeModelsWithDefaults(
          DEFAULT_MODEL_GROUPS,
          DEFAULT_MODELS,
          savedGroups,
          savedModels
        );

        setModelGroups(mergedGroups);
        setModels(mergedModels);

        setEditingModel(null);
        setIsAddingModel(false);
        setLoading(false);
      } catch (error) {
        console.error("保存模型失败:", error);
        setLoading(false);
        alert(
          currentLanguage === "zh" ? "保存模型失败" : "Failed to save model"
        );
      }
    }
  };

  const handleDeleteModel = async (modelId) => {
    if (
      window.confirm(
        currentLanguage === "zh"
          ? "确定要删除这个模型吗？"
          : "Are you sure you want to delete this model?"
      )
    ) {
      try {
        setLoading(true);

        // 检查是否为默认模型
        const isDefaultModel = DEFAULT_MODELS.some((m) => m.id === modelId);

        if (isDefaultModel) {
          alert(
            currentLanguage === "zh"
              ? "不能删除默认模型，但可以禁用它"
              : "Cannot delete default models, but you can disable them"
          );
          setLoading(false);
          return;
        }

        await deleteModel(modelId);

        // 重新加载数据以保持混合逻辑的一致性
        const savedGroups = (await getAllModelGroups()) || [];
        const savedModels = (await getAllModels()) || [];

        const { mergedGroups, mergedModels } = mergeModelsWithDefaults(
          DEFAULT_MODEL_GROUPS,
          DEFAULT_MODELS,
          savedGroups,
          savedModels
        );

        setModelGroups(mergedGroups);
        setModels(mergedModels);

        setLoading(false);
      } catch (error) {
        console.error("删除模型失败:", error);
        setLoading(false);
        alert(
          currentLanguage === "zh" ? "删除模型失败" : "Failed to delete model"
        );
      }
    }
  };

  const handleResetModels = async () => {
    if (
      window.confirm(
        currentLanguage === "zh"
          ? "确定要重置所有模型为默认设置吗？这将删除所有自定义模型和分组，以及所有修改。"
          : "Are you sure you want to reset all models to default settings? This will delete all custom models, groups and modifications."
      )
    ) {
      try {
        setLoading(true);

        // 清除数据库中的所有模型和分组数据
        try {
          const allGroups = await getAllModelGroups();
          const allModels = await getAllModels();

          for (const group of allGroups) {
            await dbManager.delete("modelGroups", group.id);
          }
          for (const model of allModels) {
            await dbManager.delete("models", model.id);
          }
          console.log("已清除所有模型数据");
        } catch (clearError) {
          console.warn("清除模型数据失败:", clearError);
        }

        // 重置为默认配置
        setModelGroups([...DEFAULT_MODEL_GROUPS]);
        setModels([...DEFAULT_MODELS]);

        setLoading(false);
      } catch (error) {
        console.error("重置模型失败:", error);
        setLoading(false);
        alert(
          currentLanguage === "zh" ? "重置模型失败" : "Failed to reset models"
        );
      }
    }
  };

  // 从数据库加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // 初始化数据库
        await dbManager.init();

        // 加载角色数据
        const savedRoles = await getAllRoles();
        console.log("从数据库加载的角色:", savedRoles);

        if (savedRoles && savedRoles.length > 0) {
          setRoles(savedRoles);
        } else {
          // 如果数据库中没有角色，初始化默认角色
          console.log("数据库中没有角色，初始化默认角色");
          const defaultRoles = [...AI_ROLES];
          for (const role of defaultRoles) {
            await dbManager.save("roles", role);
          }
          setRoles(defaultRoles);
        }

        // 加载模型分组和模型数据（首次初始化逻辑）
        try {
          const savedGroups = (await getAllModelGroups()) || [];
          const savedModels = (await getAllModels()) || [];

          console.log("从数据库加载的模型分组:", savedGroups);
          console.log("从数据库加载的模型:", savedModels);

          // 检查数据库是否为空（首次打开）
          const isDatabaseEmpty =
            savedGroups.length === 0 && savedModels.length === 0;

          if (isDatabaseEmpty) {
            // 首次打开，将默认模型同步到数据库
            console.log("首次打开，初始化默认模型到数据库");

            // 保存默认分组到数据库
            for (const group of DEFAULT_MODEL_GROUPS) {
              await dbManager.save("modelGroups", group);
            }

            // 保存默认模型到数据库
            for (const model of DEFAULT_MODELS) {
              await dbManager.save("models", model);
            }

            console.log("默认模型已同步到数据库");

            // 使用默认配置
            setModelGroups([...DEFAULT_MODEL_GROUPS]);
            setModels([...DEFAULT_MODELS]);
          } else {
            // 数据库有数据，使用合并逻辑（包含用户的自定义修改）
            console.log("数据库有数据，使用合并逻辑");
            const { mergedGroups, mergedModels } = mergeModelsWithDefaults(
              DEFAULT_MODEL_GROUPS,
              DEFAULT_MODELS,
              savedGroups,
              savedModels
            );

            console.log("合并后的模型分组:", mergedGroups);
            console.log("合并后的模型:", mergedModels);

            setModelGroups(mergedGroups);
            setModels(mergedModels);
          }
        } catch (error) {
          console.error("加载模型数据失败:", error);
          // 降级到默认配置
          setModelGroups([...DEFAULT_MODEL_GROUPS]);
          setModels([...DEFAULT_MODELS]);
        }

        setLoading(false);
      } catch (error) {
        console.error("加载数据失败:", error);
        setLoading(false);

        // 降级到localStorage
        const savedRoles = localStorage.getItem("custom-roles");
        if (savedRoles) {
          try {
            const parsedRoles = JSON.parse(savedRoles);
            setRoles(parsedRoles);
          } catch (error) {
            console.error("加载自定义角色失败:", error);
          }
        }
      }
    };

    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const content = (
    <div className="role-model-manager-overlay">
      <div className="role-model-manager">
        <div className="manager-header">
          <h2>
            {currentLanguage === "zh"
              ? "角色与模型管理"
              : "Role & Model Management"}
          </h2>
          <button className="close-button" onClick={onClose}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="manager-tabs">
          <button
            className={`tab-button ${activeTab === "roles" ? "active" : ""}`}
            onClick={() => setActiveTab("roles")}
          >
            {currentLanguage === "zh" ? "角色管理" : "Role Management"}
          </button>
          <button
            className={`tab-button ${activeTab === "models" ? "active" : ""}`}
            onClick={() => setActiveTab("models")}
          >
            {currentLanguage === "zh" ? "模型管理" : "Model Management"}
          </button>
        </div>

        <div className="manager-content">
          {activeTab === "roles" && (
            <div className="roles-section">
              <div className="section-header">
                <h3>
                  {currentLanguage === "zh" ? "AI角色列表" : "AI Roles List"}
                </h3>
                <div className="section-actions">
                  <button className="reset-button" onClick={handleResetRoles}>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                    {currentLanguage === "zh" ? "重置" : "Reset"}
                  </button>
                  <button className="add-button" onClick={handleAddRole}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    {currentLanguage === "zh" ? "添加角色" : "Add Role"}
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>{currentLanguage === "zh" ? "加载中..." : "Loading..."}</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                  onDragStart={() => {
                    // 拖拽开始时禁用页面滚动
                    document.body.style.overflow = "hidden";
                  }}
                  onDragCancel={() => {
                    // 拖拽取消时恢复页面滚动
                    document.body.style.overflow = "";
                  }}
                >
                  <SortableContext
                    items={roles.map((role) => role.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="roles-grid">
                      {roles.map((role, index) => (
                        <SortableRoleCard
                          key={role.id}
                          role={role}
                          loading={loading}
                          onEdit={handleEditRole}
                          onDelete={handleDeleteRole}
                          index={index}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          )}

          {activeTab === "models" && (
            <div className="models-section">
              <div className="section-header">
                <h3>
                  {currentLanguage === "zh"
                    ? "模型配置"
                    : "Model Configuration"}
                </h3>
                <div className="section-actions">
                  <button className="reset-button" onClick={handleResetModels}>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                    {currentLanguage === "zh" ? "重置" : "Reset"}
                  </button>
                </div>
              </div>

              {/* API供应商选择 */}
              <div className="api-providers-section">
                <h4>
                  {currentLanguage === "zh"
                    ? "选择API供应商"
                    : "Select API Provider"}
                </h4>
                <div className="providers-grid">
                  <div
                    className={`provider-card ${
                      selectedProvider === "siliconflow" ? "selected" : ""
                    }`}
                    onClick={() => setSelectedProvider("siliconflow")}
                  >
                    <div className="provider-icon">🌊</div>
                    <div className="provider-info">
                      <h5>SiliconFlow</h5>
                      <p>
                        {currentLanguage === "zh"
                          ? "硅基流动API服务"
                          : "SiliconFlow API Service"}
                      </p>
                    </div>
                    <div className="provider-status">
                      <div className="status-indicator active"></div>
                      <span>
                        {currentLanguage === "zh" ? "已连接" : "Connected"}
                      </span>
                    </div>
                  </div>

                  <div className="provider-card disabled">
                    <div className="provider-icon">🤖</div>
                    <div className="provider-info">
                      <h5>OpenAI</h5>
                      <p>
                        {currentLanguage === "zh" ? "即将推出" : "Coming Soon"}
                      </p>
                    </div>
                    <div className="provider-status">
                      <div className="status-indicator inactive"></div>
                      <span>
                        {currentLanguage === "zh" ? "未启用" : "Disabled"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 当前供应商的模型分组 */}
              <div className="provider-models-section">
                <div className="provider-section-header">
                  <h4>
                    {selectedProvider === "siliconflow" ? "SiliconFlow " : ""}
                    {currentLanguage === "zh" ? "模型分组" : "Model Groups"}
                  </h4>
                  <button className="add-button" onClick={handleAddGroup}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    {currentLanguage === "zh" ? "添加分组" : "Add Group"}
                  </button>
                </div>

                <div className="models-list">
                  {modelGroups
                    .filter((group) => group.provider === selectedProvider)
                    .map((group) => (
                      <div key={group.id} className="model-group">
                        <div className="group-header">
                          <div className="group-info">
                            <div className="group-name">
                              <h4>{group.name}</h4>
                              {/* <span className="provider-badge">{group.provider}</span> */}
                            </div>
                            <p className="group-description">
                              {group.description}
                            </p>
                          </div>
                          <div className="group-actions">
                            <button
                              className="add-button"
                              onClick={() => {
                                const newModel = {
                                  id: `model-${Date.now()}`,
                                  groupId: group.id,
                                  name:
                                    currentLanguage === "zh"
                                      ? "新模型"
                                      : "New Model",
                                  modelId: "custom-model",
                                  enabled: true,
                                  description: "",
                                  apiParams: {},
                                  sortOrder: models.filter(
                                    (m) => m.groupId === group.id
                                  ).length,
                                };
                                setEditingModel(newModel);
                                setIsAddingModel(true);
                              }}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M12 5v14M5 12h14" />
                              </svg>
                              {currentLanguage === "zh"
                                ? "添加模型"
                                : "Add Model"}
                            </button>
                            <button
                              className="edit-button"
                              onClick={() => handleEditGroup(group)}
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
                            <button
                              className="delete-button"
                              onClick={() => handleDeleteGroup(group.id)}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        <div className="group-models">
                          {models
                            .filter((model) => model.groupId === group.id)
                            .map((model) => (
                              <div key={model.id} className="model-item">
                                <div className="model-info">
                                  <div className="model-details">
                                    <div className="model-header">
                                      <div className="model-status">
                                        <div
                                          className={`status-indicator ${
                                            model.enabled
                                              ? "enabled"
                                              : "disabled"
                                          }`}
                                        ></div>
                                      </div>
                                      {model.logo && (
                                        <img
                                          src={model.logo}
                                          alt={model.name}
                                          className="model-logo"
                                          onError={(e) => {
                                            e.target.style.display = "none";
                                          }}
                                          loading="lazy"
                                        />
                                      )}
                                      <h4>{model.name}</h4>
                                      {model.isPro && (
                                        <span className="pro-badge">PRO</span>
                                      )}
                                    </div>
                                    <div className="model-subline">
                                      <p className="model-id">
                                        ID: {model.modelId}
                                      </p>
                                      {model.description && (
                                        <p className="model-desc">
                                          {model.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="model-actions">
                                  <button
                                    className={`toggle-button ${
                                      model.enabled ? "enabled" : "disabled"
                                    }`}
                                    onClick={() => handleToggleModel(model.id)}
                                  >
                                    {model.enabled
                                      ? currentLanguage === "zh"
                                        ? "启用"
                                        : "Enabled"
                                      : currentLanguage === "zh"
                                      ? "禁用"
                                      : "Disabled"}
                                  </button>
                                  <button
                                    className="edit-button"
                                    onClick={() => handleEditModel(model)}
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
                                  <button
                                    className="delete-button"
                                    onClick={() => handleDeleteModel(model.id)}
                                  >
                                    <svg
                                      width="14"
                                      height="14"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                    >
                                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}

                  {modelGroups.filter(
                    (group) => group.provider === selectedProvider
                  ).length === 0 && (
                    <div className="empty-state">
                      <div className="empty-icon">📦</div>
                      <h4>
                        {currentLanguage === "zh"
                          ? "暂无模型分组"
                          : "No Model Groups"}
                      </h4>
                      <p>
                        {currentLanguage === "zh"
                          ? "点击上方按钮创建第一个模型分组"
                          : "Click the button above to create your first model group"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 角色编辑模态框 */}
        {editingRole && (
          <div className="edit-modal">
            <div className="modal-content">
              <h3>
                {isAddingRole
                  ? currentLanguage === "zh"
                    ? "添加角色"
                    : "Add Role"
                  : currentLanguage === "zh"
                  ? "编辑角色"
                  : "Edit Role"}
              </h3>
              <div className="form-container">
                <div className="form-group">
                  <label>
                    {currentLanguage === "zh" ? "角色名称" : "Role Name"}
                  </label>
                  <input
                    type="text"
                    value={editingRole.name}
                    onChange={(e) =>
                      setEditingRole({ ...editingRole, name: e.target.value })
                    }
                  />
                </div>

                <div className="form-row-double">
                  <div className="form-group">
                    <label>{currentLanguage === "zh" ? "图标" : "Icon"}</label>
                    <EmojiSelector
                      value={editingRole.icon}
                      onChange={(icon) =>
                        setEditingRole({ ...editingRole, icon })
                      }
                      currentLanguage={currentLanguage}
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      {currentLanguage === "zh" ? "名称颜色" : "Name Color"}
                    </label>
                    <input
                      type="color"
                      value={editingRole.color}
                      onChange={(e) =>
                        setEditingRole({
                          ...editingRole,
                          color: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="form-row-double">
                  <div className="form-group">
                    <label>
                      {currentLanguage === "zh" ? "Temperature" : "Temperature"}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={editingRole.temperature}
                      onChange={(e) =>
                        setEditingRole({
                          ...editingRole,
                          temperature: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      {currentLanguage === "zh" ? "Top P" : "Top P"}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={editingRole.topP || 1.0}
                      onChange={(e) =>
                        setEditingRole({
                          ...editingRole,
                          topP: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    {currentLanguage === "zh" ? "描述" : "Description"}
                  </label>
                  <textarea
                    value={editingRole.description}
                    style={{ minHeight: "40px", maxHeight: "140px" }}
                    onChange={(e) =>
                      setEditingRole({
                        ...editingRole,
                        description: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>
                    {currentLanguage === "zh" ? "系统提示词" : "System Prompt"}
                  </label>
                  <textarea
                    className="system-prompt"
                    style={{ minHeight: "120px", maxHeight: "140px" }}
                    value={editingRole.systemPrompt}
                    onChange={(e) =>
                      setEditingRole({
                        ...editingRole,
                        systemPrompt: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="cancel-button"
                  onClick={() => setEditingRole(null)}
                >
                  {currentLanguage === "zh" ? "取消" : "Cancel"}
                </button>
                <button
                  className="save-button"
                  onClick={() => {
                    console.log("保存按钮被点击"); // 调试日志
                    handleSaveRole();
                  }}
                >
                  {currentLanguage === "zh" ? "保存" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 模型分组编辑模态框 */}
        {editingGroup && (
          <div className="edit-modal">
            <div className="modal-content">
              <h3>
                {isAddingGroup
                  ? currentLanguage === "zh"
                    ? "添加分组"
                    : "Add Group"
                  : currentLanguage === "zh"
                  ? "编辑分组"
                  : "Edit Group"}
              </h3>
              <div className="form-container">
                <div className="form-group">
                  <label>
                    {currentLanguage === "zh" ? "分组名称" : "Group Name"}
                  </label>
                  <input
                    type="text"
                    value={editingGroup.name}
                    onChange={(e) =>
                      setEditingGroup({ ...editingGroup, name: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>
                    {currentLanguage === "zh" ? "提供者" : "Provider"}
                  </label>
                  <select
                    value={editingGroup.provider}
                    onChange={(e) =>
                      setEditingGroup({
                        ...editingGroup,
                        provider: e.target.value,
                      })
                    }
                  >
                    <option value="siliconflow">SiliconFlow</option>
                    <option value="openai">OpenAI</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    {currentLanguage === "zh" ? "描述" : "Description"}
                  </label>
                  <textarea
                    value={editingGroup.description}
                    style={{ minHeight: "80px", maxHeight: "140px" }}
                    onChange={(e) =>
                      setEditingGroup({
                        ...editingGroup,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="cancel-button"
                  onClick={() => {
                    setEditingGroup(null);
                    setIsAddingGroup(false);
                  }}
                >
                  {currentLanguage === "zh" ? "取消" : "Cancel"}
                </button>
                <button className="save-button" onClick={handleSaveGroup}>
                  {currentLanguage === "zh" ? "保存" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 模型编辑模态框 */}
        {editingModel && (
          <div className="edit-modal">
            <div className="modal-content">
              <h3>
                {isAddingModel
                  ? currentLanguage === "zh"
                    ? "添加模型"
                    : "Add Model"
                  : currentLanguage === "zh"
                  ? "编辑模型"
                  : "Edit Model"}
              </h3>
              <div className="form-container">
                <div className="form-group">
                  <label>
                    {currentLanguage === "zh" ? "模型名称" : "Model Name"}
                  </label>
                  <input
                    type="text"
                    value={editingModel.name}
                    onChange={(e) =>
                      setEditingModel({ ...editingModel, name: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>
                    {currentLanguage === "zh" ? "模型ID" : "Model ID"}
                  </label>
                  <input
                    type="text"
                    value={editingModel.modelId}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        modelId: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>
                    {currentLanguage === "zh" ? "所属分组" : "Group"}
                  </label>
                  <select
                    value={editingModel.groupId}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        groupId: e.target.value,
                      })
                    }
                  >
                    {modelGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} ({group.provider})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    {currentLanguage === "zh" ? "描述" : "Description"}
                  </label>
                  <textarea
                    value={editingModel.description}
                    style={{ minHeight: "80px", maxHeight: "140px" }}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        description: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={editingModel.enabled}
                      onChange={(e) =>
                        setEditingModel({
                          ...editingModel,
                          enabled: e.target.checked,
                        })
                      }
                    />
                    {currentLanguage === "zh" ? "启用模型" : "Enable Model"}
                  </label>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="cancel-button"
                  onClick={() => {
                    setEditingModel(null);
                    setIsAddingModel(false);
                  }}
                >
                  {currentLanguage === "zh" ? "取消" : "Cancel"}
                </button>
                <button className="save-button" onClick={handleSaveModel}>
                  {currentLanguage === "zh" ? "保存" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // 通过 Portal 挂载到 body，避免被上层模态的层叠上下文影响
  return createPortal(content, document.body);
};

export default RoleModelManager;
