/**
 * Qdrant管理器 - 前端接口
 * 负责管理Qdrant的安装、启动、停止等操作
 */
class QdrantManager {
  constructor() {
    this.isTauriEnvironment = this.checkTauriEnvironment();
    this.isInstalled = false;
    this.isRunning = false;
    this.status = null;
  }

  checkTauriEnvironment() {
    return typeof window !== 'undefined' && window.__TAURI__;
  }

  /**
   * 检查Qdrant是否已安装
   * @returns {Promise<boolean>} 是否已安装
   */
  async checkInstallation() {
    if (!this.isTauriEnvironment) {
      console.warn('⚠️ 非Tauri环境，无法使用Qdrant');
      return false;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      this.isInstalled = await invoke('is_qdrant_installed');
      console.log('📦 Qdrant安装状态:', this.isInstalled ? '已安装' : '未安装');
      return this.isInstalled;
    } catch (error) {
      console.error('❌ 检查Qdrant安装状态失败:', error);
      return false;
    }
  }

  /**
   * 编译Qdrant
   * @returns {Promise<boolean>} 编译是否成功
   */
  async compile() {
    if (!this.isTauriEnvironment) {
      console.warn('⚠️ 非Tauri环境，无法编译Qdrant');
      return false;
    }

    try {
      console.log('🔨 开始编译Qdrant...');
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('compile_qdrant');
      console.log('✅ Qdrant编译成功:', result);
      this.isInstalled = true;
      return true;
    } catch (error) {
      console.error('❌ Qdrant编译失败:', error);
      return false;
    }
  }

  /**
   * 启动Qdrant服务
   * @returns {Promise<boolean>} 启动是否成功
   */
  async start() {
    if (!this.isTauriEnvironment) {
      console.warn('⚠️ 非Tauri环境，无法启动Qdrant');
      return false;
    }

    try {
      console.log('🚀 启动Qdrant服务...');
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('start_qdrant');
      console.log('✅ Qdrant服务启动成功:', result);
      this.isRunning = true;
      return true;
    } catch (error) {
      console.error('❌ Qdrant服务启动失败:', error);
      return false;
    }
  }

  /**
   * 停止Qdrant服务
   * @returns {Promise<boolean>} 停止是否成功
   */
  async stop() {
    if (!this.isTauriEnvironment) {
      console.warn('⚠️ 非Tauri环境，无法停止Qdrant');
      return false;
    }

    try {
      console.log('🛑 停止Qdrant服务...');
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('stop_qdrant');
      console.log('✅ Qdrant服务已停止:', result);
      this.isRunning = false;
      return true;
    } catch (error) {
      console.error('❌ Qdrant服务停止失败:', error);
      return false;
    }
  }

  /**
   * 获取Qdrant状态
   * @returns {Promise<Object>} 状态信息
   */
  async getStatus() {
    if (!this.isTauriEnvironment) {
      return {
        isInstalled: false,
        isRunning: false,
        error: '非Tauri环境'
      };
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      this.status = await invoke('get_qdrant_status');
      this.isRunning = this.status.is_running;
      console.log('📊 Qdrant状态:', this.status);
      return this.status;
    } catch (error) {
      console.error('❌ 获取Qdrant状态失败:', error);
      return {
        isInstalled: false,
        isRunning: false,
        error: error.message
      };
    }
  }

  /**
   * 获取Qdrant版本
   * @returns {Promise<string>} 版本信息
   */
  async getVersion() {
    if (!this.isTauriEnvironment) {
      return 'N/A';
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const version = await invoke('get_qdrant_version');
      console.log('📋 Qdrant版本:', version);
      return version;
    } catch (error) {
      console.error('❌ 获取Qdrant版本失败:', error);
      return 'Unknown';
    }
  }

