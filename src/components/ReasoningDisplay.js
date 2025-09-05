import React, { useState } from "react";
import ReasoningContentRenderer from "./ReasoningContentRenderer";
import { getCurrentLanguage, t } from "../utils/language";
import "./ReasoningDisplay.css";

const ReasoningDisplay = ({ reasoning, isStreaming = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentLanguage] = useState(() => getCurrentLanguage());
  
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
           

    <svg xmlns="http://www.w3.org/2000/svg" width="16px" height="16px" viewBox="0 0 48 48" >{/* Icon from IconPark Outline by ByteDance - https://github.com/bytedance/IconPark/blob/master/LICENSE */}<g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4"><path d="m38 21l5 9l-5 1v6h-3l-6-1l-1 7H13l-2-10.381C7.92 29.703 6 25.576 6 21c0-8.837 7.163-16 16-16s16 7.163 16 16" /><path d="M17 19a5 5 0 1 1 5 5v3m0 6v1" /></g></svg>
  
          </div>
          <span className="reasoning-title">{t('displayThinking', currentLanguage)}</span>
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
          <ReasoningContentRenderer>{reasoning}</ReasoningContentRenderer>
        </div>
      </div>
    </div>
  );
};

export default ReasoningDisplay;
