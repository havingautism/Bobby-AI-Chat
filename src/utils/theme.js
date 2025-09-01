// 主题管理工具
export const THEMES = {
  LIGHT: "light",
  DARK: "dark",
};

// 获取当前主题
export const getCurrentTheme = () => {
  try {
    const saved = localStorage.getItem("app-theme");
    if (saved && Object.values(THEMES).includes(saved)) {
      return saved;
    }
    // 默认根据系统偏好设置
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? THEMES.DARK
      : THEMES.LIGHT;
  } catch (error) {
    console.error("获取主题失败:", error);
    return THEMES.LIGHT;
  }
};

// 保存主题设置
export const saveTheme = (theme) => {
  try {
    localStorage.setItem("app-theme", theme);
    applyTheme(theme);
    // 触发主题变化事件
    window.dispatchEvent(new CustomEvent("themeChanged", { detail: theme }));
  } catch (error) {
    console.error("保存主题失败:", error);
  }
};

// 应用主题到DOM
export const applyTheme = (theme) => {
  // 添加过渡类
  document.documentElement.classList.add("theme-transitioning");

  // 设置主题属性
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.className =
    theme === THEMES.DARK
      ? "dark-theme theme-transitioning"
      : "light-theme theme-transitioning";

  // 移除过渡类
  setTimeout(() => {
    document.documentElement.classList.remove("theme-transitioning");
  }, 400);
};

// 切换主题
export const toggleTheme = () => {
  const current = getCurrentTheme();
  const newTheme = current === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT;
  saveTheme(newTheme);
  return newTheme;
};

// 初始化主题
export const initTheme = () => {
  const theme = getCurrentTheme();
  applyTheme(theme);
  return theme;
};
