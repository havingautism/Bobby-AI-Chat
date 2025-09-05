import React from "react";
import CodeBlock from "./CodeBlock";

// 简单的fallback组件，直接渲染markdown内容
const SimpleMarkdownRenderer = ({ children, className, components }) => {
  return (
    <div className={className}>
      {children}
    </div>
  );
};

const StreamdownRenderer = ({ children, className }) => {
  // 使用简单的fallback渲染器
  return (
    <SimpleMarkdownRenderer className={className}>
      {children}
    </SimpleMarkdownRenderer>
  );
};

export default StreamdownRenderer;
