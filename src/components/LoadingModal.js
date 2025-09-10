import React from 'react';
import './LoadingModal.css';

const LoadingModal = ({ 
  isOpen, 
  onClose, 
  title = "处理中", 
  message = "请稍候...", 
  progress = null,
  steps = [],
  currentStep = 0,
  showProgress = true,
  showCancel = true,
  onCancel = null
}) => {
  if (!isOpen) return null;

  return (
    <div className="loading-modal-overlay">
      <div className="loading-modal">
        <div className="loading-modal-header">
          <h3>{title}</h3>
          {showCancel && (
            <button className="loading-modal-close" onClick={onClose}>
              ×
            </button>
          )}
        </div>
        
        <div className="loading-modal-content">
          {/* 主要消息 */}
          <div className="loading-modal-message">
            <div className="loading-spinner"></div>
            <p>{message}</p>
          </div>

          {/* 进度条 */}
          {showProgress && (progress !== null || steps.length > 0) && (
            <div className="loading-progress">
              {progress !== null && (
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${progress}%` }}
                  ></div>
                  <span className="progress-text">{Math.round(progress)}%</span>
                </div>
              )}
              
              {steps.length > 0 && (
                <div className="steps-progress">
                  {steps.map((step, index) => (
                    <div 
                      key={index}
                      className={`step-item ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
                    >
                      <div className="step-icon">
                        {index < currentStep ? '✓' : index + 1}
                      </div>
                      <div className="step-text">
                        <div className="step-title">{step.title}</div>
                        <div className="step-description">{step.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 详细状态 */}
          <div className="loading-status">
            <div className="status-item">
              <span className="status-indicator active"></span>
              <span>正在处理</span>
            </div>
          </div>

          {/* 取消按钮 */}
          {showCancel && onCancel && (
            <div className="loading-modal-actions">
              <button 
                className="cancel-btn" 
                onClick={onCancel}
              >
                取消操作
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoadingModal;