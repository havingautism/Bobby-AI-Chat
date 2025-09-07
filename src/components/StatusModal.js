import React from "react";
import "./DeleteConfirmModal.css";

const StatusModal = ({
  isOpen,
  title,
  message,
  confirmText = "OK",
  cancelText = null,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && onCancel) onCancel();
  };

  return (
    <div className="delete-confirm-modal-overlay" onClick={handleBackdropClick}>
      <div className="delete-confirm-modal">
        <div className="delete-confirm-modal-content">
          {title && <h4 style={{ marginTop: 0 }}>{title}</h4>}
          <p className="delete-confirm-modal-message">{message}</p>
          {isLoading && (
            <div className="loading-spinner" style={{ marginTop: 12 }}></div>
          )}
        </div>

        <div className="delete-confirm-modal-actions">
          {cancelText && (
            <button className="delete-confirm-modal-btn cancel-btn" onClick={onCancel}>
              {cancelText}
            </button>
          )}
          <button className="delete-confirm-modal-btn confirm-btn" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatusModal;


