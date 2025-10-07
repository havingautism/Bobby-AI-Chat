import React, { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import "./Modal.css";

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'area[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  hideClose = false,
  closeOnOverlay = true,
  initialFocusRef = null,
  footer = null,
  actions = null,
  ariaLabelledBy,
  ariaDescribedBy,
}) => {
  const overlayRef = useRef(null);
  const containerRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const titleIdRef = useRef(`modal-title-${Math.random().toString(36).slice(2)}`);

  const returnFocus = useCallback(() => {
    const prev = previouslyFocusedRef.current;
    if (prev && typeof prev.focus === 'function') {
      try { prev.focus(); } catch {}
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement;
    document.body.classList.add('modal-open');

    const node = containerRef.current;
    const focusTarget = initialFocusRef?.current || node?.querySelector(FOCUSABLE_SELECTORS);
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus();
    } else if (node) {
      node.setAttribute('tabindex', '-1');
      node.focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (onClose) onClose();
      } else if (e.key === 'Tab') {
        // basic focus trap
        const focusables = node ? Array.from(node.querySelectorAll(FOCUSABLE_SELECTORS)) : [];
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose, initialFocusRef]);

  useEffect(() => {
    if (!isOpen) return;
    return () => {
      document.body.classList.remove('modal-open');
      returnFocus();
    };
  }, [isOpen, returnFocus]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (!closeOnOverlay) return;
    if (e.target === overlayRef.current && onClose) onClose();
  };

  const labelledBy = ariaLabelledBy || (title ? titleIdRef.current : undefined);

  const content = (
    <div
      ref={overlayRef}
      className="modal-root-overlay modal-overlay"
      onClick={handleOverlayClick}
    >
      <div
        ref={containerRef}
        className={`modal-container modal-content modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={ariaDescribedBy}
      >
        {(title || !hideClose) && (
          <div className="modal-header">
            {title && (
              <h3 id={labelledBy} className="modal-title">{title}</h3>
            )}
            {!hideClose && (
              <button
                className="modal-close-btn"
                onClick={onClose}
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        <div className="modal-body">
          {children}
        </div>

        {(footer || (actions && actions.length)) && (
          <div className="modal-footer">
            {footer}
            {actions && actions.map((action, idx) => (
              <button
                key={idx}
                className={`modal-action-btn ${action.primary ? 'primary' : ''}`}
                onClick={action.onClick}
                autoFocus={action.autoFocus}
                disabled={action.disabled}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default Modal;

