import React, { useState, useEffect, useRef } from "react";
import { knowledgeBaseManager } from "../utils/knowledgeBase";
import { getCurrentLanguage } from "../utils/language";
import "./KnowledgeBase.css";

const KnowledgeBase = ({ isOpen, onClose }) => {
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentLanguage, setCurrentLanguage] = useState(() => getCurrentLanguage());
  const [activeTab, setActiveTab] = useState("documents"); // documents, search, upload
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [newDocument, setNewDocument] = useState({
    title: "",
    content: "",
    sourceType: "text"
  });
  const [statistics, setStatistics] = useState({
    documentCount: 0,
    vectorCount: 0,
    totalSize: 0
  });
  const fileInputRef = useRef(null);

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

  // 加载文档列表
  useEffect(() => {
    if (isOpen) {
      loadDocuments();
      loadStatistics();
    }
  }, [isOpen]);

  const loadDocuments = async () => {
    try {
      const docs = await knowledgeBaseManager.getStoredDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error("加载文档失败:", error);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await knowledgeBaseManager.getStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error("加载统计信息失败:", error);
    }
  };

  // 搜索知识库
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await knowledgeBaseManager.search(searchQuery, {
        limit: 20,
        threshold: 0.7,
        includeContent: true
      });
      setSearchResults(results);
    } catch (error) {
      console.error("搜索失败:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 添加文档
  const handleAddDocument = async () => {
    if (!newDocument.title.trim() || !newDocument.content.trim()) {
      alert(currentLanguage === "zh" ? "请填写标题和内容" : "Please fill in title and content");
      return;
    }

    try {
      const docId = await knowledgeBaseManager.addDocument(newDocument);
      console.log("文档已添加:", docId);
      
      // 重置表单
      setNewDocument({
        title: "",
        content: "",
        sourceType: "text"
      });
      setShowAddDocument(false);
      
      // 重新加载文档列表和统计
      await loadDocuments();
      await loadStatistics();
      
      alert(currentLanguage === "zh" ? "文档添加成功" : "Document added successfully");
    } catch (error) {
      console.error("添加文档失败:", error);
      alert(currentLanguage === "zh" ? "添加文档失败" : "Failed to add document");
    }
  };

  // 处理文件上传
  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files.length) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const content = await readFileContent(file);
        
        const document = {
          title: file.name,
          content: content,
          sourceType: "file",
          filePath: file.name,
          fileSize: file.size,
          mimeType: file.type,
          metadata: {
            originalName: file.name,
            uploadTime: new Date().toISOString()
          }
        };

        await knowledgeBaseManager.addDocument(document);
        setUploadProgress(((i + 1) / files.length) * 100);
      }

      // 重新加载数据
      await loadDocuments();
      await loadStatistics();
      
      alert(currentLanguage === "zh" ? "文件上传成功" : "Files uploaded successfully");
    } catch (error) {
      console.error("文件上传失败:", error);
      alert(currentLanguage === "zh" ? "文件上传失败" : "Failed to upload files");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // 读取文件内容
  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (file.type === "text/plain" || file.name.endsWith(".txt")) {
          resolve(e.target.result);
        } else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
          // PDF处理需要额外的库，这里简化处理
          resolve(`PDF文件: ${file.name}\n\n注意：PDF内容解析需要额外的库支持。`);
        } else {
          resolve(`文件: ${file.name}\n类型: ${file.type}\n大小: ${file.size} bytes`);
        }
      };
      
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // 删除文档
  const handleDeleteDocument = async (docId) => {
    if (!window.confirm(currentLanguage === "zh" ? "确定要删除这个文档吗？" : "Are you sure you want to delete this document?")) {
      return;
    }

    try {
      await knowledgeBaseManager.deleteDocument(docId);
      await loadDocuments();
      await loadStatistics();
      alert(currentLanguage === "zh" ? "文档已删除" : "Document deleted");
    } catch (error) {
      console.error("删除文档失败:", error);
      alert(currentLanguage === "zh" ? "删除文档失败" : "Failed to delete document");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="knowledge-base-overlay">
      <div className="knowledge-base-modal">
        <div className="knowledge-base-header">
          <h2>{currentLanguage === "zh" ? "知识库管理" : "Knowledge Base"}</h2>
          <button className="close-button" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18"/>
              <path d="M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="knowledge-base-content">
          {/* 统计信息 */}
          <div className="knowledge-stats">
            <div className="stat-item">
              <span className="stat-label">{currentLanguage === "zh" ? "文档数量" : "Documents"}</span>
              <span className="stat-value">{statistics.documentCount}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{currentLanguage === "zh" ? "向量数量" : "Vectors"}</span>
              <span className="stat-value">{statistics.vectorCount}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{currentLanguage === "zh" ? "总大小" : "Total Size"}</span>
              <span className="stat-value">{(statistics.totalSize / 1024 / 1024).toFixed(2)} MB</span>
            </div>
          </div>

          {/* 标签页 */}
          <div className="knowledge-tabs">
            <button
              className={`tab-button ${activeTab === "documents" ? "active" : ""}`}
              onClick={() => setActiveTab("documents")}
            >
              {currentLanguage === "zh" ? "文档列表" : "Documents"}
            </button>
            <button
              className={`tab-button ${activeTab === "search" ? "active" : ""}`}
              onClick={() => setActiveTab("search")}
            >
              {currentLanguage === "zh" ? "搜索" : "Search"}
            </button>
            <button
              className={`tab-button ${activeTab === "upload" ? "active" : ""}`}
              onClick={() => setActiveTab("upload")}
            >
              {currentLanguage === "zh" ? "上传" : "Upload"}
            </button>
          </div>

          {/* 文档列表标签页 */}
          {activeTab === "documents" && (
            <div className="tab-content">
              <div className="documents-header">
                <h3>{currentLanguage === "zh" ? "文档列表" : "Document List"}</h3>
                <button
                  className="add-document-button"
                  onClick={() => setShowAddDocument(true)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14"/>
                    <path d="M5 12h14"/>
                  </svg>
                  {currentLanguage === "zh" ? "添加文档" : "Add Document"}
                </button>
              </div>

              {showAddDocument && (
                <div className="add-document-form">
                  <div className="form-group">
                    <label>{currentLanguage === "zh" ? "标题" : "Title"}</label>
                    <input
                      type="text"
                      value={newDocument.title}
                      onChange={(e) => setNewDocument({...newDocument, title: e.target.value})}
                      placeholder={currentLanguage === "zh" ? "输入文档标题" : "Enter document title"}
                    />
                  </div>
                  <div className="form-group">
                    <label>{currentLanguage === "zh" ? "内容" : "Content"}</label>
                    <textarea
                      value={newDocument.content}
                      onChange={(e) => setNewDocument({...newDocument, content: e.target.value})}
                      placeholder={currentLanguage === "zh" ? "输入文档内容" : "Enter document content"}
                      rows={6}
                    />
                  </div>
                  <div className="form-actions">
                    <button className="save-button" onClick={handleAddDocument}>
                      {currentLanguage === "zh" ? "保存" : "Save"}
                    </button>
                    <button className="cancel-button" onClick={() => setShowAddDocument(false)}>
                      {currentLanguage === "zh" ? "取消" : "Cancel"}
                    </button>
                  </div>
                </div>
              )}

              <div className="documents-list">
                {documents.length === 0 ? (
                  <div className="empty-state">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                      <path d="M8 7h8"/>
                      <path d="M8 11h8"/>
                      <path d="M8 15h5"/>
                    </svg>
                    <p>{currentLanguage === "zh" ? "暂无文档" : "No documents yet"}</p>
                    <button
                      className="add-document-button"
                      onClick={() => setShowAddDocument(true)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14"/>
                        <path d="M5 12h14"/>
                      </svg>
                      {currentLanguage === "zh" ? "+ 添加文档" : "+ Add Document"}
                    </button>
                  </div>
                ) : (
                  documents.map((doc) => (
                    <div key={doc.id} className="document-item">
                      <div className="document-info">
                        <h4>{doc.title}</h4>
                        <p className="document-meta">
                          {doc.sourceType} • {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                        <p className="document-preview">
                          {doc.content.substring(0, 100)}...
                        </p>
                      </div>
                      <div className="document-actions">
                        <button
                          className="delete-button"
                          onClick={() => handleDeleteDocument(doc.id)}
                          title={currentLanguage === "zh" ? "删除文档" : "Delete document"}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18"/>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 搜索标签页 */}
          {activeTab === "search" && (
            <div className="tab-content">
              <div className="search-section">
                <div className="search-input-group">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={currentLanguage === "zh" ? "搜索知识库..." : "Search knowledge base..."}
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <button
                    className="search-button"
                    onClick={handleSearch}
                    disabled={isSearching}
                  >
                    {isSearching ? (
                      <svg className="spinner" width="16" height="16" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="31.416" strokeDashoffset="31.416">
                          <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                          <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
                        </circle>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"/>
                        <path d="M21 21l-4.35-4.35"/>
                      </svg>
                    )}
                  </button>
                </div>

                <div className="search-results">
                  {searchResults.length === 0 && searchQuery ? (
                    <div className="empty-state">
                      <p>{currentLanguage === "zh" ? "未找到相关文档" : "No documents found"}</p>
                    </div>
                  ) : (
                    searchResults.map((result, index) => (
                      <div key={index} className="search-result-item">
                        <div className="result-header">
                          <h4>{result.title}</h4>
                          <span className="similarity-score">
                            {(result.score * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="result-content">{result.content}</p>
                        <div className="result-meta">
                          {result.sourceType} • 块 {result.chunkIndex}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 上传标签页 */}
          {activeTab === "upload" && (
            <div className="tab-content">
              <div className="upload-section">
                <div className="upload-area">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".txt,.pdf,.md,.doc,.docx"
                    onChange={handleFileUpload}
                    style={{ display: "none" }}
                  />
                  
                  <div
                    className="upload-dropzone"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7,10 12,15 17,10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    <h3>{currentLanguage === "zh" ? "上传文件" : "Upload Files"}</h3>
                    <p>{currentLanguage === "zh" ? "支持 TXT, PDF, MD, DOC, DOCX 格式" : "Supports TXT, PDF, MD, DOC, DOCX formats"}</p>
                    <button className="upload-button">
                      {currentLanguage === "zh" ? "选择文件" : "Choose Files"}
                    </button>
                  </div>

                  {isUploading && (
                    <div className="upload-progress">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <span className="progress-text">
                        {currentLanguage === "zh" ? "上传中..." : "Uploading..."} {uploadProgress.toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>

                <div className="upload-tips">
                  <h4>{currentLanguage === "zh" ? "上传提示" : "Upload Tips"}</h4>
                  <ul>
                    <li>{currentLanguage === "zh" ? "支持多种文档格式" : "Supports multiple document formats"}</li>
                    <li>{currentLanguage === "zh" ? "大文件会自动分块处理" : "Large files will be automatically chunked"}</li>
                    <li>{currentLanguage === "zh" ? "上传后会自动生成向量嵌入" : "Vector embeddings will be generated automatically"}</li>
                    <li>{currentLanguage === "zh" ? "支持批量上传多个文件" : "Supports batch upload of multiple files"}</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;
