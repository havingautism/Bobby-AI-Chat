import React, { useState, useEffect, useRef } from "react";
import { knowledgeBaseManager } from "../utils/knowledgeBaseQdrant";
import { getCurrentLanguage } from "../utils/language";
import pdfParser from "../utils/pdfParser";
import docxParser from "../utils/docxParser";
import spreadsheetParser from "../utils/spreadsheetParser";
import textParser from "../utils/textParser";
import "./KnowledgeBase.css";
import "./KnowledgeBase.enhanced.css";
import StatusModal from "./StatusModal";
import LoadingModal from "./LoadingModal";
import SuccessModal from "./SuccessModal";
import FileIcon from "./FileIcon";
import TextModal from "./TextModal";
import { useNotification, NotificationContainer } from "../hooks/useNotification";

const KnowledgeBase = ({ isOpen, onClose }) => {
  const [documents, setDocuments] = useState([]);
  const [documentSearchQuery, setDocumentSearchQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusModal, setStatusModal] = useState({ open: false, title: "", message: "", loading: false, confirmText: "OK", cancelText: null, onConfirm: null });
  const [currentLanguage, setCurrentLanguage] = useState(() => getCurrentLanguage());
  const [activeTab, setActiveTab] = useState("documents"); // documents, search, upload, test
  
  // 新的loading和通知状态
  const [loadingModal, setLoadingModal] = useState({
    open: false,
    title: "",
    message: "",
    progress: null,
    steps: [],
    currentStep: 0,
    showCancel: true,
    onCancel: null
  });

  // 成功完成模态框状态
  const [successModal, setSuccessModal] = useState({
    open: false,
    title: "",
    message: "",
    details: [],
    actions: [],
    autoClose: true,
    autoCloseDelay: 5000
  });
  
  const { notifications, showSuccess, showError, showWarning, showInfo, removeNotification } = useNotification();
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
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
  const [isInitializing, setIsInitializing] = useState(true);

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
  
  const fileInputRef = useRef(null);

  // 更新加载模态框步骤
  const updateLoadingModalStep = (stepId, status, progress = null) => {
    setLoadingModal(prev => {
      const updatedSteps = prev.steps.map(step => 
        step.id === stepId ? { ...step, status } : step
      );
      
      return {
        ...prev,
        steps: updatedSteps,
        progress: progress !== null ? progress : prev.progress
      };
    });
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 过滤文档列表
  const filteredDocuments = documents.filter(doc => {
    if (!documentSearchQuery.trim()) return true;
    return doc.title.toLowerCase().includes(documentSearchQuery.toLowerCase());
  });

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
      setIsInitializing(true);
      // 立即开始加载，不延迟
      const loadData = async () => {
        try {
          await loadDocuments();
          await loadStatistics();
        } finally {
          setIsInitializing(false);
        }
      };
      
      loadData();
    }
  }, [isOpen]);

  const loadDocuments = async () => {
    try {
      // 先检查模型是否可用
      // 使用硅基流动API，不再需要本地模型检查
      console.log('🔍 使用硅基流动API，跳过模型可用性检查');

      const docs = await knowledgeBaseManager.getStoredDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error("加载文档失败:", error);
      // 检查是否是模型相关错误
      if (error.message && (error.message.includes('模型') || error.message.includes('model') || error.message.includes('专家模型'))) {
        setStatusModal({
          open: true,
          title: currentLanguage === "zh" ? "模型错误" : "Model Error",
          message: error.message,
          loading: false,
          confirmText: currentLanguage === "zh" ? "确定" : "OK",
          cancelText: null,
          onConfirm: () => setStatusModal(prev => ({ ...prev, open: false }))
        });
      }
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

    // 使用硅基流动API，不再需要本地模型检查
    console.log('🔍 使用硅基流动API，跳过模型可用性检查');

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
      // 检查是否是模型相关错误
      if (error.message && (error.message.includes('模型') || error.message.includes('model') || error.message.includes('专家模型'))) {
        setStatusModal({
          open: true,
          title: currentLanguage === "zh" ? "搜索失败" : "Search Failed",
          message: error.message,
          loading: false,
          confirmText: currentLanguage === "zh" ? "确定" : "OK",
          cancelText: null,
          onConfirm: () => setStatusModal(prev => ({ ...prev, open: false }))
        });
      }
    } finally {
      setIsSearching(false);
    }
  };

  // 处理文本添加（用于TextModal）
  const handleAddText = async (textData) => {
    try {
      const docId = await knowledgeBaseManager.addDocument(textData);
      console.log("文本已添加:", docId);
      
      // 重新加载文档列表和统计
      await loadDocuments();
      await loadStatistics();
      
      // 显示成功消息
      showSuccess(
        currentLanguage === "zh" ? "添加成功" : "Added Successfully",
        currentLanguage === "zh" ? "文本内容已成功添加到知识库" : "Text content has been successfully added to the knowledge base"
      );
      
      return docId;
    } catch (error) {
      console.error("添加文本失败:", error);
      showError(
        currentLanguage === "zh" ? "添加失败" : "Add Failed",
        currentLanguage === "zh" ? "添加文本内容失败" : "Failed to add text content"
      );
      throw error;
    }
  };

  // 添加文档
  const handleAddDocument = async () => {
    if (!newDocument.title.trim() || !newDocument.content.trim()) {
      setStatusModal({
        open: true,
        title: currentLanguage === "zh" ? "输入错误" : "Input Error",
        message: currentLanguage === "zh" ? "请填写标题和内容" : "Please fill in title and content",
        loading: false,
        confirmText: currentLanguage === "zh" ? "确定" : "OK",
        cancelText: null,
        onConfirm: () => setStatusModal(prev => ({ ...prev, open: false }))
      });
      return;
    }

    // 先检查模型是否可用
    // 使用硅基流动API，不再需要本地模型检查
    console.log('🔍 使用硅基流动API，跳过模型可用性检查');

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
      
      setStatusModal({
        open: true,
        title: currentLanguage === "zh" ? "添加成功" : "Success",
        message: currentLanguage === "zh" ? "文档添加成功" : "Document added successfully",
        loading: false,
        confirmText: currentLanguage === "zh" ? "确定" : "OK",
        cancelText: null,
        onConfirm: () => setStatusModal(prev => ({ ...prev, open: false }))
      });
    } catch (error) {
      console.error("添加文档失败:", error);
      setStatusModal({
        open: true,
        title: currentLanguage === "zh" ? "添加失败" : "Failed",
        message: error.message || (currentLanguage === "zh" ? "添加文档失败" : "Failed to add document"),
        loading: false,
        confirmText: currentLanguage === "zh" ? "确定" : "OK",
        cancelText: null,
        onConfirm: () => setStatusModal(prev => ({ ...prev, open: false }))
      });
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
      console.log('\n🧪 ===== 开始批量语义搜索测试 =====');
      console.log(`📊 测试用例总数: ${testQueries.length}`);
      console.log(`⏰ 开始时间: ${new Date().toLocaleString()}`);
      console.log(`📈 当前统计: 文档 ${statistics.documentCount} 个, 向量 ${statistics.vectorCount} 个\n`);
      
      let totalResults = 0;
      let successfulTests = 0;
      let failedTests = 0;
      
      for (let i = 0; i < testQueries.length; i++) {
        const testCase = testQueries[i];
        try {
          console.log(`\n🧪 [${i + 1}/${testQueries.length}] 测试用例: "${testCase.query}"`);
          console.log(`📝 描述: ${testCase.description}`);
          
          // 执行混合搜索
          const results = await knowledgeBaseManager.searchSQLite(testCase.query, 5, 0.01, false); // 禁用混合搜索，只使用Qdrant
          totalResults += results.length;
          
          console.log(`📊 结果统计: 找到 ${results.length} 个匹配文档`);
          
          if (results.length > 0) {
            const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
            const maxScore = Math.max(...results.map(r => r.score));
            const minScore = Math.min(...results.map(r => r.score));
            
            console.log(`   - 平均相似度: ${avgScore !== undefined ? avgScore.toFixed(4) : 'N/A'}`);
            console.log(`   - 最高相似度: ${maxScore !== undefined ? maxScore.toFixed(4) : 'N/A'}`);
            console.log(`   - 最低相似度: ${minScore !== undefined ? minScore.toFixed(4) : 'N/A'}`);
            
            // 显示前3个最佳匹配
            console.log(`📋 最佳匹配 (前3个):`);
            results.slice(0, 3).forEach((result, index) => {
              const score = result.score !== undefined ? result.score.toFixed(4) : 'N/A';
              console.log(`   ${index + 1}. "${result.title}" (${score})`);
            });
            
            if (results.length > 3) {
              console.log(`   ... 还有 ${results.length - 3} 个结果`);
            }
          } else {
            console.log(`❌ 没有找到匹配的文档`);
          }
          
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
          
          successfulTests++;
          console.log(`✅ 测试完成: "${testCase.query}"`);
          
        } catch (error) {
          console.error(`❌ 测试失败: "${testCase.query}"`, error);
          failedTests++;
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
      
      // 输出最终统计信息
      console.log('\n📊 ===== 批量测试完成统计 =====');
      console.log(`✅ 成功测试: ${successfulTests} 个`);
      console.log(`❌ 失败测试: ${failedTests} 个`);
      console.log(`📈 总匹配结果: ${totalResults} 个`);
      console.log(`⏰ 结束时间: ${new Date().toLocaleString()}`);
      console.log(`🧪 ===== 批量语义搜索测试结束 =====\n`);
      
    } catch (error) {
      console.error('\n❌ 批量测试运行失败:', error);
      console.error('错误详情:', error);
      console.log('🧪 ===== 批量语义搜索测试结束 (失败) =====\n');
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
      console.log(`\n🧪 ===== 开始测试用例 =====`);
      console.log(`📝 测试描述: ${testCase.description}`);
      console.log(`🔍 查询内容: "${testCase.query}"`);
      console.log(`⏰ 测试时间: ${new Date().toLocaleString()}`);
      
      // 执行混合搜索
      const results = await knowledgeBaseManager.searchSQLite(testCase.query, 5, 0.01, false); // 禁用混合搜索，只使用Qdrant
      
      console.log(`\n📊 搜索结果统计:`);
      console.log(`   - 总结果数: ${results.length}`);
      
      if (results.length > 0) {
        const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
        const maxScore = Math.max(...results.map(r => r.score));
        const minScore = Math.min(...results.map(r => r.score));
        
        console.log(`   - 平均相似度: ${avgScore !== undefined ? avgScore.toFixed(4) : 'N/A'}`);
        console.log(`   - 最高相似度: ${maxScore !== undefined ? maxScore.toFixed(4) : 'N/A'}`);
        console.log(`   - 最低相似度: ${minScore !== undefined ? minScore.toFixed(4) : 'N/A'}`);
        
        console.log(`\n📋 详细匹配结果:`);
        results.forEach((result, index) => {
          console.log(`\n   ${index + 1}. 文档: "${result.title}"`);
          const score = result.score !== undefined ? result.score.toFixed(4) : 'N/A';
          console.log(`      - 相似度分数: ${score}`);
          console.log(`      - 文档ID: ${result.id}`);
          console.log(`      - 来源类型: ${result.sourceType || 'unknown'}`);
          console.log(`      - 内容预览: ${result.content ? result.content.substring(0, 100) + '...' : '无内容'}`);
          
          if (result.metadata) {
            console.log(`      - 元数据:`, result.metadata);
          }
        });
        
        console.log(`\n🎯 匹配分析:`);
        const highScoreResults = results.filter(r => r.score > 0.7);
        const mediumScoreResults = results.filter(r => r.score > 0.4 && r.score <= 0.7);
        const lowScoreResults = results.filter(r => r.score <= 0.4);
        
        console.log(`   - 高相似度结果 (>0.7): ${highScoreResults.length} 个`);
        console.log(`   - 中等相似度结果 (0.4-0.7): ${mediumScoreResults.length} 个`);
        console.log(`   - 低相似度结果 (≤0.4): ${lowScoreResults.length} 个`);
        
        if (highScoreResults.length > 0) {
          console.log(`\n⭐ 高相似度匹配:`);
          highScoreResults.forEach((result, index) => {
            const score = result.score !== undefined ? result.score.toFixed(4) : 'N/A';
            console.log(`   ${index + 1}. "${result.title}" (${score})`);
          });
        }
      } else {
        console.log(`\n❌ 没有找到匹配的文档`);
        console.log(`   可能的原因:`);
        console.log(`   - 查询词与文档内容不匹配`);
        console.log(`   - 相似度阈值设置过高 (当前: 0.3)`);
        console.log(`   - 文档向量未正确生成`);
        console.log(`   - 知识库中没有相关文档`);
      }
      
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
      
      console.log(`\n✅ 测试完成: "${testCase.query}" - 找到 ${results.length} 个结果`);
      console.log(`🧪 ===== 测试用例结束 =====\n`);
      
    } catch (error) {
      console.error(`\n❌ 测试失败: "${testCase.query}"`, error);
      console.error(`错误详情:`, error);
      console.log(`🧪 ===== 测试用例结束 (失败) =====\n`);
      
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

  // 移除独立 PDF 上传流程，统一走单一上传入口

  // 调试向量生成
  const debugVectorGeneration = async () => {
    try {
      console.log('🔍 开始调试向量生成...');
      
      // 获取所有文档
      const allDocs = await knowledgeBaseManager.getStoredDocuments();
      console.log('📄 所有文档:', allDocs);
      
      // 获取统计信息
      const stats = await knowledgeBaseManager.getStatistics();
      console.log('📊 统计信息:', stats);
      
      // 检查每个文档的向量
      for (const doc of allDocs) {
        console.log(`\n🔍 检查文档: ${doc.title} (ID: ${doc.id})`);
        
        try {
          // 尝试生成向量
          await knowledgeBaseManager.generateDocumentEmbeddings(doc.id);
          console.log(`✅ 文档 ${doc.title} 向量生成成功`);
        } catch (error) {
          console.error(`❌ 文档 ${doc.title} 向量生成失败:`, error);
        }
      }
      
      // 重新获取统计信息
      const newStats = await knowledgeBaseManager.getStatistics();
      console.log('📊 更新后的统计信息:', newStats);
      
      // 重新加载统计信息
      await loadStatistics();
      
      alert(currentLanguage === "zh" ? "向量生成调试完成，请查看控制台" : "Vector generation debug completed, check console");
      
    } catch (error) {
      console.error('❌ 调试向量生成失败:', error);
      alert(currentLanguage === "zh" ? "调试失败: " + error.message : "Debug failed: " + error.message);
    }
  };

  // 强制刷新数据
  const forceRefresh = async () => {
    try {
      console.log('🔄 强制刷新数据...');
      await loadDocuments();
      await loadStatistics();
      console.log('✅ 数据刷新完成');
      alert(currentLanguage === "zh" ? "数据已刷新" : "Data refreshed");
    } catch (error) {
      console.error('❌ 刷新数据失败:', error);
      alert(currentLanguage === "zh" ? "刷新失败: " + error.message : "Refresh failed: " + error.message);
    }
  };

  // 清理重复文档
  const cleanupDuplicateDocuments = async () => {
    try {
      console.log('🧹 开始清理重复文档...');
      
      const allDocs = await knowledgeBaseManager.getStoredDocuments();
      console.log('📄 所有文档:', allDocs);
      
      // 按文件名和标题分组
      const docGroups = {};
      allDocs.forEach(doc => {
        const key = `${doc.fileName || doc.title}_${doc.sourceType}`;
        if (!docGroups[key]) {
          docGroups[key] = [];
        }
        docGroups[key].push(doc);
      });
      
      // 找出重复的文档组
      const duplicates = Object.values(docGroups).filter(group => group.length > 1);
      
      if (duplicates.length === 0) {
        alert(currentLanguage === "zh" ? "没有发现重复文档" : "No duplicate documents found");
        return;
      }
      
      console.log('🔍 发现重复文档组:', duplicates);
      
      let deletedCount = 0;
      for (const group of duplicates) {
        // 保留最新的文档，删除其他的
        const sortedGroup = group.sort((a, b) => (b.createdAt || b.created_at || 0) - (a.createdAt || a.created_at || 0));
        const toDelete = sortedGroup.slice(1); // 保留第一个，删除其余的
        
        for (const doc of toDelete) {
          try {
            await knowledgeBaseManager.deleteDocument(doc.id);
            console.log(`🗑️ 删除重复文档: ${doc.title} (${doc.id})`);
            deletedCount++;
          } catch (error) {
            console.error(`❌ 删除文档失败: ${doc.id}`, error);
          }
        }
      }
      
      // 重新加载数据
      await loadDocuments();
      await loadStatistics();
      
      alert(currentLanguage === "zh" ? `已清理 ${deletedCount} 个重复文档` : `Cleaned up ${deletedCount} duplicate documents`);
      
    } catch (error) {
      console.error('❌ 清理重复文档失败:', error);
      alert(currentLanguage === "zh" ? "清理失败: " + error.message : "Cleanup failed: " + error.message);
    }
  };

  // 清理所有文档
  const clearAllDocuments = async () => {
    try {
      // 确认对话框
      const confirmMessage = currentLanguage === "zh" 
        ? "⚠️ 警告：此操作将删除知识库中的所有文档和向量数据，且无法恢复！\n\n确定要继续吗？"
        : "⚠️ Warning: This will delete ALL documents and vector data in the knowledge base and cannot be undone!\n\nAre you sure you want to continue?";
      
      if (!window.confirm(confirmMessage)) {
        return;
      }
      
      // 二次确认
      const secondConfirm = currentLanguage === "zh"
        ? "最后确认：真的要删除所有文档吗？"
        : "Final confirmation: Are you really sure you want to delete all documents?";
      
      if (!window.confirm(secondConfirm)) {
        return;
      }
      
      console.log('🧹 开始清理所有文档...');
      
      const result = await knowledgeBaseManager.clearAllDocuments();
      console.log('✅ 清理结果:', result);
      
      // 重新加载数据
      await loadDocuments();
      await loadStatistics();
      
      // 延迟再次刷新统计信息，确保Qdrant索引更新
      setTimeout(async () => {
        console.log('🔄 延迟刷新统计信息...');
        await loadStatistics();
        console.log('✅ 统计信息已更新');
      }, 2000);
      
      const successMessage = currentLanguage === "zh"
        ? `✅ 清理完成！\n删除了 ${result.deletedDocuments} 个文档和 ${result.deletedVectors} 个向量`
        : `✅ Cleanup completed!\nDeleted ${result.deletedDocuments} documents and ${result.deletedVectors} vectors`;
      
      alert(successMessage);
      
    } catch (error) {
      console.error('❌ 清理所有文档失败:', error);
      alert(currentLanguage === "zh" ? `清理失败: ${error.message}` : `Cleanup failed: ${error.message}`);
    }
  };

  // 处理文件上传
  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files.length) return;

    // 显示上传开始通知
    showInfo(
      currentLanguage === "zh" ? "开始上传" : "Upload Started",
      currentLanguage === "zh" ? `正在上传 ${files.length} 个文件...` : `Uploading ${files.length} files...`,
      { persistent: true }
    );

    // 设置详细的loading modal
    setLoadingModal({
      open: true,
      title: currentLanguage === "zh" ? "正在上传文件" : "Uploading Files",
      message: currentLanguage === "zh" ? "正在处理文件，请稍候..." : "Processing files, please wait...",
      progress: 0,
      steps: [
        {
          title: currentLanguage === "zh" ? "文件解析" : "File Parsing",
          description: currentLanguage === "zh" ? "读取和解析文件内容" : "Reading and parsing file content"
        },
        {
          title: currentLanguage === "zh" ? "向量化处理" : "Vector Processing",
          description: currentLanguage === "zh" ? "生成文档向量嵌入" : "Generating document vector embeddings"
        },
        {
          title: currentLanguage === "zh" ? "存储到知识库" : "Storing to Knowledge Base",
          description: currentLanguage === "zh" ? "保存到向量数据库" : "Saving to vector database"
        },
        {
          title: currentLanguage === "zh" ? "完成" : "Complete",
          description: currentLanguage === "zh" ? "上传完成" : "Upload completed"
        }
      ],
      currentStep: 0,
      showCancel: true,
      onCancel: () => {
        setLoadingModal(s => ({ ...s, open: false }));
        showWarning(
          currentLanguage === "zh" ? "上传已取消" : "Upload Cancelled",
          currentLanguage === "zh" ? "文件上传操作已取消" : "File upload operation was cancelled"
        );
      }
    });

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const uploadedFiles = [];
      const failedFiles = [];
      let totalProgress = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // 计算当前文件的进度贡献
        const fileProgressWeight = 100 / files.length;
        const baseProgress = i * fileProgressWeight;
        
        showInfo(
          currentLanguage === "zh" ? `处理文件 ${i + 1}/${files.length}` : `Processing file ${i + 1}/${files.length}`,
          currentLanguage === "zh" ? `正在处理: ${file.name}` : `Processing: ${file.name}`,
          { persistent: true }
        );

        try {
          // 步骤1: 文件解析 (25% of file progress)
          setLoadingModal(s => ({ 
            ...s, 
            progress: baseProgress + (fileProgressWeight * 0.25),
            currentStep: 0,
            message: currentLanguage === "zh" ? `解析文件: ${file.name}` : `Parsing file: ${file.name}`
          }));
          await new Promise(resolve => setTimeout(resolve, 300)); // 模拟处理时间
          const content = await readFileContent(file);
          
          // 步骤2: 向量化处理 (35% of file progress)
          setLoadingModal(s => ({ 
            ...s, 
            progress: baseProgress + (fileProgressWeight * 0.6),
            currentStep: 1,
            message: currentLanguage === "zh" ? `生成向量: ${file.name}` : `Generating vectors: ${file.name}`
          }));
          await new Promise(resolve => setTimeout(resolve, 200)); // 模拟处理时间
          
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

          // 步骤3: 存储到知识库 (40% of file progress)
          setLoadingModal(s => ({ 
            ...s, 
            progress: baseProgress + (fileProgressWeight * 0.9),
            currentStep: 2,
            message: currentLanguage === "zh" ? `存储到知识库: ${file.name}` : `Storing to knowledge base: ${file.name}`
          }));
          await knowledgeBaseManager.addDocument(document);
          
          // 文件完成
          totalProgress = baseProgress + fileProgressWeight;
          setLoadingModal(s => ({ ...s, progress: totalProgress }));
          uploadedFiles.push(file);
          
          // 短暂显示完成状态
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (fileError) {
          console.error(`❌ 处理文件 ${file.name} 失败:`, fileError);
          failedFiles.push({ file, error: fileError });
          
          // 即使文件失败，也要更新进度
          totalProgress = baseProgress + fileProgressWeight;
          setLoadingModal(s => ({ ...s, progress: totalProgress }));
        }
      }

      // 步骤4: 完成
      setLoadingModal(s => ({ 
        ...s, 
        progress: 100,
        currentStep: 3,
        message: currentLanguage === "zh" ? "上传完成，正在刷新数据..." : "Upload complete, refreshing data..."
      }));
      await new Promise(resolve => setTimeout(resolve, 800)); // 显示完成状态

      // 重新加载数据
      await loadDocuments();
      await loadStatistics();

      // 关闭loading modal
      setTimeout(() => {
        setLoadingModal(prev => ({ ...prev, open: false }));
      }, 500);

      // 显示优雅的成功完成模态框
      setSuccessModal({
        open: true,
        title: currentLanguage === "zh" ? "上传完成 🎉" : "Upload Complete 🎉",
        message: currentLanguage === "zh" 
          ? `成功上传 ${uploadedFiles.length} 个文件到知识库`
          : `Successfully uploaded ${uploadedFiles.length} files to knowledge base`,
        details: [
          { label: currentLanguage === "zh" ? "上传成功" : "Success", value: `${uploadedFiles.length} 个文件` },
          { label: currentLanguage === "zh" ? "上传失败" : "Failed", value: failedFiles.length > 0 ? `${failedFiles.length} 个文件` : '0 个文件' },
          { label: currentLanguage === "zh" ? "总大小" : "Total Size", value: formatFileSize(uploadedFiles.reduce((sum, file) => sum + file.size, 0)) },
          { label: currentLanguage === "zh" ? "完成时间" : "Completed", value: new Date().toLocaleString() }
        ],
        actions: [
          {
            text: currentLanguage === "zh" ? "查看文档" : "View Documents",
            primary: true,
            icon: '📄',
            onClick: () => {
              setSuccessModal(prev => ({ ...prev, open: false }));
              setActiveTab("documents");
            }
          },
          {
            text: currentLanguage === "zh" ? "上传更多" : "Upload More",
            icon: '📤',
            onClick: () => {
              setSuccessModal(prev => ({ ...prev, open: false }));
              setActiveTab("upload");
            }
          },
          ...(failedFiles.length > 0 ? [{
            text: currentLanguage === "zh" ? "查看错误" : "View Errors",
            icon: '❌',
            onClick: () => {
              showInfo(
                currentLanguage === "zh" ? "上传错误详情" : "Upload Error Details",
                currentLanguage === "zh" 
                  ? `以下文件上传失败:\n${failedFiles.map(f => `• ${f.file.name}: ${f.error.message}`).join('\n')}`
                  : `The following files failed to upload:\n${failedFiles.map(f => `• ${f.file.name}: ${f.error.message}`).join('\n')}`
              );
            }
          }] : [])
        ],
        autoClose: false
      });

    } catch (error) {
      console.error("文件上传失败:", error);
      
      // 关闭loading modal
      setLoadingModal(s => ({ ...s, open: false }));

      // 显示错误通知
      showError(
        currentLanguage === "zh" ? "上传失败" : "Upload Failed",
        currentLanguage === "zh" ? `文件上传失败: ${error.message}` : `File upload failed: ${error.message}`,
        {
          actions: [
            {
              text: currentLanguage === "zh" ? "重试" : "Retry",
              primary: true,
              onClick: () => {
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                  fileInputRef.current.click();
                }
              }
            },
            {
              text: currentLanguage === "zh" ? "查看详情" : "View Details",
              primary: false,
              onClick: () => {
                console.error("详细错误信息:", error);
              }
            }
          ]
        }
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // 读取文件内容
  const readFileContent = async (file) => {
    const lower = file.name.toLowerCase();
    // txt
    if (lower.endsWith('.txt') || file.type === 'text/plain') {
      const res = await textParser.parse(file);
      if (!res.success) throw new Error(res.error);
      return res.text;
    }
    // pdf
    if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
      const res = await pdfParser.parsePDF(file);
      if (!res.success) throw new Error(res.error);
      return pdfParser.cleanText ? pdfParser.cleanText(res.text) : res.text;
    }
    // docx
    if (lower.endsWith('.docx')) {
      const res = await docxParser.parseDOCX(file);
      if (!res.success) throw new Error(res.error);
      return res.text;
    }
    // xlsx/xls/csv
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
      const res = await spreadsheetParser.parse(file);
      if (!res.success) throw new Error(res.error);
      return res.text;
    }
    // 其他当作文本尝试读取
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // 删除文档
  const handleDeleteDocument = async (docId) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    // 添加删除确认通知
    const confirmNotificationId = showWarning(
      currentLanguage === "zh" ? "删除确认" : "Confirm Delete",
      currentLanguage === "zh" 
        ? `确定要删除文档"${doc.title}"吗？此操作无法撤销。`
        : `Are you sure you want to delete "${doc.title}"? This action cannot be undone.`,
      {
        persistent: true,
        actions: [
          {
            text: currentLanguage === "zh" ? "删除" : "Delete",
            primary: true,
            onClick: async () => {
              removeNotification(confirmNotificationId);
              await performDocumentDelete(docId, doc);
            }
          },
          {
            text: currentLanguage === "zh" ? "取消" : "Cancel",
            onClick: () => removeNotification(confirmNotificationId)
          }
        ]
      }
    );
  };

  // 执行文档删除
  const performDocumentDelete = async (docId, doc) => {
    const loadingNotificationId = showInfo(
      currentLanguage === "zh" ? "删除文档" : "Deleting Document",
      currentLanguage === "zh" 
        ? `正在删除文档"${doc.title}"...`
        : `Deleting "${doc.title}"...`,
      { persistent: true }
    );

    try {
      // 显示删除进度模态框
      setLoadingModal({
        open: true,
        title: currentLanguage === "zh" ? "删除文档" : "Deleting Document",
        message: currentLanguage === "zh" 
          ? `正在从知识库中删除文档"${doc.title}"...`
          : `Removing "${doc.title}" from knowledge base...`,
        progress: 0,
        steps: [
          {
            id: 'remove_vectors',
            title: currentLanguage === "zh" ? "移除向量数据" : "Removing Vector Data",
            description: currentLanguage === "zh" ? "从向量数据库中删除文档向量" : "Deleting document vectors from vector database",
            status: 'pending'
          },
          {
            id: 'remove_metadata',
            title: currentLanguage === "zh" ? "清理元数据" : "Cleaning Metadata",
            description: currentLanguage === "zh" ? "删除文档元数据和记录" : "Removing document metadata and records",
            status: 'pending'
          },
          {
            id: 'update_index',
            title: currentLanguage === "zh" ? "更新索引" : "Updating Index",
            description: currentLanguage === "zh" ? "更新知识库索引" : "Updating knowledge base index",
            status: 'pending'
          },
          {
            id: 'complete',
            title: currentLanguage === "zh" ? "删除完成" : "Deletion Complete",
            description: currentLanguage === "zh" ? "文档已成功删除" : "Document successfully deleted",
            status: 'pending'
          }
        ],
        cancelable: false,
        onCancel: null
      });

      // 步骤1: 移除向量数据
      updateLoadingModalStep('remove_vectors', 'in_progress', 25);
      await new Promise(resolve => setTimeout(resolve, 500)); // 模拟处理时间
      await knowledgeBaseManager.deleteDocument(docId);

      // 步骤2: 清理元数据
      updateLoadingModalStep('remove_metadata', 'in_progress', 50);
      await new Promise(resolve => setTimeout(resolve, 300)); // 模拟处理时间

      // 步骤3: 更新索引
      updateLoadingModalStep('update_index', 'in_progress', 75);
      await loadDocuments();
      await loadStatistics();

      // 步骤4: 完成
      updateLoadingModalStep('complete', 'in_progress', 100);
      await new Promise(resolve => setTimeout(resolve, 500)); // 显示完成状态
      updateLoadingModalStep('complete', 'completed', 100);

      // 延迟关闭模态框
      setTimeout(() => {
        setLoadingModal(prev => ({ ...prev, open: false }));
      }, 1000);

      // 移除加载通知
      removeNotification(loadingNotificationId);

      // 显示成功通知
      showSuccess(
        currentLanguage === "zh" ? "删除成功" : "Delete Successful",
        currentLanguage === "zh" 
          ? `文档"${doc.title}"已成功删除`
          : `"${doc.title}" has been successfully deleted`,
        {
          actions: [
            {
              text: currentLanguage === "zh" ? "查看详情" : "View Details",
              onClick: () => {
                showInfo(
                  currentLanguage === "zh" ? "删除详情" : "Deletion Details",
                  currentLanguage === "zh" 
                    ? `• 文档: ${doc.title}\n• 删除时间: ${new Date().toLocaleString()}\n• 状态: 已完成`
                    : `• Document: ${doc.title}\n• Deleted: ${new Date().toLocaleString()}\n• Status: Complete`
                );
              }
            }
          ]
        }
      );

      // 延迟刷新统计信息确保Qdrant索引更新
      setTimeout(async () => {
        await loadStatistics();
      }, 2000);

    } catch (error) {
      console.error('❌ 删除文档失败:', error);
      
      // 移除加载通知
      removeNotification(loadingNotificationId);
      
      // 关闭加载模态框
      setLoadingModal(prev => ({ ...prev, open: false }));

      // 显示错误通知
      showError(
        currentLanguage === "zh" ? "删除失败" : "Delete Failed",
        currentLanguage === "zh" 
          ? `删除文档"${doc.title}"时发生错误: ${error.message}`
          : `Error deleting "${doc.title}": ${error.message}`,
        {
          persistent: true,
          actions: [
            {
              text: currentLanguage === "zh" ? "重试" : "Retry",
              primary: true,
              onClick: () => performDocumentDelete(docId, doc)
            },
            {
              text: currentLanguage === "zh" ? "查看错误" : "View Error",
              onClick: () => {
                showInfo(
                  currentLanguage === "zh" ? "错误详情" : "Error Details",
                  currentLanguage === "zh" 
                    ? `• 错误类型: ${error.name || '未知错误'}\n• 错误信息: ${error.message}\n• 文档: ${doc.title}\n• 时间: ${new Date().toLocaleString()}`
                    : `• Error Type: ${error.name || 'Unknown Error'}\n• Message: ${error.message}\n• Document: ${doc.title}\n• Time: ${new Date().toLocaleString()}`
                );
              }
            }
          ]
        }
      );
    }
  };

  if (!isOpen) return null;

  return (
    <>
    <div className="knowledge-base-overlay">
      <div className="knowledge-base-modal">
        <div className="knowledge-base-header">
          <h2>{currentLanguage === "zh" ? "知识库管理" : "Knowledge Base"}</h2>
          <button className="close-button" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="knowledge-base-content">
          {/* 统计信息 */}
          <div className="knowledge-stats">
            {isInitializing ? (
              <div className="initializing-message">
                <div className="loading-spinner"></div>
                <span>{currentLanguage === "zh" ? "正在加载知识库..." : "Loading knowledge base..."}</span>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>

          {/* 生成向量按钮 */}
          {statistics.documentCount > 0 && statistics.vectorCount === 0 && (
            <div className="vector-generation-section">
              <div className="vector-generation-buttons">
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
                
                <button 
                  className="debug-vectors-button"
                  onClick={debugVectorGeneration}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                  </svg>
                  {currentLanguage === "zh" ? "调试向量" : "Debug Vectors"}
                </button>
                
                <button 
                  className="refresh-data-button"
                  onClick={forceRefresh}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                    <path d="M3 21v-5h5"/>
                  </svg>
                  {currentLanguage === "zh" ? "刷新数据" : "Refresh Data"}
                </button>
                
              </div>
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
                <div className="header-actions">
                  {/* <button
                    className="cleanup-duplicates-button"
                    onClick={cleanupDuplicateDocuments}
                    title={currentLanguage === "zh" ? "清理重复文档" : "Clean duplicate documents"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18"/>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                      <path d="M10 11v6"/>
                      <path d="M14 11v6"/>
                    </svg>
                    {currentLanguage === "zh" ? "清理重复" : "Clean Duplicates"}
                  </button>
                  
                  <button
                    className="clear-all-button"
                    onClick={clearAllDocuments}
                    title={currentLanguage === "zh" ? "清理所有文档" : "Clear all documents"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18"/>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                      <path d="M10 11v6"/>
                      <path d="M14 11v6"/>
                      <path d="M16 2l4 4"/>
                      <path d="M20 2l-4 4"/>
                    </svg>
                    {currentLanguage === "zh" ? "清空全部" : "Clear All"}
                  </button> */}
                  
                  <button
                    className="compact-add-text-btn"
                    onClick={() => setShowTextModal(true)}
                    title={currentLanguage === "zh" ? "添加文本" : "Add Text"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                      <polyline points="10 9 9 9 8 9"/>
                    </svg>
                  </button>
                  
                  <button
                    className="compact-add-document-btn"
                    onClick={() => setShowAddDocument(true)}
                    title={currentLanguage === "zh" ? "添加文档" : "Add Document"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* 搜索栏 */}
              <div className="document-search-bar">
                <div className="search-input-wrapper">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-icon">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                  <input
                    type="text"
                    value={documentSearchQuery}
                    onChange={(e) => setDocumentSearchQuery(e.target.value)}
                    placeholder={currentLanguage === "zh" ? "搜索文档名称..." : "Search document names..."}
                    className="document-search-input"
                  />
                  {documentSearchQuery && (
                    <button 
                      className="search-clear-btn"
                      onClick={() => setDocumentSearchQuery("")}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                multiple
                accept=".pdf,.doc,.docx,.txt,.md,.xls,.xlsx,.ppt,.pptx,.csv,.json,.xml,.html,.css,.js,.ts,.jsx,.tsx,.rtf"
                onChange={handleFileUpload}
              />

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

              <div className="document-grid">
                {filteredDocuments.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">📚</div>
                    <div className="empty-state-text">暂无文档</div>
                    <div className="empty-state-subtext">上传文档开始构建您的知识库</div>
                  </div>
                ) : (
                  filteredDocuments.map((doc, index) => (
                    <div key={doc.id || `doc_${index}`} className="document-card">
                      <div className="document-card-icon">
                        <FileIcon fileName={doc.title || doc.fileName || 'document'} size={48} />
                      </div>
                      <div className="document-card-info">
                        <div className="document-card-title" title={doc.title || doc.fileName}>
                          {doc.title || doc.fileName}
                        </div>
                        <div className="document-card-meta">
                          {doc.fileSize ? formatFileSize(doc.fileSize) : (doc.sourceType || 'manual')}
                        </div>
                        <div className="document-card-date">
                          {new Date(doc.createdAt || doc.created_at || doc.uploadTime || Date.now()).toLocaleDateString('zh-CN')}
                        </div>
                      </div>
                      <div className="document-card-actions">
                        <button
                          className="document-card-delete"
                          onClick={() => handleDeleteDocument(doc.id)}
                          title="删除文档"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))
                )}
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
                            <span>{currentLanguage === "zh" ? "平均分数" : "Avg Score"}: {result.avgScore !== undefined ? result.avgScore.toFixed(3) : 'N/A'}</span>
                            <span>{currentLanguage === "zh" ? "最高分数" : "Max Score"}: {result.maxScore !== undefined ? result.maxScore.toFixed(3) : 'N/A'}</span>
                          </div>
                          
                          {result.results && result.results.length > 0 && (
                            <div className="result-list">
                              {result.results.map((item, index) => (
                                <div key={index} className="result-item">
                                  <div className="result-title">{item.title}</div>
                                  <div className="result-score">分数: {item.score !== undefined ? item.score.toFixed(3) : 'N/A'}</div>
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
                <div className="simple-upload-area">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.md,.xls,.xlsx,.ppt,.pptx,.csv,.json,.xml,.html,.css,.js,.ts,.jsx,.tsx,.rtf"
                    onChange={handleFileUpload}
                    style={{ display: "none" }}
                  />
                  
                  <div
                    className="upload-zone"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="upload-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7,10 12,15 17,10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </div>
                    <div className="upload-text">
                      <h3>{currentLanguage === "zh" ? "点击或拖拽上传文件" : "Click or drag to upload"}</h3>
                      <p>{currentLanguage === "zh" ? "支持多种文档格式" : "Support multiple document formats"}</p>
                    </div>
                  </div>
                </div>

                <div className="upload-formats">
                  <h4>{currentLanguage === "zh" ? "支持的格式" : "Supported Formats"}</h4>
                  <div className="format-tags">
                    <span className="format-tag">PDF</span>
                    <span className="format-tag">DOC</span>
                    <span className="format-tag">DOCX</span>
                    <span className="format-tag">XLS</span>
                    <span className="format-tag">XLSX</span>
                    <span className="format-tag">TXT</span>
                    <span className="format-tag">MD</span>
                    <span className="format-tag">JSON</span>
                    <span className="format-tag">HTML</span>
                    <span className="format-tag">CSS</span>
                    <span className="format-tag">JS</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    
    {/* 成功完成模态框 */}
    <SuccessModal
      open={successModal.open}
      onClose={() => setSuccessModal(prev => ({ ...prev, open: false }))}
      title={successModal.title}
      message={successModal.message}
      details={successModal.details}
      actions={successModal.actions}
      autoClose={successModal.autoClose}
      autoCloseDelay={successModal.autoCloseDelay}
    />
    
    {/* 通知容器 */}
    <NotificationContainer
      notifications={notifications}
      onClose={removeNotification}
    />
    
    <StatusModal
      isOpen={statusModal.open}
      title={statusModal.title}
      message={statusModal.message}
      confirmText={statusModal.confirmText}
      cancelText={statusModal.cancelText}
      onConfirm={statusModal.onConfirm}
      onCancel={() => setStatusModal((s) => ({ ...s, open: false }))}
      isLoading={statusModal.loading}
    />
    
    <TextModal
      isOpen={showTextModal}
      onClose={() => setShowTextModal(false)}
      onAddText={handleAddText}
      currentLanguage={currentLanguage}
    />
    </>
  );
};

export default KnowledgeBase;
