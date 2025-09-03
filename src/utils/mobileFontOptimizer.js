// 移动设备字体优化工具
class MobileFontOptimizer {
  constructor() {
    this.init();
  }

  init() {
    if (this.isMobile()) {
      this.optimizeMobileFonts();
      this.detectDeviceSpecifics();
      this.addViewportOptimization();
    }
  }

  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  optimizeMobileFonts() {
    // 检测系统字体
    const systemFont = this.detectSystemFont();
    
    // 应用设备特定的字体优化
    this.applyDeviceSpecificOptimizations(systemFont);
    
    // 监听字体加载
    this.waitForFontLoad();
  }

  detectSystemFont() {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // 测试常用字体的渲染
    const testFonts = [
      'PingFang SC',
      'Hiragino Sans GB', 
      'Microsoft YaHei',
      '微软雅黑',
      'Roboto',
      'San Francisco',
      'Helvetica Neue'
    ];

    const testText = '字体测试';
    let detectedFont = 'Arial';

    for (const font of testFonts) {
      context.font = `16px ${font}`;
      const metrics = context.measureText(testText);
      
      if (metrics.width > 0) {
        detectedFont = font;
        break;
      }
    }

    return detectedFont;
  }

  applyDeviceSpecificOptimizations(systemFont) {
    const html = document.documentElement;
    
    // 添加设备类型类
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      html.classList.add('ios-device');
    } else if (/Android/i.test(navigator.userAgent)) {
      html.classList.add('android-device');
    }

    // 添加检测到的字体类
    html.classList.add(`font-${systemFont.toLowerCase().replace(/\s+/g, '-')}`);

    // 应用字体优化样式
    const style = document.createElement('style');
    style.textContent = `
      .ios-device {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      }
      
      .android-device {
        text-rendering: optimizeSpeed;
        font-weight: 400;
      }
      
      body {
        font-family: ${systemFont}, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
    `;
    
    document.head.appendChild(style);
  }

  waitForFontLoad() {
    // 使用 document.fonts API 检查字体加载
    if ('fonts' in document) {
      document.fonts.ready.then(() => {
        document.body.classList.add('fonts-loaded');
      });
    } else {
      // 回退方案
      setTimeout(() => {
        document.body.classList.add('fonts-loaded');
      }, 100);
    }
  }

  detectDeviceSpecifics() {
    const html = document.documentElement;
    
    // 检测具体设备型号
    const userAgent = navigator.userAgent;
    
    // iPhone型号检测
    if (/iPhone/.test(userAgent)) {
      if (/iPhone OS 16_/.test(userAgent)) {
        html.classList.add('ios-16');
      } else if (/iPhone OS 15_/.test(userAgent)) {
        html.classList.add('ios-15');
      } else if (/iPhone OS 14_/.test(userAgent)) {
        html.classList.add('ios-14');
      }
    }
    
    // Android版本检测
    if (/Android/.test(userAgent)) {
      const androidVersion = userAgent.match(/Android (\d+)/);
      if (androidVersion) {
        html.classList.add(`android-${androidVersion[1]}`);
      }
    }
    
    // 检测屏幕密度
    const dpr = window.devicePixelRatio || 1;
    html.classList.add(`dpr-${dpr}`);
    
    // 检测屏幕尺寸
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    html.classList.add(`screen-${screenWidth}x${screenHeight}`);
  }

  addViewportOptimization() {
    // 动态优化viewport设置
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      const currentContent = viewport.getAttribute('content');
      const optimizedContent = currentContent + ', maximum-scale=1.0, user-scalable=no';
      viewport.setAttribute('content', optimizedContent);
    }
  }

  // 强制字体重载方法
  forceFontReload() {
    const body = document.body;
    const currentFont = window.getComputedStyle(body).fontFamily;
    
    // 短暂移除字体然后重新应用
    body.style.fontFamily = 'Arial';
    
    setTimeout(() => {
      body.style.fontFamily = currentFont;
    }, 10);
  }

  // 获取字体信息
  getFontInfo() {
    const body = document.body;
    const computedStyle = window.getComputedStyle(body);
    
    return {
      fontFamily: computedStyle.fontFamily,
      fontSize: computedStyle.fontSize,
      fontWeight: computedStyle.fontWeight,
      lineHeight: computedStyle.lineHeight,
      letterSpacing: computedStyle.letterSpacing,
      devicePixelRatio: window.devicePixelRatio,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      userAgent: navigator.userAgent
    };
  }
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new MobileFontOptimizer();
  });
} else {
  new MobileFontOptimizer();
}

// 导出供其他模块使用
window.MobileFontOptimizer = MobileFontOptimizer;