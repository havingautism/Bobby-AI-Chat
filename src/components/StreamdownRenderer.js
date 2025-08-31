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
    </Streamdown>
  );
};

export default StreamdownRenderer;
