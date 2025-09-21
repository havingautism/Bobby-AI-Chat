import React, { useState } from "react";
import { getCurrentLanguage, t } from "../utils/language";
import "./KnowledgeReferences.css";

const KnowledgeReferences = ({ references = [], onReferenceClick }) => {
  const [expandedReferences, setExpandedReferences] = useState(new Set());
  const currentLanguage = getCurrentLanguage();

  if (!references || references.length === 0) {
    return null;
  }

  const toggleReference = (index) => {
    const newExpanded = new Set(expandedReferences);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedReferences(newExpanded);
  };

  const handleReferenceClick = (reference) => {
    if (onReferenceClick) {
      onReferenceClick(reference);
    }
  };

  return (
    <div className="knowledge-references">
      <div className="knowledge-references-header">
        <div className="knowledge-references-icon">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10,9 9,9 8,9" />
          </svg>
        </div>
        <span className="knowledge-references-title">
          {currentLanguage === "zh" ? "引用的文档" : "Referenced Documents"}
        </span>
        <span className="knowledge-references-count">
          ({references.length})
        </span>
      </div>

      <div className="knowledge-references-list">
        {references.map((reference, index) => (
          <div
            key={reference.document_id || index}
            className="knowledge-reference-item"
            onClick={() => handleReferenceClick(reference)}
          >
            <div className="knowledge-reference-header">
              <div className="knowledge-reference-info">
                <div className="knowledge-reference-title">
                  {reference.document_title ||
                    reference.file_name ||
                    "未知文档"}
                </div>
                <div className="knowledge-reference-meta">
                  <span className="knowledge-reference-similarity">
                    相似度: {(reference.similarity * 100).toFixed(1)}%
                  </span>
                  {reference.file_name && (
                    <span className="knowledge-reference-filename">
                      {reference.file_name}
                    </span>
                  )}
                </div>
              </div>
              <button
                className="knowledge-reference-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleReference(index);
                }}
                title={expandedReferences.has(index) ? "收起" : "展开"}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{
                    transform: expandedReferences.has(index)
                      ? "rotate(180deg)"
                      : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                >
                  <polyline points="6,9 12,15 18,9" />
                </svg>
              </button>
            </div>

            {expandedReferences.has(index) && reference.content_preview && (
              <div className="knowledge-reference-preview">
                <div className="knowledge-reference-preview-content">
                  {reference.content_preview}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default KnowledgeReferences;
