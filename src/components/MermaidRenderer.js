import React, { useEffect, useRef, useState } from 'react';

let mermaidInstance = null;

const MermaidRenderer = ({ chart, id, isStreaming = false }) => {
  const mermaidRef = useRef(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [svgContent, setSvgContent] = useState('');
  const [currentTheme, setCurrentTheme] = useState('light');
  const [retryCount, setRetryCount] = useState(0);

  // 初始化mermaid库
  const initMermaid = async () => {
    try {
      const mermaid = await import('mermaid');
      
      // 获取当前主题设置
      const root = document.documentElement;
      const isDark = root.getAttribute('data-theme') === 'dark';
      
      mermaid.default.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: isDark ? 'dark' : 'default',
        themeVariables: {
          primaryColor: '#8b5cf6',
          textColor: isDark ? '#ffffff' : '#1e293b',
          background: isDark ? '#1a1a20' : '#ffffff',
          edgeLabelBackground: isDark ? '#2d2d3a' : '#ffffff',
          edgeLabelTextColor: isDark ? '#ffffff' : '#1e293b',
        }
      });
      
      return mermaid.default;
    } catch (err) {
      console.error('Mermaid初始化失败:', err);
      throw err;
    }
  };

  // 监听主题变化和API会话完成
  useEffect(() => {
    const root = document.documentElement;
    const checkTheme = () => {
      const isDark = root.getAttribute('data-theme') === 'dark';
      const newTheme = isDark ? 'dark' : 'light';
      if (newTheme !== currentTheme) {
        setCurrentTheme(newTheme);
        // 主题变化时强制重新渲染
        setSvgContent('');
        setError(null);
      }
    };

    // 初始检查
    checkTheme();

    // 监听主题变化
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          checkTheme();
        }
      });
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => {
      observer.disconnect();
    };
  }, [currentTheme, chart]);

  // 主要渲染逻辑
  useEffect(() => {
    if (!chart || isStreaming) {
      setSvgContent('');
      setError(null);
      return;
    }

    const renderChart = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setSvgContent('');

        // 初始化mermaid
        const mermaid = await initMermaid();

        // 生成唯一的图表ID
        const chartId = `mermaid-${id || Date.now()}-${currentTheme}`;
        
        // 使用 mermaid.render 生成SVG内容
        const { svg } = await mermaid.render(chartId, chart);
        if (!svg || svg.trim() === '') {
          throw new Error('Mermaid 渲染结果为空');
        }
        
        setSvgContent(svg);
        setRetryCount(0);
        
      } catch (err) {
        // 检查是否为语法错误
        const isSyntaxError = err.message && (
          err.message.includes('Parse error') || 
          err.message.includes('Syntax error') ||
          err.message.includes('Unexpected token') ||
          err.message.includes('Expecting')
        );
        
        if (isSyntaxError) {
          setError('syntax_error');
        } else {
          console.error('Mermaid渲染错误:', err);
          setError(err.message || '流程图渲染失败');
        }
        setSvgContent('');
      } finally {
        setIsLoading(false);
      }
    };

    renderChart();
  }, [chart, id, currentTheme, isStreaming, retryCount]);

  // 处理SVG加载完成后的样式调整
  const handleSvgLoad = () => {
    if (mermaidRef.current) {
      const svgEl = mermaidRef.current.querySelector('svg');
      if (svgEl) {
        svgEl.style.maxWidth = '100%';
        svgEl.style.height = 'auto';
        svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        
        // 简单的边标签样式调整
        const edgeLabels = svgEl.querySelectorAll('.edgeLabel rect');
        const edgeTexts = svgEl.querySelectorAll('.edgeLabel text');
        const root = document.documentElement;
        const isDark = root.getAttribute('data-theme') === 'dark';
        
        edgeLabels.forEach(rect => {
          rect.setAttribute('fill', isDark ? '#2d2d3a' : '#ffffff');
          rect.setAttribute('stroke', isDark ? '#475569' : '#8b5cf6');
        });
        
        edgeTexts.forEach(text => {
          text.setAttribute('fill', isDark ? '#ffffff' : '#1e293b');
        });
      }
    }
  };

  // 重试机制
  const handleRetry = () => {
    setSvgContent('');
    setError(null);
    setRetryCount(prev => prev + 1);
  };

  // 流式输出时显示原始代码
  if (isStreaming) {
    return (
      <div className="mermaid-container">
        <div className="mermaid-chart">
          <pre><code>{chart.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mermaid-loading">
        <div className="loading-spinner"></div>
        <span>正在生成流程图...</span>
      </div>
    );
  }

  // 语法错误时显示原始代码
  if (error === 'syntax_error') {
    return (
      <div className="mermaid-container">
        <div className="mermaid-chart">
          <pre><code>{chart.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
        </div>
      </div>
    );
  }

  // 其他错误时显示错误信息
  if (error) {
    return (
      <div className="mermaid-container">
        <div className="mermaid-error-container">
          <div className="mermaid-error-message">
            {error}
          </div>
          <button 
            className="mermaid-retry-button"
            onClick={handleRetry}
          >
            重试
          </button>
        </div>
        <div className="mermaid-error">
          <pre><code>{chart.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
        </div>
      </div>
    );
  }

  return (
    <div className="mermaid-container">
      <div 
        ref={mermaidRef}
        className="mermaid-chart"
        dangerouslySetInnerHTML={{ __html: svgContent }}
        onLoad={handleSvgLoad}
      />
    </div>
  );
};

export default MermaidRenderer;