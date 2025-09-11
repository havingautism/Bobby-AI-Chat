// 移动端性能监控组件
import React, { useState, useEffect, useCallback } from 'react';

const PerformanceMonitor = () => {
  const [fps, setFps] = useState(0);
  const [memory, setMemory] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 检测是否为移动设备
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // FPS监控
  useEffect(() => {
    if (!isMobile) return;

    let frameCount = 0;
    let lastTime = performance.now();
    let animationId;

    const measureFps = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime >= lastTime + 1000) {
        setFps(Math.round(frameCount * 1000 / (currentTime - lastTime)));
        frameCount = 0;
        lastTime = currentTime;
      }
      
      animationId = requestAnimationFrame(measureFps);
    };

    animationId = requestAnimationFrame(measureFps);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isMobile]);

  // 内存监控
  useEffect(() => {
    if (!isMobile || !('memory' in performance)) return;

    const interval = setInterval(() => {
      if (performance.memory) {
        const used = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
        setMemory(used);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isMobile]);

  // 切换显示状态
  const toggleVisibility = useCallback(() => {
    setIsVisible(!isVisible);
  }, [isVisible]);

  // 移动端显示性能监控
  if (!isMobile) return null;

  return (
    <div className={`performance-monitor ${isVisible ? 'visible' : 'hidden'}`}>
      <div className="performance-toggle" onClick={toggleVisibility}>
        📊
      </div>
      {isVisible && (
        <div className="performance-info">
          <div className="performance-item">
            <span className="performance-label">FPS:</span>
            <span className={`performance-value ${fps < 30 ? 'warning' : fps < 20 ? 'danger' : 'good'}`}>
              {fps}
            </span>
          </div>
          <div className="performance-item">
            <span className="performance-label">内存:</span>
            <span className="performance-value">{memory}MB</span>
          </div>
          <div className="performance-item">
            <span className="performance-label">状态:</span>
            <span className={`performance-value ${fps >= 30 ? 'good' : 'warning'}`}>
              {fps >= 30 ? '流畅' : fps >= 20 ? '一般' : '卡顿'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceMonitor;