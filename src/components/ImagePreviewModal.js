import React, { useEffect } from 'react';
import './ImagePreviewModal.css';

const ImagePreviewModal = ({ isOpen, imageSrc, onClose }) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // 防止背景滚动
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="image-preview-modal-overlay" onClick={onClose}>
      <div className="image-preview-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="image-preview-close-btn" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <img 
          src={imageSrc} 
          alt="图片预览" 
          className="image-preview-modal-image"
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      </div>
    </div>
  );
};

export default ImagePreviewModal;
