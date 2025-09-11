import { storageAdapter } from './storageAdapter';

// API会话历史管理器
class ApiSessionManager {
  constructor() {
    this.sessions = [];
    this.currentSession = null;
    this.isEnabled = true;
    this.maxSessions = 100; // 最多保存100个会话
    this.maxSessionAge = 30 * 24 * 60 * 60 * 1000; // 30天
  }

  // 初始化
  async initialize() {
    try {
      const savedSessions = await storageAdapter.loadSetting('api-sessions', []);
      const enabled = await storageAdapter.loadSetting('api-session-history-enabled', true);
      
      this.sessions = Array.isArray(savedSessions) ? savedSessions : [];
      this.isEnabled = enabled;
      
      // 清理过期会话
      this.cleanupExpiredSessions();
      
      console.log(`API会话历史管理器已初始化，当前有 ${this.sessions.length} 个会话记录`);
    } catch (error) {
      console.error('初始化API会话历史失败:', error);
      this.sessions = [];
      this.isEnabled = true;
    }
  }

  // 开始新的API会话
  startSession(conversationId, model, provider, options = {}) {
    if (!this.isEnabled) return null;

    try {
      const session = {
        id: this.generateSessionId(),
        conversationId,
        model,
        provider,
        startTime: Date.now(),
        endTime: null,
        duration: 0,
        requestCount: 0,
        tokenCount: 0,
        messages: [],
        errors: [],
        options: { ...options },
        status: 'active',
        userAgent: navigator.userAgent,
        platform: this.getPlatform(),
        tauriVersion: this.getTauriVersion()
      };

      this.currentSession = session;
      console.log(`开始API会话: ${session.id}`);
      return session;
    } catch (error) {
      console.error('开始API会话失败:', error);
      return null;
    }
  }

  // 记录API请求
  recordRequest(requestData) {
    if (!this.isEnabled || !this.currentSession) return;

    try {
      const request = {
        id: this.generateRequestId(),
        timestamp: Date.now(),
        type: 'request',
        messages: requestData.messages ? requestData.messages.length : 0,
        model: requestData.model,
        provider: requestData.provider,
        options: { ...requestData.options },
        systemPrompt: requestData.options?.systemPrompt,
        responseMode: requestData.options?.responseMode,
        stream: requestData.options?.stream || false
      };

      this.currentSession.messages.push(request);
      this.currentSession.requestCount++;
    } catch (error) {
      console.error('记录API请求失败:', error);
    }
  }

  // 记录API响应
  recordResponse(responseData) {
    if (!this.isEnabled || !this.currentSession) return;

    try {
      const response = {
        id: this.generateRequestId(),
        timestamp: Date.now(),
        type: 'response',
        contentLength: responseData.content ? responseData.content.length : 0,
        hasReasoning: responseData.hasReasoning || false,
        reasoningLength: responseData.reasoning ? responseData.reasoning.length : 0,
        tokenCount: responseData.tokenCount || this.estimateTokenCount(responseData.content),
        duration: responseData.duration || 0,
        success: responseData.success !== false,
        error: responseData.error
      };

      this.currentSession.messages.push(response);
      
      if (response.tokenCount) {
        this.currentSession.tokenCount += response.tokenCount;
      }

      if (responseData.duration) {
        // 更新会话持续时间
        this.currentSession.duration = Date.now() - this.currentSession.startTime;
      }
    } catch (error) {
      console.error('记录API响应失败:', error);
    }
  }

  // 记录错误
  recordError(error, context = {}) {
    if (!this.isEnabled || !this.currentSession) return;

    try {
      const errorRecord = {
        id: this.generateRequestId(),
        timestamp: Date.now(),
        type: 'error',
        message: error.message || error,
        stack: error.stack,
        context: { ...context }
      };

      this.currentSession.errors.push(errorRecord);
      this.currentSession.messages.push(errorRecord);
    } catch (error) {
      console.error('记录API错误失败:', error);
    }
  }

  // 结束当前会话
  endSession(finalData = {}) {
    if (!this.isEnabled || !this.currentSession) return;

    try {
      this.currentSession.endTime = Date.now();
      this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;
      this.currentSession.status = 'completed';
      
      if (finalData.tokenCount) {
        this.currentSession.tokenCount = finalData.tokenCount;
      }

      if (finalData.finalContent) {
        this.currentSession.finalContent = finalData.finalContent;
        
        // 检测是否包含mermaid流程图
        const mermaidCharts = this.extractMermaidCharts(finalData.finalContent);
        if (mermaidCharts.length > 0) {
          this.currentSession.mermaidCharts = mermaidCharts;
          console.log(`检测到 ${mermaidCharts.length} 个流程图`);
        }
      }

      // 保存会话到历史
      this.addToHistory(this.currentSession);
      
      console.log(`结束API会话: ${this.currentSession.id}, 持续时间: ${this.currentSession.duration}ms, 请求数: ${this.currentSession.requestCount}`);
      
      this.currentSession = null;
    } catch (error) {
      console.error('结束API会话失败:', error);
    }
  }

  // 添加会话到历史
  async addToHistory(session) {
    try {
      this.sessions.unshift(session);
      
      // 限制会话数量
      if (this.sessions.length > this.maxSessions) {
        this.sessions = this.sessions.slice(0, this.maxSessions);
      }

      // 保存到存储
      await this.saveSessions();
    } catch (error) {
      console.error('保存会话历史失败:', error);
    }
  }

  // 保存会话到存储
  async saveSessions() {
    try {
      await storageAdapter.saveSetting('api-sessions', this.sessions);
      await storageAdapter.saveSetting('api-session-history-enabled', this.isEnabled);
    } catch (error) {
      console.error('保存会话数据失败:', error);
    }
  }

