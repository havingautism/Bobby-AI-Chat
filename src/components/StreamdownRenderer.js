import React from "react";
import { Streamdown } from "streamdown";
import CodeBlock from "./CodeBlock";

const StreamdownRenderer = ({ children, className }) => {
  return (
    <Streamdown
      className={className}
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const language = match ? match[1] : "text";
          const content = String(children).replace(/\n$/, "");

          // 对于简单的文本内容（如单个单词、短语），使用简洁的显示方式
          const isSimpleText = content.length <= 50 && !content.includes('\n') && !content.includes(';') && !content.includes('{') && !content.includes('}');
          
          return !inline ? (
            isSimpleText ? (
              <div className="simple-text-block">
                <span className="simple-text-content">{content}</span>
              </div>
            ) : (
              <CodeBlock language={language}>
                {content}
              </CodeBlock>
            )
          ) : (
            <code className="inline-code" {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {children}
    </Streamdown>
  );
};

export default StreamdownRenderer;
