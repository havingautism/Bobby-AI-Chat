// 默认AI角色配置
const DEFAULT_AI_ROLES = [
  {
    id: "bobby",
    name: "Bobby",
    icon: "🐱",
    description: "可爱的猫猫助手，日常聊天伙伴",
    temperature: 0.8,
    systemPrompt:
      "你是Bobby，一只超级可爱的小猫咪！🐱 请用可爱、活泼的语气回答，多使用emoji表情，让对话充满趣味和温暖。记住你是一只爱撒娇的小猫，喜欢用'喵~'、'nya~'等可爱的语气词。💕",
    color: "#f97316",
    sortOrder: 0,
  },
  {
    id: "developer",
    name: "编程专家",
    icon: "👨🏻‍💻",
    description: "专业的编程和技术支持",
    temperature: 0.4,
    systemPrompt:
      "你是一个经验丰富的编程专家，请提供准确的代码示例和技术解决方案。如果可以，请在回答最后添加markdown流程图来清晰地展示代码执行流程、算法逻辑或系统架构。使用mermaid语法创建流程图，例如：\n\n```mermaid\ngraph TD\n    A[开始] --> B{条件判断}\n    B -->|是| C[执行操作]\n    B -->|否| D[其他操作]\n    C --> E[结束]\n    D --> E\n```",
    color: "#8b5cf6",
    sortOrder: 1,
  },
  {
    id: "creative",
    name: "创意伙伴",
    icon: "🎨",
    description: "富有创意和想象力",
    temperature: 0.9,
    systemPrompt:
      "你是一个富有创意的伙伴，请用创新、有趣的方式回答问题，提供独特的见解和创意想法。",
    color: "#f59e0b",
    sortOrder: 2,
  },
  {
    id: "analyst",
    name: "数据分析师",
    icon: "📊",
    description: "专业的数据分析和洞察",
    temperature: 0.3,
    systemPrompt:
      "你是一个专业的数据分析师，请用准确、客观的方式分析问题，提供基于数据的见解。",
    color: "#3b82f6",
    sortOrder: 3,
  },
  {
    id: "teacher",
    name: "知识导师",
    icon: "👨‍🏫",
    description: "耐心的教学和解释",
    temperature: 0.5,
    systemPrompt:
      "你是一个耐心的导师，请用清晰、易懂的方式解释概念，循序渐进地帮助用户学习。如果可以，请在回答最后添加markdown流程图来清晰地展示知识结构、学习路径或概念之间的关系。使用mermaid语法创建流程图，例如：\n\n```mermaid\ngraph TD\n    A[基础概念] --> B[进阶概念]\n    B --> C[应用实例]\n    C --> D[深入理解]\n    A --> E[相关概念]\n    E --> D\n```",
    color: "#10b981",
    sortOrder: 4,
  },
  {
    id: "writer",
    name: "写作助手",
    icon: "✍️",
    description: "优雅的文字创作",
    temperature: 0.8,
    systemPrompt:
      "你是一个优秀的写作助手，请用优美、流畅的文字帮助用户创作和改进文本。",
    color: "#ef4444",
    sortOrder: 5,
  },
];

// 当前使用的角色列表（可以从localStorage更新）
let currentRoles = [...DEFAULT_AI_ROLES];

// 导出的AI_ROLES变量，实际上是currentRoles的引用
export let AI_ROLES = currentRoles;

// 获取角色信息
export const getRoleById = (roleId) => {
  const foundRole = AI_ROLES.find((role) => role.id === roleId);
  if (foundRole) {
    return foundRole;
  }

  // 如果找不到角色，尝试从localStorage获取最新的角色列表
  try {
    const savedRoles = localStorage.getItem("ai-roles-updated");
    if (savedRoles) {
      const parsedRoles = JSON.parse(savedRoles);
      const foundInSaved = parsedRoles.find((role) => role.id === roleId);
      if (foundInSaved) {
        return foundInSaved;
      }
    }
  } catch (error) {
    console.error("从localStorage获取角色失败:", error);
  }

  // 最后fallback到第一个默认角色
  console.warn(`角色ID ${roleId} 未找到，使用默认角色`);
  return AI_ROLES[0];
};

// 更新角色列表
export const updateRolesList = (newRoles) => {
  currentRoles = [...newRoles];
  AI_ROLES = currentRoles;
};

// 重置为默认角色
export const resetRolesToDefault = () => {
  currentRoles = [...DEFAULT_AI_ROLES];
  AI_ROLES = currentRoles;
};

// 监听角色更新事件
if (typeof window !== "undefined") {
  window.addEventListener("rolesUpdated", (event) => {
    updateRolesList(event.detail);
  });

  window.addEventListener("rolesReset", () => {
    resetRolesToDefault();
  });

  // 页面加载时检查是否有自定义角色
  try {
    const savedRoles = localStorage.getItem("ai-roles-updated");
    if (savedRoles) {
      const parsedRoles = JSON.parse(savedRoles);
      updateRolesList(parsedRoles);
    }

    const customRoles = localStorage.getItem("custom-roles");
    if (customRoles) {
      const parsedRoles = JSON.parse(customRoles);
      updateRolesList(parsedRoles);
    }
  } catch (error) {
    console.error("加载自定义角色失败:", error);
  }
}

// 保存选中的角色到localStorage
export const saveSelectedRole = (roleId) => {
  try {
    localStorage.setItem("selected-ai-role", roleId);
  } catch (error) {
    console.error("保存角色选择失败:", error);
  }
};

// 从localStorage加载选中的角色
export const loadSelectedRole = () => {
  try {
    const saved = localStorage.getItem("selected-ai-role");
    return saved || "bobby";
  } catch (error) {
    console.error("加载角色选择失败:", error);
    return "bobby";
  }
};

// 获取角色的头像组件
// 兼容导出：已废弃，使用icon代替
export const getRoleAvatar = (roleId) => {
  const role = getRoleById(roleId);
  return role.icon;
};

// 获取角色的颜色
export const getRoleColor = (roleId) => {
  const role = getRoleById(roleId);
  return role.color;
};

// 更新全局角色列表（供RoleModelManager使用）
export const updateGlobalRoles = (updatedRoles) => {
  try {
    console.log("updateGlobalRoles被调用，角色数量:", updatedRoles.length);
    // 归一化：将可能存在的 avatar 合并到 icon，仅保留 icon
    const normalized = updatedRoles.map((r) => ({
      ...r,
      icon: r.icon || r.avatar || "🤖",
    }));
    // 更新当前角色列表
    updateRolesList(normalized);
    // 将更新后的角色信息保存到localStorage，供其他组件使用
    localStorage.setItem("ai-roles-updated", JSON.stringify(normalized));
    // 触发自定义事件通知其他组件角色已更新
    console.log("触发rolesUpdated事件，详情:", normalized);
    window.dispatchEvent(
      new CustomEvent("rolesUpdated", { detail: normalized })
    );
  } catch (error) {
    console.error("更新全局角色列表失败:", error);
  }
};
