import React from "react";
import { Streamdown } from "streamdown";

const ReasoningContentRenderer = ({ children, className }) => {
  return (
    <Streamdown
      className={className}
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const language = match ? match[1] : "text";
          const content = String(children).replace(/\n$/, "");

          // 对于思考过程：
          // 1. 内联代码保持原样
          // 2. text语言的代码块直接显示文本内容
          // 3. 其他语言的代码块使用代码块样式
          if (inline) {
            return (
              <code className="inline-code" {...props}>
                {children}
              </code>
            );
          } else if (language === "text") {
            // text语言的代码块直接显示为文本段落
            return (
              <div className="reasoning-text-block">
                {content.split('\n').map((line, index) => (
                  <span key={index}>
                    {line}
                    {index < content.split('\n').length - 1 && <br />}
                  </span>
                ))}
              </div>
            );
          } else {
            // 其他语言的代码块使用正常的代码块样式
            return (
              <pre className="reasoning-pre">
                <code>{content}</code>
              </pre>
            );
          }
        },
        // 其他元素保持默认渲染
        table({ node, ...props }) {
          return <table className="reasoning-table" {...props} />;
        },
        th({ node, ...props }) {
          return <th className="reasoning-th" {...props} />;
        },
        td({ node, ...props }) {
          return <td className="reasoning-td" {...props} />;
        },
      }}
    >
      {children}
    </Streamdown>
  );
};

export default ReasoningContentRenderer;