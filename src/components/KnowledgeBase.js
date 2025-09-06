import React, { useState, useEffect, useRef } from "react";
import { knowledgeBaseManager } from "../utils/knowledgeBase";
import { getCurrentLanguage } from "../utils/language";
import pdfParser from "../utils/pdfParser";
import "./KnowledgeBase.css";

const KnowledgeBase = ({ isOpen, onClose }) => {
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentLanguage, setCurrentLanguage] = useState(() => getCurrentLanguage());
  const [activeTab, setActiveTab] = useState("documents"); // documents, search, upload, test
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

  // 语义搜索测试相关状态
  const [testQueries, setTestQueries] = useState([
    { query: "如何提高代码质量", description: "同义词测试：代码质量" },
    { query: "性能优化", description: "概念搜索：性能相关" },
    { query: "数据库问题", description: "技术栈搜索：数据库" },
    { query: "学习编程", description: "抽象概念：学习相关" },
    { query: "代码报错怎么办", description: "问题解决：错误处理" }
  ]);
  const [testResults, setTestResults] = useState({});
  const [isRunningTests, setIsRunningTests] = useState(false);
  
  // 自定义测试输入相关状态
  const [customTestQuery, setCustomTestQuery] = useState("");
  const [customTestDescription, setCustomTestDescription] = useState("");
  const [showCustomTestForm, setShowCustomTestForm] = useState(false);
  
  // PDF上传相关状态
  const [isUploadingPDF, setIsUploadingPDF] = useState(false);
  const [pdfUploadProgress, setPdfUploadProgress] = useState(0);
  const [pdfParseResult, setPdfParseResult] = useState(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);

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
      // 延迟加载，确保Tauri完全初始化
      const timer = setTimeout(() => {
        loadDocuments();
        loadStatistics();
      }, 1000); // 延迟1秒
      
      return () => clearTimeout(timer);
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

  // 运行语义搜索测试
  const runSemanticSearchTests = async () => {
    if (statistics.vectorCount === 0) {
      alert(currentLanguage === "zh" ? "请先生成向量嵌入" : "Please generate vector embeddings first");
      return;
    }

    setIsRunningTests(true);
    setTestResults({});

    try {
      console.log('🧪 开始语义搜索测试...');
      
      for (const testCase of testQueries) {
        try {
          console.log(`测试查询: "${testCase.query}"`);
          
          // 执行混合搜索
          const results = await knowledgeBaseManager.searchSQLite(testCase.query, 5, 0.3, true);
          
          // 计算测试结果
          const testResult = {
            query: testCase.query,
            description: testCase.description,
            resultCount: results.length,
            results: results,
            avgScore: results.length > 0 ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 0,
            maxScore: results.length > 0 ? Math.max(...results.map(r => r.score)) : 0,
            minScore: results.length > 0 ? Math.min(...results.map(r => r.score)) : 0,
            timestamp: new Date().toISOString()
          };
          
          setTestResults(prev => ({
            ...prev,
            [testCase.query]: testResult
          }));
          
          console.log(`✅ 测试完成: "${testCase.query}" - 找到 ${results.length} 个结果`);
        } catch (error) {
          console.error(`❌ 测试失败: "${testCase.query}"`, error);
          setTestResults(prev => ({
            ...prev,
            [testCase.query]: {
              query: testCase.query,
              description: testCase.description,
              error: error.message,
              timestamp: new Date().toISOString()
            }
          }));
        }
      }
      
      console.log('🎉 语义搜索测试完成！');
    } catch (error) {
      console.error('❌ 测试运行失败:', error);
    } finally {
      setIsRunningTests(false);
    }
  };

  // 清除测试结果
  const clearTestResults = () => {
    setTestResults({});
  };

  // 添加自定义测试用例
  const addCustomTest = () => {
    if (!customTestQuery.trim()) {
      alert(currentLanguage === "zh" ? "请输入测试查询" : "Please enter a test query");
      return;
    }

    const newTest = {
      query: customTestQuery.trim(),
      description: customTestDescription.trim() || "自定义测试"
    };

    // 添加到测试用例列表
    setTestQueries(prev => [...prev, newTest]);
    
    // 清空输入
    setCustomTestQuery("");
    setCustomTestDescription("");
    setShowCustomTestForm(false);
    
    alert(currentLanguage === "zh" ? "测试用例已添加" : "Test case added");
  };

  // 删除测试用例
  const removeTest = (queryToRemove) => {
    setTestQueries(prev => prev.filter(test => test.query !== queryToRemove));
    // 同时删除对应的测试结果
    setTestResults(prev => {
      const newResults = { ...prev };
      delete newResults[queryToRemove];
      return newResults;
    });
  };

  // 运行单个测试
  const runSingleTest = async (testCase) => {
    if (statistics.vectorCount === 0) {
      alert(currentLanguage === "zh" ? "请先生成向量嵌入" : "Please generate vector embeddings first");
      return;
    }

    try {
      console.log(`测试查询: "${testCase.query}"`);
      
      // 执行混合搜索
      const results = await knowledgeBaseManager.searchSQLite(testCase.query, 5, 0.3, true);
      
      // 计算测试结果
      const testResult = {
        query: testCase.query,
        description: testCase.description,
        resultCount: results.length,
        results: results,
        avgScore: results.length > 0 ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 0,
        maxScore: results.length > 0 ? Math.max(...results.map(r => r.score)) : 0,
        minScore: results.length > 0 ? Math.min(...results.map(r => r.score)) : 0,
        timestamp: new Date().toISOString()
      };
      
      setTestResults(prev => ({
        ...prev,
        [testCase.query]: testResult
      }));
      
      console.log(`✅ 测试完成: "${testCase.query}" - 找到 ${results.length} 个结果`);
    } catch (error) {
      console.error(`❌ 测试失败: "${testCase.query}"`, error);
      setTestResults(prev => ({
        ...prev,
        [testCase.query]: {
          query: testCase.query,
          description: testCase.description,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }));
    }
  };

  // 手动生成向量嵌入
  const handleGenerateVectors = async () => {
    try {
      console.log('开始为所有文档生成向量嵌入...');
      
      for (const doc of documents) {
        try {
          console.log(`正在为文档 "${doc.title}" 生成向量...`);
          await knowledgeBaseManager.generateDocumentEmbeddings(doc.id);
          console.log(`✅ 文档 "${doc.title}" 向量生成成功`);
        } catch (error) {
          console.error(`❌ 文档 "${doc.title}" 向量生成失败:`, error);
        }
      }
      
      // 重新加载统计信息
      await loadStatistics();
      
      alert(currentLanguage === "zh" ? "向量生成完成" : "Vector generation completed");
    } catch (error) {
      console.error("生成向量失败:", error);
      alert(currentLanguage === "zh" ? "生成向量失败" : "Failed to generate vectors");
    }
  };

  // 处理PDF文件上传
  const handlePdfUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 验证文件类型
    if (file.type !== 'application/pdf') {
      alert(currentLanguage === "zh" ? "请选择PDF文件" : "Please select a PDF file");
      return;
    }

    // 验证文件大小 (10MB限制)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(currentLanguage === "zh" ? "PDF文件大小不能超过10MB" : "PDF file size cannot exceed 10MB");
      return;
    }

    setIsUploadingPDF(true);
    setPdfUploadProgress(0);
    setPdfParseResult(null);

    try {
      console.log(`开始解析PDF文件: ${file.name}`);
      
      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setPdfUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // 解析PDF
      const result = await pdfParser.parsePDF(file);
      
      clearInterval(progressInterval);
      setPdfUploadProgress(100);

      if (result.success) {
        setPdfParseResult(result);
        setShowPdfPreview(true);
        console.log('✅ PDF解析成功:', result);
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error('❌ PDF解析失败:', error);
      alert(currentLanguage === "zh" ? "PDF解析失败: " + error.message : "PDF parsing failed: " + error.message);
    } finally {
      setIsUploadingPDF(false);
      setPdfUploadProgress(0);
    }
  };

  // 将解析的PDF内容添加到知识库
  const addPdfToKnowledgeBase = async () => {
    if (!pdfParseResult || !pdfParseResult.success) {
      alert(currentLanguage === "zh" ? "没有可用的PDF解析结果" : "No PDF parsing result available");
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const { text, fileName, numPages, info } = pdfParseResult;
      
      // 清理文本
      const cleanedText = pdfParser.cleanText(text);
      
      // 创建文档对象
      const document = {
        title: fileName.replace('.pdf', ''),
        content: cleanedText,
        sourceType: 'pdf',
        metadata: {
          fileName: fileName,
          numPages: numPages,
          fileSize: pdfParseResult.fileSize,
          extractedAt: pdfParseResult.extractedAt,
          pdfInfo: pdfParser.extractMetadata(info)
        }
      };

      // 添加到知识库
      await knowledgeBaseManager.addDocumentToSQLite(document);
      
      console.log('✅ PDF文档已添加到知识库');
      
      // 重新加载文档列表和统计
      await loadDocuments();
      await loadStatistics();
      
      // 重置状态
      setPdfParseResult(null);
      setShowPdfPreview(false);
      if (pdfInputRef.current) {
        pdfInputRef.current.value = '';
      }
      
      alert(currentLanguage === "zh" ? "PDF文档已成功添加到知识库！" : "PDF document successfully added to knowledge base!");
      
    } catch (error) {
      console.error('❌ 添加PDF到知识库失败:', error);
      alert(currentLanguage === "zh" ? "添加PDF到知识库失败: " + error.message : "Failed to add PDF to knowledge base: " + error.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // 取消PDF上传
  const cancelPdfUpload = () => {
    setPdfParseResult(null);
    setShowPdfPreview(false);
    setIsUploadingPDF(false);
    setPdfUploadProgress(0);
    if (pdfInputRef.current) {
      pdfInputRef.current.value = '';
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

          {/* 生成向量按钮 */}
          {statistics.documentCount > 0 && statistics.vectorCount === 0 && (
            <div className="vector-generation-section">
              <button 
                className="generate-vectors-button"
                onClick={handleGenerateVectors}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
                {currentLanguage === "zh" ? "生成向量嵌入" : "Generate Vectors"}
              </button>
              <p className="vector-hint">
                {currentLanguage === "zh" ? "为文档生成向量嵌入以启用语义搜索功能" : "Generate vector embeddings for documents to enable semantic search"}
              </p>
            </div>
          )}

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
            <button
              className={`tab-button ${activeTab === "test" ? "active" : ""}`}
              onClick={() => setActiveTab("test")}
            >
              {currentLanguage === "zh" ? "测试" : "Test"}
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

          {/* 测试标签页 */}
          {activeTab === "test" && (
            <div className="tab-content">
              <div className="test-section">
                <div className="test-header">
                  <h3>{currentLanguage === "zh" ? "语义搜索测试" : "Semantic Search Test"}</h3>
                  <p className="test-description">
                    {currentLanguage === "zh" 
                      ? "测试语义搜索功能，验证搜索结果的相关性和准确性" 
                      : "Test semantic search functionality to verify result relevance and accuracy"}
                  </p>
                </div>

                <div className="test-controls">
                  <button 
                    className={`test-button ${isRunningTests ? 'running' : ''}`}
                    onClick={runSemanticSearchTests}
                    disabled={isRunningTests || statistics.vectorCount === 0}
                  >
                    {isRunningTests ? (
                      <>
                        <div className="loading-spinner"></div>
                        {currentLanguage === "zh" ? "测试中..." : "Testing..."}
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 12l2 2 4-4"/>
                          <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"/>
                          <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"/>
                          <path d="M12 3c0 1-1 3-3 3s-3-2-3-3 1-3 3-3 3 2 3 3"/>
                          <path d="M12 21c0-1 1-3 3-3s3 2 3 3-1 3-3 3-3-2-3-3"/>
                        </svg>
                        {currentLanguage === "zh" ? "运行所有测试" : "Run All Tests"}
                      </>
                    )}
                  </button>
                  
                  <button 
                    className="add-test-button"
                    onClick={() => setShowCustomTestForm(!showCustomTestForm)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14"/>
                      <path d="M5 12h14"/>
                    </svg>
                    {currentLanguage === "zh" ? "添加测试" : "Add Test"}
                  </button>
                  
                  {Object.keys(testResults).length > 0 && (
                    <button 
                      className="clear-button"
                      onClick={clearTestResults}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18"/>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                      </svg>
                      {currentLanguage === "zh" ? "清除结果" : "Clear Results"}
                    </button>
                  )}
                </div>

                {/* 自定义测试输入表单 */}
                {showCustomTestForm && (
                  <div className="custom-test-form">
                    <h4>{currentLanguage === "zh" ? "添加自定义测试用例" : "Add Custom Test Case"}</h4>
                    <div className="form-group">
                      <label>{currentLanguage === "zh" ? "测试查询" : "Test Query"}</label>
                      <input
                        type="text"
                        value={customTestQuery}
                        onChange={(e) => setCustomTestQuery(e.target.value)}
                        placeholder={currentLanguage === "zh" ? "输入要测试的查询..." : "Enter test query..."}
                        className="test-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>{currentLanguage === "zh" ? "描述（可选）" : "Description (Optional)"}</label>
                      <input
                        type="text"
                        value={customTestDescription}
                        onChange={(e) => setCustomTestDescription(e.target.value)}
                        placeholder={currentLanguage === "zh" ? "测试用例描述..." : "Test case description..."}
                        className="test-input"
                      />
                    </div>
                    <div className="form-actions">
                      <button 
                        className="save-test-button"
                        onClick={addCustomTest}
                      >
                        {currentLanguage === "zh" ? "添加测试用例" : "Add Test Case"}
                      </button>
                      <button 
                        className="cancel-button"
                        onClick={() => {
                          setShowCustomTestForm(false);
                          setCustomTestQuery("");
                          setCustomTestDescription("");
                        }}
                      >
                        {currentLanguage === "zh" ? "取消" : "Cancel"}
                      </button>
                    </div>
                  </div>
                )}

                {/* 测试用例列表 */}
                <div className="test-cases-section">
                  <h4>{currentLanguage === "zh" ? "测试用例列表" : "Test Cases"}</h4>
                  <div className="test-cases-list">
                    {testQueries.map((testCase, index) => (
                      <div key={index} className="test-case-item">
                        <div className="test-case-info">
                          <div className="test-case-query">"{testCase.query}"</div>
                          <div className="test-case-description">{testCase.description}</div>
                        </div>
                        <div className="test-case-actions">
                          <button 
                            className="run-single-test-button"
                            onClick={() => runSingleTest(testCase)}
                            disabled={statistics.vectorCount === 0}
                            title={currentLanguage === "zh" ? "运行单个测试" : "Run single test"}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polygon points="5,3 19,12 5,21"/>
                            </svg>
                          </button>
                          <button 
                            className="remove-test-button"
                            onClick={() => removeTest(testCase.query)}
                            title={currentLanguage === "zh" ? "删除测试用例" : "Remove test case"}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 6L6 18"/>
                              <path d="M6 6l12 12"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {statistics.vectorCount === 0 && (
                  <div className="test-warning">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <p>{currentLanguage === "zh" ? "请先生成向量嵌入才能进行测试" : "Please generate vector embeddings first to run tests"}</p>
                  </div>
                )}

                <div className="test-results">
                  {Object.keys(testResults).length > 0 && (
                    <div className="test-summary">
                      <h4>{currentLanguage === "zh" ? "测试摘要" : "Test Summary"}</h4>
                      <div className="summary-stats">
                        <div className="summary-item">
                          <span className="summary-label">{currentLanguage === "zh" ? "测试用例" : "Test Cases"}</span>
                          <span className="summary-value">{Object.keys(testResults).length}</span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">{currentLanguage === "zh" ? "成功" : "Success"}</span>
                          <span className="summary-value success">
                            {Object.values(testResults).filter(r => !r.error).length}
                          </span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">{currentLanguage === "zh" ? "失败" : "Failed"}</span>
                          <span className="summary-value error">
                            {Object.values(testResults).filter(r => r.error).length}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {Object.entries(testResults).map(([query, result]) => (
                    <div key={query} className="test-result-item">
                      <div className="test-result-header">
                        <h5 className="test-query">"{result.query}"</h5>
                        <span className="test-description">{result.description}</span>
                        {result.error ? (
                          <span className="test-status error">❌ {currentLanguage === "zh" ? "失败" : "Failed"}</span>
                        ) : (
                          <span className="test-status success">✅ {currentLanguage === "zh" ? "成功" : "Success"}</span>
                        )}
                      </div>
                      
                      {result.error ? (
                        <div className="test-error">
                          <p>{result.error}</p>
                        </div>
                      ) : (
                        <div className="test-result-details">
                          <div className="result-stats">
                            <span>{currentLanguage === "zh" ? "结果数量" : "Results"}: {result.resultCount}</span>
                            <span>{currentLanguage === "zh" ? "平均分数" : "Avg Score"}: {result.avgScore.toFixed(3)}</span>
                            <span>{currentLanguage === "zh" ? "最高分数" : "Max Score"}: {result.maxScore.toFixed(3)}</span>
                          </div>
                          
                          {result.results && result.results.length > 0 && (
                            <div className="result-list">
                              {result.results.map((item, index) => (
                                <div key={index} className="result-item">
                                  <div className="result-title">{item.title}</div>
                                  <div className="result-score">分数: {item.score.toFixed(3)}</div>
                                  {item.content && (
                                    <div className="result-content">
                                      {item.content.substring(0, 100)}...
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 上传标签页 */}
          {activeTab === "upload" && (
            <div className="tab-content">
              <div className="upload-section">
                {/* PDF上传区域 */}
                <div className="pdf-upload-section">
                  <h4>{currentLanguage === "zh" ? "PDF文档上传" : "PDF Document Upload"}</h4>
                  <div className="pdf-upload-area">
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={handlePdfUpload}
                      style={{ display: "none" }}
                    />
                    
                    <div
                      className="pdf-upload-dropzone"
                      onClick={() => pdfInputRef.current?.click()}
                    >
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14,2 14,8 20,8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10,9 9,9 8,9"/>
                      </svg>
                      <h3>{currentLanguage === "zh" ? "上传PDF文档" : "Upload PDF Document"}</h3>
                      <p>{currentLanguage === "zh" ? "支持PDF格式，最大10MB" : "Supports PDF format, max 10MB"}</p>
                      <button className="upload-button">
                        {currentLanguage === "zh" ? "选择PDF文件" : "Choose PDF File"}
                      </button>
                    </div>
                  </div>

                  {/* PDF上传进度 */}
                  {isUploadingPDF && (
                    <div className="upload-progress">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${pdfUploadProgress}%` }}
                        ></div>
                      </div>
                      <p>{currentLanguage === "zh" ? "正在解析PDF..." : "Parsing PDF..."} {pdfUploadProgress}%</p>
                    </div>
                  )}

                  {/* PDF解析结果预览 */}
                  {showPdfPreview && pdfParseResult && (
                    <div className="pdf-preview">
                      <h5>{currentLanguage === "zh" ? "PDF解析结果" : "PDF Parsing Result"}</h5>
                      <div className="pdf-info">
                        <div className="info-item">
                          <span className="label">{currentLanguage === "zh" ? "文件名:" : "File Name:"}</span>
                          <span className="value">{pdfParseResult.fileName}</span>
                        </div>
                        <div className="info-item">
                          <span className="label">{currentLanguage === "zh" ? "页数:" : "Pages:"}</span>
                          <span className="value">{pdfParseResult.numPages}</span>
                        </div>
                        <div className="info-item">
                          <span className="label">{currentLanguage === "zh" ? "文件大小:" : "File Size:"}</span>
                          <span className="value">{(pdfParseResult.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                        <div className="info-item">
                          <span className="label">{currentLanguage === "zh" ? "提取字符数:" : "Extracted Characters:"}</span>
                          <span className="value">{pdfParseResult.text.length.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      <div className="text-preview">
                        <h6>{currentLanguage === "zh" ? "文本预览:" : "Text Preview:"}</h6>
                        <div className="preview-content">
                          {pdfParseResult.text.substring(0, 500)}
                          {pdfParseResult.text.length > 500 && "..."}
                        </div>
                      </div>

                      <div className="pdf-actions">
                        <button 
                          className="add-to-knowledge-button"
                          onClick={addPdfToKnowledgeBase}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <>
                              <div className="loading-spinner"></div>
                              {currentLanguage === "zh" ? "添加中..." : "Adding..."}
                            </>
                          ) : (
                            <>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 5v14"/>
                                <path d="M5 12h14"/>
                              </svg>
                              {currentLanguage === "zh" ? "添加到知识库" : "Add to Knowledge Base"}
                            </>
                          )}
                        </button>
                        <button 
                          className="cancel-pdf-button"
                          onClick={cancelPdfUpload}
                        >
                          {currentLanguage === "zh" ? "取消" : "Cancel"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 分隔线 */}
                <div className="upload-divider">
                  <span>{currentLanguage === "zh" ? "或" : "OR"}</span>
                </div>

                {/* 传统文件上传区域 */}
                <div className="traditional-upload-section">
                  <h4>{currentLanguage === "zh" ? "传统文档上传" : "Traditional Document Upload"}</h4>
                  <div className="upload-area">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".txt,.md,.doc,.docx"
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
                      <p>{currentLanguage === "zh" ? "支持 TXT, MD, DOC, DOCX 格式" : "Supports TXT, MD, DOC, DOCX formats"}</p>
                      <button className="upload-button">
                        {currentLanguage === "zh" ? "选择文件" : "Choose Files"}
                      </button>
                    </div>
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
