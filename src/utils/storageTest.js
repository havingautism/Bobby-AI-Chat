import { storageAdapter } from "./storageAdapter";
import { knowledgeBaseManager } from "./knowledgeBase";

// 存储测试工具
class StorageTest {
  constructor() {
    this.testResults = [];
  }

  // 运行所有测试
  async runAllTests() {
    console.log("开始存储系统测试...");

    try {
      await this.testBasicStorage();
      await this.testStorageSwitching();
      await this.testKnowledgeBase();
      await this.testDataMigration();

      this.printResults();
    } catch (error) {
      console.error("测试过程中发生错误:", error);
    }
  }

  // 测试基本存储功能
  async testBasicStorage() {
    console.log("测试基本存储功能...");

    try {
      // 测试保存和加载设置
      await storageAdapter.saveSetting("test-setting", "test-value");
      const loadedValue = await storageAdapter.loadSetting("test-setting");

      if (loadedValue === "test-value") {
        this.addResult("基本设置存储", "PASS");
      } else {
        this.addResult(
          "基本设置存储",
          "FAIL",
          `期望: test-value, 实际: ${loadedValue}`
        );
      }

      // 测试对话存储
      const testConversation = {
        id: "test-conv-1",
        title: "测试对话",
        messages: [
          {
            id: "msg-1",
            role: "user",
            content: "你好",
            timestamp: Date.now(),
          },
          {
            id: "msg-2",
            role: "assistant",
            content: "你好！有什么可以帮助你的吗？",
            timestamp: Date.now(),
          },
        ],
      };

      await storageAdapter.saveConversation(testConversation);
      const conversations = await storageAdapter.loadChatHistory();
      const foundConversation = conversations.find(
        (c) => c.id === "test-conv-1"
      );

      if (foundConversation && foundConversation.messages.length === 2) {
        this.addResult("对话存储", "PASS");
      } else {
        this.addResult("对话存储", "FAIL", "对话保存或加载失败");
      }

      // 清理测试数据
      await storageAdapter.deleteConversation("test-conv-1");
      await storageAdapter.saveSetting("test-setting", null);
    } catch (error) {
      this.addResult("基本存储功能", "ERROR", error.message);
    }
  }

  // 测试存储类型切换
  async testStorageSwitching() {
    console.log("测试存储类型切换...");

    if (!storageAdapter.isTauriEnvironment()) {
      this.addResult("存储类型切换", "SKIP", "仅在Tauri环境中可用");
      return;
    }

    try {
      const currentType = storageAdapter.getStorageType();
      console.log(`当前存储类型: ${currentType}`);

      // 创建测试数据
      const testConversation = {
        id: "switch-test-conv",
        title: "切换测试对话",
        messages: [
          {
            id: "switch-msg-1",
            role: "user",
            content: "这是切换测试",
            timestamp: Date.now(),
          },
        ],
      };

      await storageAdapter.saveConversation(testConversation);
      await storageAdapter.saveSetting(
        "switch-test-setting",
        "switch-test-value"
      );

      // 测试SQLite存储初始化
      if (currentType === "sqlite") {
        try {
          await storageAdapter.initializeSQLite();
          this.addResult("SQLite存储初始化", "PASS");
        } catch (error) {
          this.addResult("SQLite存储初始化", "ERROR", error.message);
        }
      }

      // 清理测试数据
      await storageAdapter.deleteConversation("switch-test-conv");
      await storageAdapter.saveSetting("switch-test-setting", null);
    } catch (error) {
      this.addResult("存储类型切换", "ERROR", error.message);
    }
  }

  // 测试知识库功能
  async testKnowledgeBase() {
    console.log("测试知识库功能...");

    try {
      await knowledgeBaseManager.initialize();

      // 添加测试文档
      const testDocument = {
        id: "test-doc-1",
        title: "测试文档",
        content:
          "这是一个测试文档，用于验证知识库功能。它包含了一些中文内容，用于测试向量搜索功能。",
        sourceType: "text",
        metadata: {
          author: "test",
          category: "test",
        },
      };

      const docId = await knowledgeBaseManager.addDocument(testDocument);

      if (docId) {
        this.addResult("添加知识库文档", "PASS");
      } else {
        this.addResult("添加知识库文档", "FAIL", "文档ID为空");
      }

      // 测试搜索功能
      const searchResults = await knowledgeBaseManager.search("测试文档", {
        limit: 5,
      });

      if (searchResults.length > 0) {
        this.addResult("知识库搜索", "PASS");
      } else {
        this.addResult("知识库搜索", "FAIL", "搜索结果为空");
      }

      // 测试统计信息
      const stats = await knowledgeBaseManager.getStatistics();

      if (stats.documentCount > 0) {
        this.addResult("知识库统计", "PASS");
      } else {
        this.addResult("知识库统计", "FAIL", "文档数量为0");
      }

      // 清理测试数据
      await knowledgeBaseManager.deleteDocument("test-doc-1");
    } catch (error) {
      this.addResult("知识库功能", "ERROR", error.message);
    }
  }