  /**
   * 自动设置Qdrant
   * 检查安装状态，如果未安装则安装，如果未运行则启动
   * @returns {Promise<boolean>} 设置是否成功
   */
  async autoSetup() {
    console.log('🔧 开始自动设置Qdrant...');

    try {
      // 1. 检查是否已安装
      const installed = await this.checkInstallation();
      if (!installed) {
        console.log('🔨 Qdrant未安装，开始编译...');
        const compileSuccess = await this.compile();
        if (!compileSuccess) {
          console.error('❌ Qdrant编译失败');
          return false;
        }
      }

      // 2. 检查是否正在运行
      const status = await this.getStatus();
      if (!status.is_running) {
        console.log('🚀 Qdrant未运行，开始启动...');
        const startSuccess = await this.start();
        if (!startSuccess) {
          console.error('❌ Qdrant启动失败');
          return false;
        }
      }

      // 3. 等待服务完全启动
      await this.waitForService();

      console.log('✅ Qdrant自动设置完成');
      return true;
    } catch (error) {
      console.error('❌ Qdrant自动设置失败:', error);
      return false;
    }
  }

  /**
   * 等待Qdrant服务完全启动
   * @param {number} maxAttempts - 最大尝试次数
   * @param {number} delay - 延迟时间（毫秒）
   * @returns {Promise<boolean>} 是否启动成功
   */
  async waitForService(maxAttempts = 10, delay = 1000) {
    console.log('⏳ 等待Qdrant服务启动...');

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const status = await this.getStatus();
        if (status.is_running) {
          console.log('✅ Qdrant服务已启动');
          return true;
        }
      } catch (error) {
        console.log(`⏳ 等待中... (${i + 1}/${maxAttempts})`);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }

    console.error('❌ Qdrant服务启动超时');
    return false;
  }

  /**
   * 检查Qdrant是否可用
   * @returns {Promise<boolean>} 是否可用
   */
  async isAvailable() {
    if (!this.isTauriEnvironment) {
      return false;
    }

    try {
      const status = await this.getStatus();
      return status.is_running;
    } catch (error) {
      console.error('❌ 检查Qdrant可用性失败:', error);
      return false;
    }
  }

  /**
   * 获取Qdrant Web UI URL
   * @returns {string} Web UI URL
   */
  getWebUIUrl() {
    return 'http://localhost:6333';
  }

  /**
   * 获取Qdrant数据目录
   * @returns {Promise<string>} 数据目录路径
   */
  async getDataPath() {
    try {
      const status = await this.getStatus();
      return status.data_path || './qdrant_data';
    } catch (error) {
      console.error('❌ 获取数据目录失败:', error);
      return './qdrant_data';
    }
  }

  /**
   * 重启Qdrant服务
   * @returns {Promise<boolean>} 重启是否成功
   */
  async restart() {
    console.log('🔄 重启Qdrant服务...');

    try {
      // 停止服务
      await this.stop();
      
      // 等待一段时间
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 启动服务
      const startSuccess = await this.start();
      
      if (startSuccess) {
        console.log('✅ Qdrant服务重启成功');
        return true;
      } else {
        console.error('❌ Qdrant服务重启失败');
        return false;
      }
    } catch (error) {
      console.error('❌ Qdrant服务重启失败:', error);
      return false;
    }
  }

  /**
   * 获取完整的Qdrant信息
   * @returns {Promise<Object>} 完整信息
   */
  async getInfo() {
    try {
      const [status, version] = await Promise.all([
        this.getStatus(),
        this.getVersion()
      ]);

      return {
        isInstalled: this.isInstalled,
        isRunning: status.is_running,
        version: version,
        port: status.port || 6333,
        dataPath: status.data_path || './qdrant_data',
        webUIUrl: this.getWebUIUrl(),
        pid: status.pid,
        status: status
      };
    } catch (error) {
      console.error('❌ 获取Qdrant信息失败:', error);
      return {
        isInstalled: false,
        isRunning: false,
        version: 'Unknown',
        port: 6333,
        dataPath: './qdrant_data',
        webUIUrl: this.getWebUIUrl(),
        error: error.message
      };
    }
  }
}

// 创建全局实例
const qdrantManager = new QdrantManager();

export default qdrantManager;
