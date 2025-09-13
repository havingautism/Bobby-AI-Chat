import React, { useState } from "react";
import { Streamdown } from "streamdown";
import CodeBlock from "./CodeBlock";
import MermaidModal from "./MermaidModal";
import { apiSessionManager } from "../utils/apiSessionManager";
import "./StreamdownRenderer.css";

// 自定义表格组件
const CustomTable = ({ children, ...props }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyTable = async () => {
    try {
      // 获取表格的文本内容
      const tableElement = document.querySelector('.custom-table');
      if (tableElement) {
        const text = tableElement.innerText;
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error("复制表格失败:", err);
    }
  };

  const handleDownloadTable = () => {
    try {
      // 获取表格元素
      const tableElement = document.querySelector('.custom-table');
      if (tableElement) {
        // 将表格转换为CSV格式
        const csvContent = tableToCSV(tableElement);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'table.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("下载表格失败:", err);
    }
  };

  // 将表格转换为CSV格式的函数
  const tableToCSV = (table) => {
    const rows = [];
    const tableRows = table.querySelectorAll('tr');
    
    tableRows.forEach(row => {
      const cells = [];
      const tableCells = row.querySelectorAll('td, th');
      
      tableCells.forEach(cell => {
        // 获取单元格文本内容，去除HTML标签
        let cellText = cell.textContent || cell.innerText || '';
        // 处理CSV中的特殊字符：如果包含逗号、引号或换行符，需要用引号包围
        if (cellText.includes(',') || cellText.includes('"') || cellText.includes('\n')) {
          // 转义引号：将 " 替换为 ""
          cellText = cellText.replace(/"/g, '""');
          // 用引号包围
          cellText = `"${cellText}"`;
        }
        cells.push(cellText);
      });
      
      rows.push(cells.join(','));
    });
    
    return rows.join('\n');
  };

  return (
    <div className="custom-table-wrapper">
      <div className="table-actions">
        <button
          className={`table-action-btn copy-btn ${copied ? 'copied' : ''}`}
          onClick={handleCopyTable}
          title={copied ? "已复制" : "复制表格"}
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m9 12 2 2 4-4" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
        <button
          className="table-action-btn download-btn"
          onClick={handleDownloadTable}
          title="下载表格"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7,10 12,15 17,10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
      </div>
      <table className="custom-table" {...props}>
        {children}
      </table>
    </div>
  );
};

const StreamdownRenderer = ({ children, className, isStreaming = false, conversationId }) => {
  const [showMermaidModal, setShowMermaidModal] = useState(false);
  const [currentCharts, setCurrentCharts] = useState([]);

  const handleViewMermaidCharts = (charts) => {
    setCurrentCharts(charts);
    setShowMermaidModal(true);
  };

  return (
    <>
      <Streamdown
        className={className}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "text";
            const content = String(children).replace(/\n$/, "");

            // 对于简单的文本内容（如单个单词、短语），使用span而不是div
            const isSimpleText = content.length <= 50 && !content.includes('\n') && !content.includes(';') && !content.includes('{') && !content.includes('}');
            
            // 如果是 mermaid 语言，显示代码块和查看流程图按钮
            if (language === 'mermaid' && !inline) {
              // 检查Mermaid代码是否看起来完整（包含图表类型和基本结构）
              const isMermaidComplete = content.trim() && (
                content.includes('graph') || 
                content.includes('flowchart') || 
                content.includes('sequenceDiagram') || 
                content.includes('classDiagram') || 
                content.includes('stateDiagram') ||
                content.includes('gantt') ||
                content.includes('pie') ||
                content.includes('gitgraph') ||
                content.includes('journey')
              );
              
              return (
                <div className="mermaid-code-block">
                  <CodeBlock language="mermaid">
                    {content}
                  </CodeBlock>
                  {(!isStreaming || isMermaidComplete) && (
                    <button 
                      className="view-mermaid-btn"
                      onClick={() => handleViewMermaidCharts([{ id: `chart_${Date.now()}`, code: content }])}
                    >
                      查看流程图
                    </button>
                  )}
                </div>
              );
            }
            
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
        // 自定义表格组件
        table: ({ children, ...props }) => (
          <CustomTable {...props}>
            {children}
          </CustomTable>
        ),
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
      
      <MermaidModal 
        isOpen={showMermaidModal}
        onClose={() => setShowMermaidModal(false)}
        charts={currentCharts}
      />
    </>
  );
};

export default StreamdownRenderer;