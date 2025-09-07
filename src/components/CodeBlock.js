import React, { useState, useEffect } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  vscDarkPlus,
  vs,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { getCurrentTheme } from "../utils/theme";
import "./CodeBlock.css";

const CodeBlock = ({ children, language = "text" }) => {
  const [copied, setCopied] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => getCurrentTheme());
  const [isMobile, setIsMobile] = useState(false);

  // 检测移动设备
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

  // 监听主题变化
  useEffect(() => {
    const handleThemeChange = (event) => {
      setCurrentTheme(event.detail);
    };

    window.addEventListener("themeChanged", handleThemeChange);
    return () => {
      window.removeEventListener("themeChanged", handleThemeChange);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("复制失败:", err);
    }
  };

  // 获取语言图标
  const getLanguageIcon = (lang) => {
    const icons = {
      javascript: "🟨",
      js: "🟨",
      typescript: "🔷",
      ts: "🔷",
      python: "🐍",
      py: "🐍",
      java: "☕",
      html: "🌐",
      css: "🎨",
      json: "📋",
      xml: "📄",
      sql: "🗃️",
      bash: "👨🏻‍💻",
      shell: "👨🏻‍💻",
      powershell: "💙",
      c: "⚙️",
      cpp: "⚙️",
      csharp: "💜",
      php: "🐘",
      ruby: "💎",
      go: "🐹",
      rust: "🦀",
      swift: "🍎",
      kotlin: "🟣",
      dart: "🎯",
      r: "📊",
      matlab: "🔢",
      scala: "🔴",
      perl: "🐪",
      lua: "🌙",
      default: "👨🏻‍💻",
    };
    return icons[lang.toLowerCase()] || icons.default;
  };

  // 判断是否为text代码块
  const isTextCodeBlock = language === "text" || language === "plaintext";

  return (
    <div className="code-block">
      {!isTextCodeBlock && (
        <div className="code-header">
          <div className="code-language">
            <span className="language-icon">{getLanguageIcon(language)}</span>
            <span className="language-name">{language}</span>
          </div>
          <button
            className={`copy-button ${copied ? "copied" : ""}`}
            onClick={handleCopy}
            title="复制代码"
          >
            {copied ? (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <span>已复制</span>
              </>
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
                {/* <span>复制</span> */}
              </>
            )}
          </button>
        </div>
      )}
      <div className="code-content">
        <SyntaxHighlighter
          language={language}
          style={currentTheme === "dark" ? vscDarkPlus : vs}
          customStyle={{
            margin: 0,
            padding: "16px",
            background: "transparent",
            fontSize: isMobile ? "13px" : "14px", // 移动端使用更大字体
            lineHeight: "1.5",
            maxWidth: "100%",
            width: "100%",
            boxSizing: "border-box",
            overflowX: "auto",
            whiteSpace: "pre",
            wordWrap: "normal",
            border: "none",
            borderRadius: "0",
          }}
          codeTagProps={{
            style: {
              fontFamily: "inherit",
              maxWidth: "100%",
              display: "block",
              overflow: "visible",
            },
          }}
        >
          {children}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export default CodeBlock;
