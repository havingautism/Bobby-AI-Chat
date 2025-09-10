import React, { useEffect } from 'react';
import './Notification.css';

const Notification = ({ 
  id, 
  type = 'info', 
  title, 
  message, 
  duration = 5000, 
  onClose, 
  actions = [],
  persistent = false 
}) => {
  useEffect(() => {
    if (!persistent && duration > 0) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose, persistent]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return 'ℹ';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'success':
        return '#10b981';
      case 'error':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'info':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  return (
    <div className={`notification notification-${type}`}>
      <div className="notification-icon" style={{ color: getIconColor() }}>
        {getIcon()}
      </div>
      
      <div className="notification-content">
        <div className="notification-title">{title}</div>
        {message && <div className="notification-message">{message}</div>}
        
        {actions.length > 0 && (
          <div className="notification-actions">
            {actions.map((action, index) => (
              <button
                key={index}
                className={`notification-action ${action.primary ? 'primary' : ''}`}
                onClick={() => {
                  if (action.onClick) action.onClick();
                  onClose(id);
                }}
              >
                {action.text}
              </button>
            ))}
          </div>
        )}
      </div>
      
      <button 
        className="notification-close"
        onClick={() => onClose(id)}
      >
        ×
      </button>
      
      {!persistent && (
        <div className="notification-progress">
          <div 
            className="notification-progress-bar"
            style={{ 
              animation: `progress ${duration}ms linear forwards`,
              background: getIconColor()
            }}
          />
        </div>
      )}
    </div>
  );
};

export default Notification;