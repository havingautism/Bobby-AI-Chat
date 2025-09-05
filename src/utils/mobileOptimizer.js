// 简化的移动端交互优化工具
class MobileInteractionOptimizer {
  constructor() {
    this.isMobile = window.innerWidth <= 768;
    this.init();
  }
  
  init() {
    if (!this.isMobile) return;
    this.setupElements();
    this.setupEventListeners();
  }
  
  setupElements() {
    this.scrollContainer = document.querySelector('.chat-messages');
    this.header = document.querySelector('.chat-header');
  }
  
  setupEventListeners() {
    // 只监听窗口大小变化
    window.addEventListener('resize', this.handleResize.bind(this));
    
    // 完全移除触摸事件监听，让浏览器原生处理滚动
    // 这样可以避免任何可能的滚动干扰
  }
  
  handleResize() {
    this.isMobile = window.innerWidth <= 768;
  }
  
  scrollToBottom() {
    if (!this.scrollContainer) return;
    setTimeout(() => {
      this.scrollContainer.scrollTop = this.scrollContainer.scrollHeight;
    }, 100);
  }
  
  enable() {
    this.setupEventListeners();
  }
  
  disable() {
    window.removeEventListener('resize', this.handleResize);
    // 移除所有事件监听器
  }
  
  refresh() {
    this.setupElements();
  }
}

// 导出单例实例
let mobileOptimizer = null;

export function initMobileOptimizer() {
  if (!mobileOptimizer) {
    mobileOptimizer = new MobileInteractionOptimizer();
  }
  return mobileOptimizer;
}

export function getMobileOptimizer() {
  return mobileOptimizer;
}

// 自动初始化
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileOptimizer);
  } else {
    initMobileOptimizer();
  }
}