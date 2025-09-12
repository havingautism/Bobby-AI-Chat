import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './MermaidModal.css';

const MermaidModal = ({ isOpen, onClose, charts }) => {
  const [currentChartIndex, setCurrentChartIndex] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [zoom, setZoom] = useState(2);
  // 预留 svg 尺寸（如需做居中/边界限制可启用）
  // const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });
  const chartRef = useRef(null);
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const renderChart = useCallback(async () => {
    if (!charts[currentChartIndex] || !chartRef.current) return;

    try {
      const mermaid = await import('mermaid');
      
      mermaid.default.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'default',
        themeVariables: {
          primaryColor: '#8b5cf6',
          textColor: '#1e293b',
          background: '#ffffff',
          edgeLabelBackground: '#ffffff',
          edgeLabelTextColor: '#1e293b',
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
          svgElement.style.background = '#ffffff';

          // 读取 SVG 尺寸用于计算滚动画布大小
          let width = 0;
          let height = 0;
          const viewBox = svgElement.getAttribute('viewBox');
          if (viewBox) {
            const parts = viewBox.split(/\s+/).map(Number);
            if (parts.length === 4) {
              width = parts[2];
              height = parts[3];
            }
          }
          if (!width || !height) {
            const wAttr = svgElement.getAttribute('width');
            const hAttr = svgElement.getAttribute('height');
            if (wAttr && hAttr) {
              width = parseFloat(wAttr);
              height = parseFloat(hAttr);
            } else {
              const bbox = svgElement.getBBox?.();
              if (bbox) {
                width = bbox.width;
                height = bbox.height;
              }
            }
          }
          // if (width && height) {
          //   setSvgSize({ width, height });
          // }
        }
      }
    } catch (error) {
      console.error('渲染流程图失败:', error);
    }
  }, [charts, currentChartIndex]);

  useEffect(() => {
    if (isOpen) {
      setCurrentChartIndex(0);
      setZoom(2);
      const root = document.documentElement;
      setIsDarkMode(root.getAttribute('data-theme') === 'dark');
      const id = setTimeout(() => {
        renderChart();
      }, 100);
      return () => clearTimeout(id);
    }
  }, [isOpen, renderChart]);

  useEffect(() => {
    if (isOpen) {
      const id = setTimeout(() => {
        renderChart();
      }, 100);
      return () => clearTimeout(id);
    }
  }, [isOpen, currentChartIndex, isDarkMode, renderChart]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow || 'unset';
    };
  }, [isOpen, onClose]);

  const handlePrevChart = () => {
    if (currentChartIndex > 0) setCurrentChartIndex(currentChartIndex - 1);
  };

  const handleNextChart = () => {
    if (currentChartIndex < charts.length - 1) setCurrentChartIndex(currentChartIndex + 1);
  };

  const clamp = (val, min, max) => Math.min(max, Math.max(min, val));
  const handleZoomIn = () => setZoom((z) => clamp(z * 1.1, 0.25, 4));
  const handleZoomOut = () => setZoom((z) => clamp(z / 1.1, 0.25, 4));
  const handleZoomReset = () => setZoom(1);
  const handleWheel = (e) => {
    // 阻止滚轮默认缩放页面与外层滚动；允许容器自身滚动条工作
    if (e.ctrlKey || e.metaKey || !e.shiftKey) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => clamp(z * factor, 0.25, 4));
    }
  };

  const onDragStart = (e) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    const container = containerRef.current;
    dragStartRef.current = {
      x: e.touches ? e.touches[0].clientX : e.clientX,
      y: e.touches ? e.touches[0].clientY : e.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };
  };

  const onDragMove = (e) => {
    if (!isDragging || !containerRef.current) return;
    const container = containerRef.current;
    const currentX = e.touches ? e.touches[0].clientX : e.clientX;
    const currentY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = currentX - dragStartRef.current.x;
    const dy = currentY - dragStartRef.current.y;
    container.scrollLeft = dragStartRef.current.scrollLeft - dx;
    container.scrollTop = dragStartRef.current.scrollTop - dy;
  };

  const onDragEnd = () => setIsDragging(false);

  // 触摸双指缩放
  const pinchStateRef = useRef({ active: false, startDistance: 0, startZoom: 1, centerX: 0, centerY: 0 });
  const getDistance = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const onTouchStart = (e) => {
    if (e.touches && e.touches.length === 2) {
      const [t1, t2] = e.touches;
      pinchStateRef.current = {
        active: true,
        startDistance: getDistance(t1, t2),
        startZoom: zoom,
        centerX: (t1.clientX + t2.clientX) / 2,
        centerY: (t1.clientY + t2.clientY) / 2,
      };
    } else if (e.touches && e.touches.length === 1) {
      onDragStart(e);
    }
  };

  const onTouchMove = (e) => {
    if (pinchStateRef.current.active && e.touches && e.touches.length === 2) {
      e.preventDefault();
      const [t1, t2] = e.touches;
      const currentDistance = getDistance(t1, t2);
      const factor = currentDistance / pinchStateRef.current.startDistance;
      const nextZoom = clamp(pinchStateRef.current.startZoom * factor, 0.25, 4);
      setZoom(nextZoom);
    } else if (e.touches && e.touches.length === 1) {
      onDragMove(e);
    }
  };

  const onTouchEnd = (e) => {
    if (pinchStateRef.current.active && (!e.touches || e.touches.length < 2)) {
      pinchStateRef.current.active = false;
    }
    onDragEnd();
  };

  if (!isOpen || charts.length === 0) return null;

  return createPortal(
    (
      <div className="mermaid-modal-overlay" onClick={onClose}>
        <div className="mermaid-modal" onClick={(e) => e.stopPropagation()}>
          <div className="mermaid-modal-header">
            <h3>流程图 {currentChartIndex + 1} / {charts.length}</h3>
            <div className="mermaid-zoom-controls">
              <button className="zoom-btn" onClick={handleZoomOut} title="缩小">-</button>
              <button className="zoom-btn" onClick={handleZoomReset} title="重置">{Math.round(zoom * 100)}%</button>
              <button className="zoom-btn" onClick={handleZoomIn} title="放大">+</button>
            </div>
            <button className="mermaid-modal-close" onClick={onClose}>×</button>
          </div>
          
          <div className="mermaid-modal-body">
            <div
              ref={containerRef}
              className={`mermaid-modal-chart-container${isDragging ? ' dragging' : ''}`}
              onWheel={handleWheel}
              onMouseDown={onDragStart}
              onMouseMove={onDragMove}
              onMouseUp={onDragEnd}
              onMouseLeave={onDragEnd}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div className="mermaid-zoom-wrapper" style={{ transform: `scale(${zoom})` }}>
                <div ref={chartRef} className="mermaid-modal-chart" />
              </div>
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
    ),
    document.body
  );
};

export default MermaidModal;