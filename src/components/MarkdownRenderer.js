import React from "react";
import ReactMarkdown from "react-markdown";
import CodeBlock from "./CodeBlock";

const MarkdownRenderer = ({ children }) => {
  return (
    <ReactMarkdown
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const language = match ? match[1] : "text";

          return !inline ? (
            <CodeBlock language={language}>
              {String(children).replace(/\n$/, "")}
            </CodeBlock>
          ) : (
            <code className="inline-code" {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
};

export default MarkdownRenderer;
