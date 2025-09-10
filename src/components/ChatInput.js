import React, { useState, useEffect, useRef } from "react";
import { getCurrentLanguage, t } from "../utils/language";
import { isModelSupportResponseModes } from "../utils/modelUtils";
// import { isTauriEnvironment } from "../utils/tauriDetector";
import { knowledgeBaseManager } from "../utils/knowledgeBaseQdrant";
import FileIcon from "./FileIcon";
import "./ChatInput.css";

// 导入PDF和Word文档解析库
const pdfjsLib = require('pdfjs-dist');
const mammoth = require('mammoth');

// 配置PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const ChatInput = ({ 
  onSendMessage, 
  disabled, 
  isStreaming = false,
  onStopStreaming = () => {},
  showBottomToolbar = true,
  showFileUpload = true,
  placeholder,
  expandDirection = "auto", // "up", "down", "auto"
  className = "",
  onNewChat = () => {},
  onAddTab = () => {},
  responseMode: externalResponseMode,
  onResponseModeChange,
  currentModel = "", // 当前选择的模型
  onOpenKnowledgeBase, // 知识库管理功能
}) => {
  const [message, setMessage] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showQuickResponseDropdown, setShowQuickResponseDropdown] = useState(false);
  const [showKnowledgeBaseDropdown, setShowKnowledgeBaseDropdown] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(() => getCurrentLanguage());
  const [uploadedFile, setUploadedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [showUploadDropdown, setShowUploadDropdown] = useState(false);
  const [responseMode, setResponseMode] = useState(externalResponseMode || "normal"); // normal 或 thinking
  const [selectedDocuments, setSelectedDocuments] = useState([]); // 多选的文档列表
  const [knowledgeDocuments, setKnowledgeDocuments] = useState([]); // 知识库文档列表
  const [documentSearchQuery, setDocumentSearchQuery] = useState(''); // 文档搜索查询
  const dropdownRef = useRef(null);
  const quickResponseRef = useRef(null);
  const knowledgeBaseRef = useRef(null);
  const uploadDropdownRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

 const isTauriEnvironment = () => {
  if (typeof window === 'undefined') return false;
  
  // 检查多种Tauri标识
  return Boolean(
    window.__TAURI__ !== undefined || 
    window.__TAURI_IPC__ !== undefined ||
    window.__TAURI_INTERNALS__ !== undefined ||
    window.__TAURI_METADATA__ !== undefined ||
    navigator.userAgent.includes('Tauri') ||
    Object.keys(window).some(key => key.includes('TAURI'))
  );
};

  // 判断当前模型是否支持响应模式
  const supportsResponseModes = isModelSupportResponseModes(currentModel);

  // 加载知识库文档
  const loadKnowledgeDocuments = async () => {
    try {
      await knowledgeBaseManager.initialize();
      const docs = await knowledgeBaseManager.getDocuments();
      setKnowledgeDocuments(docs);
    } catch (error) {
      console.error('加载知识库文档失败:', error);
    }
  };

  // 处理文档选择
  const toggleDocumentSelection = (docId) => {
    setSelectedDocuments(prev => {
      if (prev.includes(docId)) {
        return prev.filter(id => id !== docId);
      } else {
        return [...prev, docId];
      }
    });
  };

  // 清除所有选择的文档
  const clearSelectedDocuments = () => {
    setSelectedDocuments([]);
  };

  // 过滤文档列表
  const filteredDocuments = knowledgeDocuments.filter(doc => {
    if (!documentSearchQuery.trim()) return true;
    const query = documentSearchQuery.toLowerCase();
    return (
      doc.title.toLowerCase().includes(query) ||
      (doc.fileName && doc.fileName.toLowerCase().includes(query)) ||
      (doc.sourceType && doc.sourceType.toLowerCase().includes(query))
    );
  });

  // 使用知识库结果的功能已内联到onClick处理函数中

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((message.trim() || uploadedFile) && !disabled) {
      onSendMessage(message, uploadedFile, { 
        responseMode,
        selectedDocuments: selectedDocuments.length > 0 ? selectedDocuments : null
      });
      setMessage("");
      setUploadedFile(null);
      setFilePreview(null);
      
      // 发送消息后重置输入框高度
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = "24px";
          window.dispatchEvent(new CustomEvent('inputHeightChange'));
        }
      }, 100);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // 监听语言变化
  useEffect(() => {
    const handleLanguageChange = (event) => {
      setCurrentLanguage(event.detail);
    };

    window.addEventListener("languageChanged", handleLanguageChange);
    return () => {
      window.removeEventListener("languageChanged", handleLanguageChange);
    };
  }, []);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (quickResponseRef.current && !quickResponseRef.current.contains(event.target)) {
        setShowQuickResponseDropdown(false);
      }
      if (knowledgeBaseRef.current && !knowledgeBaseRef.current.contains(event.target)) {
        setShowKnowledgeBaseDropdown(false);
      }
      if (uploadDropdownRef.current && !uploadDropdownRef.current.contains(event.target)) {
        setShowUploadDropdown(false);
      }
    };

    if (showDropdown || showQuickResponseDropdown || showKnowledgeBaseDropdown || showUploadDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDropdown, showQuickResponseDropdown, showKnowledgeBaseDropdown, showUploadDropdown]);

  // 动态调整chat-messages的padding-bottom以适应输入框高度
  useEffect(() => {
    const updateMessagesPadding = () => {
      if (textareaRef.current) {
        const inputContainer = textareaRef.current.closest('.chat-input-container');
        const chatMessages = document.querySelector('.chat-messages');
        
        if (inputContainer && chatMessages) {
          // 移除所有padding bottom，不预留空白
          chatMessages.style.paddingBottom = '0px';
        }
      }
    };

    // 初始化时设置一次
    updateMessagesPadding();

    // 监听窗口大小变化
    const handleResize = () => {
      updateMessagesPadding();
    };

    window.addEventListener('resize', handleResize);
    
    // 监听输入框内容变化（通过自定义事件）
    const handleInputChange = () => {
      setTimeout(updateMessagesPadding, 10); // 延迟10ms确保DOM已更新
    };

    window.addEventListener('inputHeightChange', handleInputChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('inputHeightChange', handleInputChange);
    };
  }, [className]); // 添加className依赖

  // 当知识库下拉菜单打开时加载文档
  useEffect(() => {
    if (showKnowledgeBaseDropdown) {
      loadKnowledgeDocuments();
    }
  }, [showKnowledgeBaseDropdown]);

  // 监听message状态变化，当消息被清空时重置输入框高度
  useEffect(() => {
    if (!message.trim() && textareaRef.current) {
      // 延迟重置以确保DOM更新完成
      setTimeout(() => {
        if (textareaRef.current && !textareaRef.current.value.trim()) {
          textareaRef.current.style.height = "24px";
          window.dispatchEvent(new CustomEvent('inputHeightChange'));
        }
      }, 50);
    }
  }, [message]);

  // 同步外部 responseMode 的变化
  useEffect(() => {
    if (externalResponseMode !== undefined) {
      setResponseMode(externalResponseMode);
    }
  }, [externalResponseMode]);


  // 处理文件上传
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setUploadedFile(file);
      
      // 如果是图片文件，创建预览
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFilePreview(e.target.result);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
      
      setShowDropdown(false);
    }
  };

  // 删除上传的文件
  const removeFile = () => {
    setUploadedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 触发文件选择
  const triggerFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 触发文档上传
  const triggerDocumentUpload = () => {
    setShowUploadDropdown(false);
    // 创建临时文件输入框
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.txt,.md,.html,.htm';
    input.onchange = (e) => handleDocumentUpload(e);
    input.click();
  };

  // 触发图片上传
  const triggerImageUpload = () => {
    setShowUploadDropdown(false);
    // 创建临时文件输入框
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => handleImageUpload(e);
    input.click();
  };

  // 处理文档上传
  const handleDocumentUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      // 读取文档内容
      const text = await readDocumentContent(file);
      if (text) {
        // 将文档内容添加到system prompt
        setUploadedFile({
          name: file.name,
          type: 'document',
          content: text,
          size: file.size
        });
        setFilePreview(null);
      }
    } catch (error) {
      console.error('Error reading document:', error);
      // 错误已经在readDocumentContent函数中处理，这里不需要重复提示
    }
  };

  // 处理图片上传
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      // 压缩图片
      const compressedFile = await compressImage(file);
      
      // 创建预览
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedFile({
          name: compressedFile.name,
          type: 'image',
          file: compressedFile,
          size: compressedFile.size
        });
        setFilePreview(e.target.result);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error('Error processing image:', error);
      alert(currentLanguage === "zh" ? "图片处理失败" : "Failed to process image");
    }
  };

  // 读取文档内容
  const readDocumentContent = async (file) => {
    try {
      let text = '';
      
      // 根据文件类型选择解析方法
      if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        // 纯文本文件
        text = await readTextFile(file);
      } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        // PDF文件
        text = await readPdfFile(file);
      } else if (file.type.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
        // Word文档
        text = await readWordFile(file);
      } else if (file.type === 'text/html' || file.name.endsWith('.html') || file.name.endsWith('.htm')) {
        // HTML文件
        text = await readTextFile(file);
      } else {
        throw new Error('Unsupported file type');
      }
      
      // 检查文本长度（限制为2000-4000 Tokens，大约1000-3000个汉字）
      // 中文字符通常算作2个Tokens，英文字符算作1个Token
      // 这里使用字符数作为近似估算，限制在3000个字符以内
      const maxChars = 3000;
      if (text.length > maxChars) {
        alert(currentLanguage === "zh" ? `文档内容过长（${text.length}字符），超过3000字符限制，请添加到知识库中处理` : `Document content too long (${text.length} characters), exceeds 3000 character limit, please add to knowledge base`);
        throw new Error('Text too large');
      }
      
      return text;
    } catch (error) {
      console.error('Error reading document:', error);
      if (error.message === 'Unsupported file type') {
        alert(currentLanguage === "zh" ? "不支持的文件格式，请上传文本文件、PDF或Word文档" : "Unsupported file format, please upload text files, PDF or Word documents");
      }
      throw error;
    }
  };

  // 读取纯文本文件
  const readTextFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };

  // 读取PDF文件
  const readPdfFile = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      
      // 读取每一页的文本
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }
      
      return fullText.trim();
    } catch (error) {
      console.error('Error reading PDF:', error);
      throw new Error('Failed to read PDF file');
    }
  };

  // 读取Word文件
  const readWordFile = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
      return result.value.trim();
    } catch (error) {
      console.error('Error reading Word document:', error);
      throw new Error('Failed to read Word document');
    }
  };

  // 压缩图片
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // 计算新尺寸（最大800px）
        const MAX_SIZE = 800;
        let width = img.width;
        let height = img.height;
        
        if (width > height && width > MAX_SIZE) {
          height = height * (MAX_SIZE / width);
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width = width * (MAX_SIZE / height);
          height = MAX_SIZE;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // 绘制压缩后的图片
        ctx.drawImage(img, 0, 0, width, height);
        
        // 转换为blob
        canvas.toBlob((blob) => {
          if (blob) {
            // 创建新的File对象
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            reject(new Error('Failed to compress image'));
          }
        }, 'image/jpeg', 0.8);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };


  // 确定展开方向
  const getExpandDirection = () => {
    if (expandDirection !== "auto") {
      return expandDirection;
    }
    
    // 自动判断：根据组件在页面中的位置决定
    const container = document.querySelector(`.${className || 'chat-input-container'}`);
    if (container) {
      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // 如果上方空间不足，向下展开
      if (spaceAbove < 100 && spaceBelow > spaceAbove) {
        return "down";
      }
      // 否则向上展开
      return "up";
    }
    
    return "up"; // 默认向上展开
  };

  return (
    <div className={`chat-input-container ${className}`}>
      <form onSubmit={handleSubmit} className="chat-input-form">
        <div className="input-wrapper-clean">
          {/* 文件预览区域 */}
          {showFileUpload && uploadedFile && (
            <div className="file-preview-container">
              {filePreview ? (
                <div className="image-preview">
                  <img src={filePreview} alt="预览" className="preview-image" />
                  <button
                    type="button"
                    className="remove-file-btn"
                    onClick={removeFile}
                    title="删除文件"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="file-info">
                  <div className="file-details">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14,2 14,8 20,8" />
                    </svg>
                    <span className="file-name">{uploadedFile.name}</span>
                    <span className="file-size">({(uploadedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    type="button"
                    className="remove-file-btn"
                    onClick={removeFile}
                    title="删除文件"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 主要输入区域 */}
          <div className="input-main-area">
            {/* 消息输入框 */}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || (uploadedFile ? t("typeMessageWithFile", currentLanguage) : t("typeMessage", currentLanguage))}
              disabled={disabled}
              rows={1}
              ref={textareaRef}
              className="message-textarea-clean"
              style={{
                height: "auto",
                minHeight: "24px",
                maxHeight: "128px",
                outline: "none",
                border: "none",
                boxShadow: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
                appearance: "none",
              }}
              onInput={(e) => {
                e.target.style.height = "auto";
                
                // 移动端和桌面端使用不同的最大高度
                const isMobile = window.innerWidth <= 768;
                const maxHeight = isMobile ? 80 : 128;
                
                e.target.style.height =
                  Math.min(e.target.scrollHeight, maxHeight) + "px";
                
                // 根据配置的展开方向设置样式
                const direction = getExpandDirection();
                const container = e.target.closest('.chat-input-container');
                if (container) {
                  if (direction === "up") {
                    container.classList.add('expand-upward');
                    container.classList.remove('expand-downward');
                  } else {
                    container.classList.add('expand-downward');
                    container.classList.remove('expand-upward');
                  }
                }
                
                // 触发自定义事件通知输入框高度变化
                window.dispatchEvent(new CustomEvent('inputHeightChange'));
                
                // 简化的移动端键盘处理
                if (isMobile && document.activeElement === e.target && !className.includes('welcome-chat-input')) {
                  // 简单的滚动到输入框，让CSS处理视口适配
                  setTimeout(() => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }, 100);
                }
              }}
              
              // 添加失焦事件处理
              onBlur={(e) => {
                // 重置输入框高度为单行高度
                e.target.style.height = "auto";
                
                // 移除键盘打开的类（如果需要）
                const isMobile = window.innerWidth <= 768;
                if (isMobile && !className.includes('welcome-chat-input')) {
                  document.body.classList.remove('keyboard-open');
                  
                  // 移动端失焦时触发padding更新
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('inputHeightChange'));
                  }, 50);
                }
                
                // 如果输入框内容为空，确保重置为最小高度
                if (!e.target.value.trim()) {
                  e.target.style.height = "24px";
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('inputHeightChange'));
                  }, 50);
                }
              }}
            />

            {/* 发送/停止按钮 */}
            {isStreaming ? (
              <button
                type="button"
                className="stop-button"
                onClick={onStopStreaming}
                title={t("stop", currentLanguage)}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                type="submit"
                disabled={(!message.trim() && !uploadedFile) || disabled}
                className={`send-button ${(message.trim() || uploadedFile) ? 'has-content' : ''}`}
                title={t("send", currentLanguage)}
              >
                {(message.trim() || uploadedFile) ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="35px" height="35px" viewBox="0 0 24 24">{/* Icon from Material Symbols by Google - https://github.com/google/material-design-icons/blob/master/LICENSE */}<path fill="currentColor" d="M11 16h2v-4.2l1.6 1.6L16 12l-4-4l-4 4l1.4 1.4l1.6-1.6zm1 6q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="35px" height="35px" viewBox="0 0 24 24">{/* Icon from Material Symbols by Google - https://github.com/google/material-design-icons/blob/master/LICENSE */}<path fill="currentColor" d="M11 16h2v-4.2l1.6 1.6L16 12l-4-4l-4 4l1.4 1.4l1.6-1.6zm1 6q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22" /></svg>
                )}
              </button>
            )}
          </div>

          {/* 输入框内工具栏 */}
          <div className="input-toolbar">
            {/* 左侧按钮组 */}
            <div className="toolbar-left">
              {/* 上传按钮 */}
              <div className="upload-button-container" ref={uploadDropdownRef}>
                <button
                  type="button"
                  className="plus-button-inline"
                  onClick={() => setShowUploadDropdown(!showUploadDropdown)}
                  disabled={disabled}
                  title={t("upload", currentLanguage)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14m-7-7h14" />
                  </svg>
                </button>
                
                {/* 上传选项下拉框 */}
                {showUploadDropdown && (
                  <div className="upload-dropdown">
                    <button
                      type="button"
                      className="upload-option"
                      onClick={triggerDocumentUpload}
                      disabled={true}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14,2 14,8 20,8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10,9 9,9 8,9"/>
                      </svg>
                      <span>{currentLanguage === "zh" ? "上传文档(即将支持)" : "Upload Document(coming soon)"}</span>
                    </button>
                    <button
                      type="button"
                      className="upload-option"
                      onClick={triggerImageUpload}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21,15 16,10 5,21"/>
                      </svg>
                      <span>{currentLanguage === "zh" ? "上传图片" : "Upload Image"}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 响应模式滑动切换按钮 */}
              {supportsResponseModes && (
                <div className="response-mode-slider-container">
                  <div 
                    className={`response-mode-slider ${responseMode === "thinking" ? "thinking-mode" : "normal-mode"}`}
                    onClick={() => {
                      const newMode = responseMode === "normal" ? "thinking" : "normal";
                      setResponseMode(newMode);
                      if (onResponseModeChange) {
                        onResponseModeChange(newMode);
                      }
                    }}
                    title={responseMode === "normal" ? "切换到思考模式" : "切换到快速模式"}
                  >
                    <span className={`slider-label ${responseMode === "normal" ? "active" : ""}`}>快速</span>
                    <div className="slider-track">
                      <div className="slider-thumb">
                        {responseMode === "normal" ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className={`slider-label ${responseMode === "thinking" ? "active" : ""}`}>思考</span>
                  </div>
                </div>
              )}

              {/* 知识库下拉按钮 */}
              {isTauriEnvironment() && (
                <div className="knowledge-base-dropdown" ref={knowledgeBaseRef}>
                  <button
                    type="button"
                    className={`knowledge-base-btn ${selectedDocuments.length > 0 ? 'active' : ''}`}
                    onClick={() => setShowKnowledgeBaseDropdown(!showKnowledgeBaseDropdown)}
                    disabled={disabled}
                    title="知识库"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                      <path d="M8 7h8"/>
                      <path d="M8 11h8"/>
                      <path d="M8 15h5"/>
                    </svg>
                    <span>知识库</span>
                    {selectedDocuments.length > 0 && (
                      <span className="selected-count">{selectedDocuments.length}</span>
                    )}
                    {/* <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6"/>
                    </svg> */}
                  </button>

                  {/* 知识库下拉菜单 */}
                  {showKnowledgeBaseDropdown && (
                    <div className="knowledge-base-menu">
                      <div className="knowledge-base-header">
                        <h4>选择知识库文档</h4>
                        <div className="knowledge-base-actions">
                          <button 
                            className="manage-kb-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenKnowledgeBase();
                              setShowKnowledgeBaseDropdown(false);
                            }}
                          >
                            管理知识库
                          </button>
                        </div>
                      </div>
                      
                      {/* 搜索框 */}
                      <div className="document-search-container">
                        <div className="document-search-input">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8"/>
                            <path d="m21 21-4.35-4.35"/>
                          </svg>
                          <input
                            type="text"
                            placeholder="搜索文档..."
                            value={documentSearchQuery}
                            onChange={(e) => setDocumentSearchQuery(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          {documentSearchQuery && (
                            <button 
                              className="clear-search-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDocumentSearchQuery('');
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12"/>
                              </svg>
                            </button>
                          )}
                        </div>
                        <div className="kb-selection-bar">
                          <div className="kb-selection-info">
                            {selectedDocuments.length > 0 ? (
                              <span>已选择 {selectedDocuments.length} 项</span>
                            ) : (
                              <span>未选择文档</span>
                            )}
                          </div>
                          <div className="kb-selection-actions">
                            {selectedDocuments.length > 0 && (
                              <button 
                                className="clear-selection-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearSelectedDocuments();
                                }}
                              >
                                清除选择
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="documents-list">
                        {filteredDocuments.length === 0 ? (
                          <div className="empty-documents">
                            <p>{documentSearchQuery ? '没有找到匹配的文档' : '暂无知识库文档'}</p>
                            <button 
                              className="add-document-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenKnowledgeBase();
                                setShowKnowledgeBaseDropdown(false);
                              }}
                            >
                              添加文档
                            </button>
                          </div>
                        ) : (
                          filteredDocuments.map((doc) => (
                            <div 
                              key={doc.id} 
                              className={`document-item ${selectedDocuments.includes(doc.id) ? 'selected' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleDocumentSelection(doc.id);
                              }}
                            >
                              <div className="document-icon">
                                <FileIcon 
                                  fileName={doc.fileName || doc.title} 
                                  mimeType={doc.mimeType}
                                  sourceType={doc.sourceType}
                                  size="small"
                                />
                              </div>
                              <div className="document-info">
                                <div className="document-title">{doc.title}</div>
                                <div className="document-meta">
                                  <span className="document-type">{doc.sourceType || 'manual'}</span>
                                  <span className="document-date">
                                    {new Date(doc.created_at || doc.createdAt || Date.now()).toLocaleDateString()}
                                  </span>
                                  {doc.fileSize && (
                                    <span className="document-size">
                                      {(doc.fileSize / 1024).toFixed(1)} KB
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="kb-check-icon" aria-hidden="true">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M20 6L9 17l-5-5" />
                                </svg>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      
                      {/* 已选统计移至搜索框下方，这里不再显示 */}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 隐藏的文件输入 */}
          {showFileUpload && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.txt"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          )}
        </div>
      </form>
      

      {/* <div className="input-hint">
        {currentLanguage === "zh" 
          ? "Bobby 可能会犯错。请核查重要信息。" 
          : "Bobby may make mistakes. Please verify important information."
        }
      </div> */}
    </div>
  );
};

export default ChatInput;