  // 测试数据迁移
  async testDataMigration() {
    console.log("测试数据迁移...");

    try {
      // 创建测试数据
      const testData = {
        conversations: [
          {
            id: "migration-test-1",
            title: "迁移测试对话1",
            messages: [
              {
                id: "mig-msg-1",
                role: "user",
                content: "迁移测试消息1",
                timestamp: Date.now(),
              },
            ],
          },
        ],
        settings: {
          "migration-test-setting": "migration-test-value",
        },
        apiSessions: [
          {
            id: "migration-session-1",
            conversationId: "migration-test-1",
            model: "test-model",
            provider: "test-provider",
            startTime: Date.now(),
            status: "completed",
          },
        ],
      };

      if (storageAdapter.getStorageType() === "sqlite") {
        const { sqliteStorage } = await import("./sqliteStorage");
        const migrationResult = await sqliteStorage.migrateFromJson(testData);

        if (migrationResult) {
          // 验证迁移结果
          const conversations = await storageAdapter.loadChatHistory();
          const foundConversation = conversations.find(
            (c) => c.id === "migration-test-1"
          );
          const settingValue = await storageAdapter.loadSetting(
            "migration-test-setting"
          );

          if (foundConversation && settingValue === "migration-test-value") {
            this.addResult("数据迁移", "PASS");
          } else {
            this.addResult("数据迁移", "FAIL", "迁移后数据验证失败");
          }
        } else {
          this.addResult("数据迁移", "FAIL", "迁移返回false");
        }
      } else {
        this.addResult("数据迁移", "SKIP", "仅在SQLite模式下测试");
      }

      // 清理测试数据
      await storageAdapter.deleteConversation("migration-test-1");
      await storageAdapter.saveSetting("migration-test-setting", null);
    } catch (error) {
      this.addResult("数据迁移", "ERROR", error.message);
    }
  }

  // 添加测试结果
  addResult(testName, status, message = "") {
    this.testResults.push({
      test: testName,
      status: status,
      message: message,
      timestamp: new Date().toISOString(),
    });
  }

  // 打印测试结果
  printResults() {
    console.log("\n=== 存储系统测试结果 ===");
    console.log(`测试时间: ${new Date().toLocaleString()}`);
    console.log(`存储类型: ${storageAdapter.getStorageType()}`);
    console.log(
      `环境: ${storageAdapter.isTauriEnvironment() ? "Tauri" : "Web"}`
    );
    console.log("");

    const statusCounts = {
      PASS: 0,
      FAIL: 0,
      ERROR: 0,
      SKIP: 0,
    };

    this.testResults.forEach((result) => {
      const statusIcon = {
        PASS: "✅",
        FAIL: "❌",
        ERROR: "⚠️",
        SKIP: "⏭️",
      }[result.status];

      console.log(`${statusIcon} ${result.test}: ${result.status}`);
      if (result.message) {
        console.log(`   消息: ${result.message}`);
      }

      statusCounts[result.status]++;
    });

    console.log("\n=== 测试总结 ===");
    console.log(`总计: ${this.testResults.length} 个测试`);
    console.log(`通过: ${statusCounts.PASS} 个`);
    console.log(`失败: ${statusCounts.FAIL} 个`);
    console.log(`错误: ${statusCounts.ERROR} 个`);
    console.log(`跳过: ${statusCounts.SKIP} 个`);

    const successRate = (
      (statusCounts.PASS / this.testResults.length) *
      100
    ).toFixed(1);
    console.log(`成功率: ${successRate}%`);

    if (statusCounts.FAIL === 0 && statusCounts.ERROR === 0) {
      console.log("\n🎉 所有测试通过！存储系统工作正常。");
    } else {
      console.log("\n⚠️ 部分测试失败，请检查存储系统配置。");
    }
  }

  // 获取测试结果
  getResults() {
    return this.testResults;
  }
}

// 创建全局测试实例
export const storageTest = new StorageTest();

// 导出测试函数
export const runStorageTests = () => storageTest.runAllTests();

export default storageTest;
