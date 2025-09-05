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

          // 对于简单的文本内容（如单个单词、短语），使用span而不是div
          const isSimpleText = content.length <= 50 && !content.includes('\n') && !content.includes(';') && !content.includes('{') && !content.includes('}');
          
          return !inline ? (
            isSimpleText ? (
              <span className="simple-text-block">
                <span className="simple-text-content">{content}</span>
              </span>
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
        // 确保段落内不会出现块级元素
        p: ({ children, ...props }) => (
          <p {...props}>
            {React.Children.map(children, child => {
              // 如果子元素是块级元素，将其包装在span中
              if (React.isValidElement(child) && child.type === 'div') {
                return <span key={child.key || Math.random()}>{child}</span>;
              }
              return child;
            })}
          </p>
        ),
      }}
    >
      {children}
    </Streamdown>
  );
};

export default StreamdownRenderer;
