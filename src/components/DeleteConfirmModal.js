import React, { useEffect } from "react";
import { getCurrentLanguage, t } from "../utils/language";
import "./DeleteConfirmModal.css";

const DeleteConfirmModal = ({ 
  isOpen, 
  onConfirm, 
  onCancel, 
  title = null,
  currentLanguage = getCurrentLanguage() 
}) => {
  // 处理键盘事件
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      
      if (e.key === "Enter") {
        onConfirm();
      } else if (e.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onConfirm, onCancel]);

  // 处理背景点击
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="delete-confirm-modal-overlay" onClick={handleBackdropClick}>
      <div className="delete-confirm-modal">
      
        
        <div className="delete-confirm-modal-content">
          <p className="delete-confirm-modal-message">
            {title ? 
              t("deleteConversationWithTitle", currentLanguage).replace("{title}", title) :
              t("deleteConversationConfirm", currentLanguage)
            }
          </p>
          <p className="delete-confirm-modal-warning">
            {t("deleteConversationWarning", currentLanguage)}
          </p>
        </div>

        <div className="delete-confirm-modal-actions">
          <button
            className="delete-confirm-modal-btn cancel-btn"
            onClick={onCancel}
          >
            {t("cancel", currentLanguage)}
          </button>
          <button
            className="delete-confirm-modal-btn confirm-btn"
            onClick={onConfirm}
          >
            {t("delete", currentLanguage)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
