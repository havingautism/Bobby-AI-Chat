import React, { useState, useEffect, useRef } from 'react';
import './MermaidModal.css';

const MermaidModal = ({ isOpen, onClose, charts }) => {
  const [currentChartIndex, setCurrentChartIndex] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const chartRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentChartIndex(0);
      const root = document.documentElement;
      setIsDarkMode(root.getAttribute('data-theme') === 'dark');
      
      // 简单的延迟渲染
      setTimeout(() => {
        renderChart();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        renderChart();
      }, 100);
    }
  }, [currentChartIndex, isDarkMode]);

  const renderChart = async () => {
    if (!charts[currentChartIndex] || !chartRef.current) return;

    try {
      const mermaid = await import('mermaid');
      
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
      
      const chartId = `mermaid-modal-${Date.now()}`;
      const { svg } = await mermaid.default.render(chartId, charts[currentChartIndex].code);
      
      if (chartRef.current) {
        chartRef.current.innerHTML = svg;
        const svgElement = chartRef.current.querySelector('svg');
        if (svgElement) {
          svgElement.style.maxWidth = '100%';
          svgElement.style.height = 'auto';
          svgElement.style.maxHeight = '60vh';
        }
      }
    } catch (error) {
      console.error('渲染流程图失败:', error);
    }
  };

  const handlePrevChart = () => {
    if (currentChartIndex > 0) setCurrentChartIndex(currentChartIndex - 1);
  };

  const handleNextChart = () => {
    if (currentChartIndex < charts.length - 1) setCurrentChartIndex(currentChartIndex + 1);
  };

  if (!isOpen || charts.length === 0) return null;

  return (
    <div className="mermaid-modal-overlay" onClick={onClose}>
      <div className="mermaid-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mermaid-modal-header">
          <h3>流程图 {currentChartIndex + 1} / {charts.length}</h3>
          <button className="mermaid-modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="mermaid-modal-body">
          <div className="mermaid-modal-chart-container">
            <div ref={chartRef} className="mermaid-modal-chart" />
          </div>
          
          {charts.length > 1 && (
            <div className="mermaid-modal-navigation">
              <button className="nav-button prev" onClick={handlePrevChart} disabled={currentChartIndex === 0}>
                上一个
              </button>
              <span className="chart-indicator">{currentChartIndex + 1} / {charts.length}</span>
              <button className="nav-button next" onClick={handleNextChart} disabled={currentChartIndex === charts.length - 1}>
                下一个
              </button>
            </div>
          )}
          
          <div className="mermaid-modal-code">
            <details>
              <summary>查看源代码</summary>
              <pre><code>{charts[currentChartIndex].code}</code></pre>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MermaidModal;