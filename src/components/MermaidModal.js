import React, { useState, useEffect, useRef, useCallback } from 'react';
import './MermaidModal.css';

const MermaidModal = ({ isOpen, onClose, charts }) => {
  const [currentChartIndex, setCurrentChartIndex] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const chartRef = useRef(null);

  const renderChart = useCallback(async () => {
    if (!charts[currentChartIndex] || !chartRef.current) {
      console.log('Chart data or ref not available:', {
        hasChart: !!charts[currentChartIndex],
        hasRef: !!chartRef.current
      });
      return;
    }
    
    setIsRendering(true);
    
    try {
      // 动态导入mermaid
      const mermaid = await import('mermaid');
      
      // 初始化mermaid
      mermaid.default.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: isDarkMode ? 'dark' : 'default',
        themeVariables: {
          primaryColor: '#8b5cf6',
          textColor: isDarkMode ? '#ffffff' : '#1e293b',
          background: isDarkMode ? '#1a1a20' : '#ffffff',
          edgeLabelBackground: isDarkMode ? '#2d2d3a' : '#ffffff',
          edgeLabelTextColor: isDarkMode ? '#ffffff' : '#1e293b',
        }
      });
      
      // 清除之前的内容
      if (chartRef.current) {
        chartRef.current.innerHTML = '';
      }
      
      // 生成唯一ID
      const chartId = `mermaid-modal-${Date.now()}`;
      
      // 渲染图表
      const { svg } = await mermaid.default.render(chartId, charts[currentChartIndex].code);
      
      // 设置SVG内容
      if (chartRef.current) {
        chartRef.current.innerHTML = svg;
      }
      
      // 调整SVG样式
      if (chartRef.current) {
        const svgElement = chartRef.current.querySelector('svg');
        if (svgElement) {
          svgElement.style.maxWidth = '100%';
          svgElement.style.height = 'auto';
          svgElement.style.maxHeight = '60vh';
        }
      }
      
    } catch (error) {
      console.error('渲染流程图失败:', error);
      if (chartRef.current) {
        chartRef.current.innerHTML = `
          <div style="color: #ef4444; padding: 20px; text-align: center;">
            <p>流程图渲染失败</p>
            <pre style="background: #f3f4f6; padding: 10px; margin-top: 10px; border-radius: 4px; font-size: 12px;">
              ${error.message}
            </pre>
          </div>
        `;
      }
    } finally {
      setIsRendering(false);
    }
  }, [charts, currentChartIndex, isDarkMode]);

  useEffect(() => {
    if (isOpen) {
      setCurrentChartIndex(0);
      const root = document.documentElement;
      setIsDarkMode(root.getAttribute('data-theme') === 'dark');
      
      // 延迟渲染确保DOM已经准备好
      const timer = setTimeout(() => {
        if (charts.length > 0 && chartRef.current) {
          renderChart();
        }
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, charts.length, renderChart]);

  useEffect(() => {
    if (isOpen && charts.length > 0) {
      const timer = setTimeout(() => {
        renderChart();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentChartIndex, isDarkMode, renderChart]);

  const handlePrevChart = () => {
    if (currentChartIndex > 0) {
      setCurrentChartIndex(currentChartIndex - 1);
    }
  };

  const handleNextChart = () => {
    if (currentChartIndex < charts.length - 1) {
      setCurrentChartIndex(currentChartIndex + 1);
    }
  };

  if (!isOpen || charts.length === 0) return null;

  const currentChart = charts[currentChartIndex];

  return (
    <div className="mermaid-modal-overlay" onClick={onClose}>
      <div className="mermaid-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mermaid-modal-header">
          <h3>
            流程图 {currentChartIndex + 1} / {charts.length}
          </h3>
          <button className="mermaid-modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="mermaid-modal-body">
          <div className="mermaid-modal-chart-container">
            {isRendering ? (
              <div className="mermaid-modal-loading">
                <div className="loading-spinner"></div>
                <span>正在渲染流程图...</span>
              </div>
            ) : (
              <div 
                ref={chartRef}
                className="mermaid-modal-chart"
              />
            )}
          </div>
          
          {charts.length > 1 && (
            <div className="mermaid-modal-navigation">
              <button 
                className="nav-button prev" 
                onClick={handlePrevChart}
                disabled={currentChartIndex === 0}
              >
                上一个
              </button>
              
              <span className="chart-indicator">
                {currentChartIndex + 1} / {charts.length}
              </span>
              
              <button 
                className="nav-button next" 
                onClick={handleNextChart}
                disabled={currentChartIndex === charts.length - 1}
              >
                下一个
              </button>
            </div>
          )}
          
          <div className="mermaid-modal-code">
            <details>
              <summary>查看源代码</summary>
              <pre><code>{currentChart.code}</code></pre>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MermaidModal;