  // 获取会话历史
  getSessions(filters = {}) {
    let filteredSessions = [...this.sessions];

    // 按会话ID过滤
    if (filters.conversationId) {
      filteredSessions = filteredSessions.filter(s => 
        s.conversationId === filters.conversationId
      );
    }

    // 按模型过滤
    if (filters.model) {
      filteredSessions = filteredSessions.filter(s => 
        s.model === filters.model
      );
    }

    // 按提供者过滤
    if (filters.provider) {
      filteredSessions = filteredSessions.filter(s => 
        s.provider === filters.provider
      );
    }

    // 按时间范围过滤
    if (filters.startDate) {
      filteredSessions = filteredSessions.filter(s => 
        s.startTime >= filters.startDate
      );
    }

    if (filters.endDate) {
      filteredSessions = filteredSessions.filter(s => 
        s.startTime <= filters.endDate
      );
    }

    // 按状态过滤
    if (filters.status) {
      filteredSessions = filteredSessions.filter(s => 
        s.status === filters.status
      );
    }

    return filteredSessions;
  }

  // 获取会话统计
  getStatistics() {
    const stats = {
      totalSessions: this.sessions.length,
      totalRequests: 0,
      totalTokens: 0,
      totalDuration: 0,
      averageDuration: 0,
      averageRequestsPerSession: 0,
      averageTokensPerSession: 0,
      errorCount: 0,
      successRate: 0,
      byProvider: {},
      byModel: {},
      byDate: {}
    };

    this.sessions.forEach(session => {
      stats.totalRequests += session.requestCount;
      stats.totalTokens += session.tokenCount;
      stats.totalDuration += session.duration;
      stats.errorCount += session.errors.length;

      // 按提供者统计
      if (!stats.byProvider[session.provider]) {
        stats.byProvider[session.provider] = {
          count: 0,
          requests: 0,
          tokens: 0,
          errors: 0
        };
      }
      stats.byProvider[session.provider].count++;
      stats.byProvider[session.provider].requests += session.requestCount;
      stats.byProvider[session.provider].tokens += session.tokenCount;
      stats.byProvider[session.provider].errors += session.errors.length;

      // 按模型统计
      if (!stats.byModel[session.model]) {
        stats.byModel[session.model] = {
          count: 0,
          requests: 0,
          tokens: 0,
          errors: 0
        };
      }
      stats.byModel[session.model].count++;
      stats.byModel[session.model].requests += session.requestCount;
      stats.byModel[session.model].tokens += session.tokenCount;
      stats.byModel[session.model].errors += session.errors.length;

      // 按日期统计
      const date = new Date(session.startTime).toISOString().split('T')[0];
      if (!stats.byDate[date]) {
        stats.byDate[date] = {
          count: 0,
          requests: 0,
          tokens: 0
        };
      }
      stats.byDate[date].count++;
      stats.byDate[date].requests += session.requestCount;
      stats.byDate[date].tokens += session.tokenCount;
    });

    // 计算平均值
    if (stats.totalSessions > 0) {
      stats.averageDuration = Math.round(stats.totalDuration / stats.totalSessions);
      stats.averageRequestsPerSession = Math.round(stats.totalRequests / stats.totalSessions * 10) / 10;
      stats.averageTokensPerSession = Math.round(stats.totalTokens / stats.totalSessions);
      stats.successRate = Math.round((1 - stats.errorCount / Math.max(stats.totalRequests, 1)) * 100);
    }

    return stats;
  }

  // 清理过期会话
  cleanupExpiredSessions() {
    const now = Date.now();
    const beforeCount = this.sessions.length;
    
    this.sessions = this.sessions.filter(session => 
      (now - session.startTime) < this.maxSessionAge
    );

    const afterCount = this.sessions.length;
    if (beforeCount !== afterCount) {
      console.log(`清理了 ${beforeCount - afterCount} 个过期会话`);
      this.saveSessions();
    }
  }

  // 清除所有会话历史
  async clearHistory() {
    try {
      this.sessions = [];
      await this.saveSessions();
      console.log('API会话历史已清除');
    } catch (error) {
      console.error('清除会话历史失败:', error);
    }
  }

  // 启用/禁用会话历史
  async setEnabled(enabled) {
    this.isEnabled = enabled;
    await this.saveSessions();
    console.log(`API会话历史已${enabled ? '启用' : '禁用'}`);
  }

  // 获取当前会话
  getCurrentSession() {
    return this.currentSession;
  }

  // 工具方法
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 提取mermaid流程图
  extractMermaidCharts(content) {
    const charts = [];
    const mermaidRegex = /```mermaid\s*\n([\s\S]*?)\n```/g;
    let match;
    
    while ((match = mermaidRegex.exec(content)) !== null) {
      charts.push({
        id: `chart_${charts.length}`,
        code: match[1].trim(),
        index: match.index
      });
    }
    
    return charts;
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  estimateTokenCount(text) {
    if (!text) return 0;
    // 简单的token估算：中文字符*1.3 + 英文单词*1.3
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    return Math.round(chineseChars * 1.3 + englishWords * 1.3);
  }

  getPlatform() {
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined) {
      return 'tauri';
    }
    return 'web';
  }

  getTauriVersion() {
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined) {
      return window.__TAURI_INTERNALS__?.version || 'unknown';
    }
    return null;
  }
}

// 创建全局实例
export const apiSessionManager = new ApiSessionManager();

// 初始化
export const initializeApiSessionManager = async () => {
  await apiSessionManager.initialize();
};

// 导出管理器实例
export default apiSessionManager;