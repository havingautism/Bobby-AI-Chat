import React, { useEffect, useState } from "react";
import "./BackgroundSystem.css";

const BackgroundSystem = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 组件挂载后显示背景
    const timer = setTimeout(() => setIsVisible(true), 100);

    // 鼠标移动事件处理
    const handleMouseMove = (e) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div className={`background-system ${isVisible ? "visible" : ""}`}>
      {/* 动态光球 */}
      <div className="background-layer">
        <div
          className="background-orb orb-1"
          style={{
            transform: `translate(${mousePosition.x * 0.02}px, ${
              mousePosition.y * 0.02
            }px)`,
          }}
        />
        <div
          className="background-orb orb-2"
          style={{
            transform: `translate(${mousePosition.x * -0.015}px, ${
              mousePosition.y * -0.015
            }px)`,
          }}
        />
        <div
          className="background-orb orb-3"
          style={{
            transform: `translate(${mousePosition.x * 0.01}px, ${
              mousePosition.y * 0.01
            }px)`,
          }}
        />
      </div>
    </div>
  );
};

export default BackgroundSystem;
