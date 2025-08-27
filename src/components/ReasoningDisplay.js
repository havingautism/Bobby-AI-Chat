import React, { useState } from "react";
import MarkdownRenderer from "./MarkdownRenderer";
import "./ReasoningDisplay.css";

const ReasoningDisplay = ({ reasoning, isStreaming = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 流式输出时自动展开，结束后自动收起
  React.useEffect(() => {
    if (isStreaming) {
      setIsExpanded(true);
    } else if (!isStreaming && reasoning) {
      // 流式结束后稍微延迟收起，让用户看到最终结果
      const timer = setTimeout(() => {
        setIsExpanded(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, reasoning]);

  if (!reasoning) return null;

  return (
    <div className="reasoning-container">
      <button
        className="reasoning-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <div className="reasoning-header">
          <div className="reasoning-icon">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 12l2 2 4-4" />
              <path d="M21 12c0 1.66-.5 3.22-1.4 4.51a9 9 0 1 1 0-9.02C20.5 8.78 21 10.34 21 12z" />
            </svg>
          </div>
          <span className="reasoning-title">推理过程</span>
          <div className={`reasoning-chevron ${isExpanded ? "expanded" : ""}`}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>
      </button>

      <div className={`reasoning-content ${isExpanded ? "expanded" : ""}`}>
        <div className="reasoning-inner">
          <MarkdownRenderer>{reasoning}</MarkdownRenderer>
        </div>
      </div>
    </div>
  );
};

export default ReasoningDisplay;
