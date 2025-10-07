import React, { useEffect } from 'react';
import Modal from './Modal';
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
    <Modal isOpen={isOpen} onClose={onClose} title={"图片预览"} size="lg">
      <div className="image-preview-modal-content">
        <img
          src={imageSrc}
          alt="图片预览"
          className="image-preview-modal-image"
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      </div>
    </Modal>
  );
};

export default ImagePreviewModal;
