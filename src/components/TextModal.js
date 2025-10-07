import React, { useState, useEffect } from 'react';
import "./TextModal.css";
import Modal from './Modal';

const TextModal = ({ isOpen, onClose, onAddText, currentLanguage }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setContent('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddText({
        title: title.trim(),
        content: content.trim(),
        sourceType: 'text'
      });
      onClose();
    } catch (error) {
      console.error('添加文本失败:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={currentLanguage === "zh" ? "添加文本内容" : "Add Text Content"} size="md">
      <div className="text-modal">
        <div className="text-modal-header">
          <h2>
            {currentLanguage === "zh" ? "添加文本内容" : "Add Text Content"}
          </h2>
          <button 
            className="text-modal-close"
            onClick={onClose}
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <div className="text-modal-content">
          <div className="text-form-group">
            <label>
              {currentLanguage === "zh" ? "标题" : "Title"}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={currentLanguage === "zh" ? "输入文本标题" : "Enter text title"}
              disabled={isSubmitting}
              onKeyPress={handleKeyPress}
            />
          </div>

          <div className="text-form-group">
            <label>
              {currentLanguage === "zh" ? "内容" : "Content"}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={currentLanguage === "zh" ? "输入文本内容..." : "Enter text content..."}
              rows={8}
              disabled={isSubmitting}
              onKeyPress={handleKeyPress}
            />
            <div className="text-hint">
              {currentLanguage === "zh" 
                ? "提示：按 Ctrl+Enter 或 Cmd+Enter 快速提交" 
                : "Tip: Press Ctrl+Enter or Cmd+Enter to submit quickly"
              }
            </div>
          </div>

          <div className="text-form-actions">
            <button 
              className="text-cancel-button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {currentLanguage === "zh" ? "取消" : "Cancel"}
            </button>
            <button 
              className="text-submit-button"
              onClick={handleSubmit}
              disabled={!title.trim() || !content.trim() || isSubmitting}
            >
              {isSubmitting 
                ? (currentLanguage === "zh" ? "添加中..." : "Adding...") 
                : (currentLanguage === "zh" ? "添加" : "Add")
              }
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default TextModal;
