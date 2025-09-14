// SQLite 适配器 - 用于 Tauri 端
class SQLiteAdapter {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  // 初始化 SQLite 数据库
  async init() {
    if (this.initialized) return;

    try {
      // 检查是否在 Tauri 环境中
      if (!window.__TAURI__) {
        throw new Error('Not running in Tauri environment');
      }

      // 动态导入 Tauri SQLite 插件
      const { load } = await import('@tauri-apps/plugin-sql');
      this.db = await load('sqlite:bobby_chat.db');

      // 创建表
      await this.createTables();
      this.initialized = true;

      console.log('SQLite 数据库初始化成功');
    } catch (error) {
      console.error('SQLite 初始化失败:', error);
      throw error;
    }
  }

  // 创建数据库表
  async createTables() {
    const queries = [
      // 角色表
      `CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT,
        avatar TEXT,
        description TEXT,
        temperature REAL DEFAULT 0.7,
        systemPrompt TEXT,
        color TEXT,
        created_at TEXT,
        updated_at TEXT
      )`,
      // 模型设置表
      `CREATE TABLE IF NOT EXISTS model_settings (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT DEFAULT 'siliconflow',
        enabled BOOLEAN DEFAULT TRUE,
        created_at TEXT,
        updated_at TEXT
      )`,
      // 对话表
      `CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT,
        role_id TEXT,
        response_mode TEXT DEFAULT 'stream',
        messages TEXT,
        settings TEXT,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (role_id) REFERENCES roles (id)
      )`,
      // 设置表
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
      )`,
      // 创建索引
      `CREATE INDEX IF NOT EXISTS idx_roles_created_at ON roles(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_conversations_role_id ON conversations(role_id)`
    ];

    for (const query of queries) {
      try {
        await this.db.execute(query);
      } catch (error) {
        console.error('执行 SQL 查询失败:', query, error);
      }
    }
  }

  // 执行查询
  async execute(query, params = []) {
    try {
      await this.db.execute(query, params);
    } catch (error) {
      console.error('执行查询失败:', query, params, error);
      throw error;
    }
  }

  // 查询数据
  async select(query, params = []) {
    try {
      const result = await this.db.select(query, params);
      return result;
    } catch (error) {
      console.error('查询数据失败:', query, params, error);
      throw error;
    }
  }

  // 插入或更新数据
  async upsert(table, data) {
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    const updateSet = columns.map(col => `${col} = ?`).join(', ');

    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT(id) DO UPDATE SET ${updateSet}
    `;

    const values = [...columns.map(col => data[col]), ...columns.map(col => data[col])];
    await this.execute(query, values);
  }

  // 删除数据
  async delete(table, id) {
    const query = `DELETE FROM ${table} WHERE id = ?`;
    await this.execute(query, [id]);
  }

  // 获取单条记录
  async getById(table, id) {
    const query = `SELECT * FROM ${table} WHERE id = ?`;
    const results = await this.select(query, [id]);
    return results[0] || null;
  }

  // 获取所有记录
  async getAll(table, orderBy = 'created_at ASC') {
    const query = `SELECT * FROM ${table} ORDER BY ${orderBy}`;
    return await this.select(query);
  }

  // 搜索记录
  async search(table, column, value, limit = 50) {
    const query = `SELECT * FROM ${table} WHERE ${column} LIKE ? ORDER BY created_at DESC LIMIT ?`;
    return await this.select(query, [`%${value}%`, limit]);
  }

  // 批量操作
  async batchInsert(table, records) {
    if (records.length === 0) return;

    const columns = Object.keys(records[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

    for (const record of records) {
      const values = columns.map(col => record[col]);
      await this.execute(query, values);
    }
  }

  // 事务处理
  async transaction(operations) {
    try {
      await this.db.execute('BEGIN TRANSACTION');

      for (const operation of operations) {
        await operation();
      }

      await this.db.execute('COMMIT');
    } catch (error) {
      await this.db.execute('ROLLBACK');
      throw error;
    }
  }

  // 获取表信息
  async getTableInfo(table) {
    const query = `PRAGMA table_info(${table})`;
    return await this.select(query);
  }

  // 清空表
  async truncate(table) {
    const query = `DELETE FROM ${table}`;
    await this.execute(query);
  }

  // 获取记录数量
  async count(table, whereClause = '') {
    let query = `SELECT COUNT(*) as count FROM ${table}`;
    const params = [];

    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }

    const result = await this.select(query, params);
    return result[0].count;
  }

  // 备份数据库
  async backup(backupPath) {
    try {
      // 这里需要实现备份逻辑
      console.log('备份数据库到:', backupPath);
      // 实际备份实现取决于 Tauri 的文件系统 API
    } catch (error) {
      console.error('备份失败:', error);
      throw error;
    }
  }

  // 恢复数据库
  async restore(backupPath) {
    try {
      // 这里需要实现恢复逻辑
      console.log('从备份恢复数据库:', backupPath);
      // 实际恢复实现取决于 Tauri 的文件系统 API
    } catch (error) {
      console.error('恢复失败:', error);
      throw error;
    }
  }

  // 清理过期数据
  async cleanup(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const queries = [
      // 清理旧的对话
      `DELETE FROM conversations WHERE created_at < ?`,
      // 清理旧的角色（除了默认角色）
      `DELETE FROM roles WHERE created_at < ? AND id NOT LIKE 'bobby' AND id NOT LIKE 'developer%' AND id NOT LIKE 'creative%' AND id NOT LIKE 'analyst%' AND id NOT LIKE 'teacher%' AND id NOT LIKE 'writer%'`
    ];

    const cutoffDateStr = cutoffDate.toISOString();

    for (const query of queries) {
      try {
        await this.execute(query, [cutoffDateStr]);
      } catch (error) {
        console.error('清理数据失败:', query, error);
      }
    }
  }

  // 获取数据库统计信息
  async getStats() {
    const stats = {
      roles: 0,
      conversations: 0,
      modelSettings: 0,
      settings: 0,
      dbSize: 0
    };

    try {
      stats.roles = await this.count('roles');
      stats.conversations = await this.count('conversations');
      stats.modelSettings = await this.count('model_settings');
      stats.settings = await this.count('settings');

      // 获取数据库大小（需要 Tauri 文件系统 API）
      // stats.dbSize = await this.getDatabaseSize();
    } catch (error) {
      console.error('获取统计信息失败:', error);
    }

    return stats;
  }

  // 关闭数据库连接
  async close() {
    try {
      if (this.db) {
        await this.db.close();
        this.db = null;
        this.initialized = false;
      }
    } catch (error) {
      console.error('关闭数据库失败:', error);
    }
  }
}

// 导出单例实例
const sqliteAdapter = new SQLiteAdapter();

export { sqliteAdapter, SQLiteAdapter };

// 便捷方法
export const initSQLite = async () => {
  await sqliteAdapter.init();
  return sqliteAdapter;
};

export const closeSQLite = async () => {
  await sqliteAdapter.close();
};

export const getSQLiteStats = async () => {
  return await sqliteAdapter.getStats();
};