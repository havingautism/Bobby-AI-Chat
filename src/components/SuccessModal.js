import React, { useEffect } from 'react';
import Modal from './Modal';
import './SuccessModal.css';

const SuccessModal = ({ 
  open, 
  onClose, 
  title, 
  message, 
  details, 
  actions = [],
  autoClose = true,
  autoCloseDelay = 5000,
  type = 'success' // 'success' | 'error' | 'warning'
}) => {
  useEffect(() => {
    if (open && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);
      
      return () => clearTimeout(timer);
    }
  }, [open, autoClose, autoCloseDelay, onClose]);

  if (!open) return null;

  return (
    <Modal isOpen={open} onClose={onClose} title={title} size="sm">
      <div className="success-modal">
        <div className={`success-icon ${type}`}>
          {type === 'success' && (
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" 
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {type === 'error' && (
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" 
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {type === 'warning' && (
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" 
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        
        <div className="success-content">
          <h3 className="success-title">{title}</h3>
          <p className="success-message">{message}</p>
          
          {details && (
            <div className="success-details">
              {details.map((detail, index) => (
                <div key={index} className="detail-item">
                  <span className="detail-label">{detail.label}:</span>
                  <span className="detail-value">{detail.value}</span>
                </div>
              ))}
            </div>
          )}
          
          {actions.length > 0 && (
            <div className="success-actions">
              {actions.map((action, index) => (
                <button
                  key={index}
                  className={`success-action ${action.primary ? 'primary' : 'secondary'}`}
                  onClick={action.onClick}
                >
                  {action.icon && <span className="action-icon">{action.icon}</span>}
                  {action.text}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <button className="success-close" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        
        {autoClose && (
          <div className="success-auto-close">
            <div className="auto-close-progress">
              <div className="progress-bar" style={{ animationDuration: `${autoCloseDelay}ms` }}></div>
            </div>
            <span className="auto-close-text">
              {autoCloseDelay / 1000}s 后自动关闭
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default SuccessModal;
