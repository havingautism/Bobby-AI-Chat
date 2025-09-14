// 数据库工具类 - 支持IndexedDB（Web）和SQLite（Tauri）
class DatabaseManager {
  constructor() {
    this.dbName = 'BobbyAIChatDB';
    this.dbVersion = 1;
    this.db = null;
    this.isTauri = window.__TAURI__;
  }

  // 初始化数据库
  async init() {
    if (this.isTauri) {
      await this.initSQLite();
    } else {
      await this.initIndexedDB();
    }
  }

  // 初始化IndexedDB（Web端）
  async initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = (event) => {
        reject('数据库打开失败: ' + event.target.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 创建角色存储
        if (!db.objectStoreNames.contains('roles')) {
          const roleStore = db.createObjectStore('roles', { keyPath: 'id' });
          roleStore.createIndex('name', 'name', { unique: false });
          roleStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // 创建模型设置存储
        if (!db.objectStoreNames.contains('modelSettings')) {
          const modelStore = db.createObjectStore('modelSettings', { keyPath: 'id' });
          modelStore.createIndex('provider', 'provider', { unique: false });
          modelStore.createIndex('enabled', 'enabled', { unique: false });
        }

        // 创建对话存储
        if (!db.objectStoreNames.contains('conversations')) {
          const conversationStore = db.createObjectStore('conversations', { keyPath: 'id' });
          conversationStore.createIndex('createdAt', 'createdAt', { unique: false });
          conversationStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // 创建设置存储
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  // 初始化SQLite（Tauri端）
  async initSQLite() {
    try {
      // 动态导入SQLite适配器
      const { initSQLite } = await import('./sqlite.js');
      this.sqlite = await initSQLite();
      await this.createTables();
    } catch (error) {
      console.warn('SQLite初始化失败，降级到localStorage:', error);
      this.useLocalStorage = true;
    }
  }

  // 创建SQLite表
  async createTables() {
    const queries = [
      `CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT,
        avatar TEXT,
        description TEXT,
        temperature REAL,
        systemPrompt TEXT,
        color TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS model_settings (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT,
        enabled BOOLEAN,
        createdAt TEXT,
        updatedAt TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT,
        role_id TEXT,
        response_mode TEXT,
        messages TEXT,
        settings TEXT,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (role_id) REFERENCES roles (id)
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
      )`
    ];

    for (const query of queries) {
      await this.sqlite.execute(query);
    }
  }

  // 通用保存方法
  async save(storeName, data) {
    if (this.useLocalStorage) {
      return this.saveToLocalStorage(storeName, data);
    }

    if (this.isTauri && this.sqlite && !this.useLocalStorage) {
      return this.saveToSQLite(storeName, data);
    } else {
      return this.saveToIndexedDB(storeName, data);
    }
  }

  // 通用获取方法
  async get(storeName, key) {
    if (this.useLocalStorage) {
      return this.getFromLocalStorage(storeName, key);
    }

    if (this.isTauri && this.sqlite && !this.useLocalStorage) {
      return this.getFromSQLite(storeName, key);
    } else {
      return this.getFromIndexedDB(storeName, key);
    }
  }

  // 通用获取所有方法
  async getAll(storeName) {
    if (this.useLocalStorage) {
      return this.getAllFromLocalStorage(storeName);
    }

    if (this.isTauri && this.sqlite && !this.useLocalStorage) {
      return this.getAllFromSQLite(storeName);
    } else {
      return this.getAllFromIndexedDB(storeName);
    }
  }

  // 通用删除方法
  async delete(storeName, key) {
    if (this.useLocalStorage) {
      return this.deleteFromLocalStorage(storeName, key);
    }

    if (this.isTauri && this.sqlite && !this.useLocalStorage) {
      return this.deleteFromSQLite(storeName, key);
    } else {
      return this.deleteFromIndexedDB(storeName, key);
    }
  }

  // IndexedDB 操作方法
  async saveToIndexedDB(storeName, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      // 添加时间戳
      const dataWithTimestamp = {
        ...data,
        updatedAt: new Date().toISOString(),
        createdAt: data.createdAt || new Date().toISOString()
      };

      const request = store.put(dataWithTimestamp);

      request.onsuccess = () => resolve(dataWithTimestamp);
      request.onerror = () => reject(request.error);
    });
  }

  async getFromIndexedDB(storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllFromIndexedDB(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFromIndexedDB(storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // SQLite 操作方法
  async saveToSQLite(storeName, data) {
    const tableName = this.getTableName(storeName);

    // 添加时间戳
    const dataWithTimestamp = {
      ...data,
      updated_at: new Date().toISOString(),
      created_at: data.created_at || new Date().toISOString()
    };

    await this.sqlite.upsert(tableName, dataWithTimestamp);
    return dataWithTimestamp;
  }

  async getFromSQLite(storeName, key) {
    const tableName = this.getTableName(storeName);
    const result = await this.sqlite.getById(tableName, key);

    // 标准化字段名
    if (result) {
      return {
        ...result,
        createdAt: result.created_at,
        updatedAt: result.updated_at
      };
    }
    return null;
  }

  async getAllFromSQLite(storeName) {
    const tableName = this.getTableName(storeName);
    const results = await this.sqlite.getAll(tableName, 'created_at ASC');

    // 标准化字段名
    return results.map(result => ({
      ...result,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    }));
  }

  async deleteFromSQLite(storeName, key) {
    const tableName = this.getTableName(storeName);
    await this.sqlite.delete(tableName, key);
    return true;
  }

  // localStorage 备用方案
  async saveToLocalStorage(storeName, data) {
    const key = `${storeName}_${data.id}`;
    localStorage.setItem(key, JSON.stringify(data));

    // 更新索引
    const index = localStorage.getItem(`${storeName}_index`) || '[]';
    const indexArray = JSON.parse(index);
    const existingIndex = indexArray.findIndex(item => item.id === data.id);

    if (existingIndex >= 0) {
      indexArray[existingIndex] = { id: data.id, updatedAt: new Date().toISOString() };
    } else {
      indexArray.push({ id: data.id, createdAt: new Date().toISOString() });
    }

    localStorage.setItem(`${storeName}_index`, JSON.stringify(indexArray));
    return data;
  }

  async getFromLocalStorage(storeName, key) {
    const data = localStorage.getItem(`${storeName}_${key}`);
    return data ? JSON.parse(data) : null;
  }

  async getAllFromLocalStorage(storeName) {
    const index = localStorage.getItem(`${storeName}_index`) || '[]';
    const indexArray = JSON.parse(index);
    const results = [];

    for (const item of indexArray) {
      const data = localStorage.getItem(`${storeName}_${item.id}`);
      if (data) {
        results.push(JSON.parse(data));
      }
    }

    return results;
  }

  async deleteFromLocalStorage(storeName, key) {
    localStorage.removeItem(`${storeName}_${key}`);

    // 更新索引
    const index = localStorage.getItem(`${storeName}_index`) || '[]';
    const indexArray = JSON.parse(index).filter(item => item.id !== key);
    localStorage.setItem(`${storeName}_index`, JSON.stringify(indexArray));

    return true;
  }

  // 辅助方法
  getTableName(storeName) {
    const mapping = {
      'roles': 'roles',
      'modelSettings': 'model_settings',
      'conversations': 'conversations',
      'settings': 'settings'
    };
    return mapping[storeName] || storeName;
  }

  getTableColumns(tableName) {
    const columns = {
      'roles': ['id', 'name', 'icon', 'avatar', 'description', 'temperature', 'systemPrompt', 'color', 'createdAt', 'updatedAt'],
      'model_settings': ['id', 'name', 'provider', 'enabled', 'createdAt', 'updatedAt'],
      'conversations': ['id', 'title', 'role_id', 'response_mode', 'messages', 'settings', 'created_at', 'updated_at'],
      'settings': ['key', 'value', 'updated_at']
    };
    return columns[tableName] || ['id'];
  }
}

// 创建单例实例
const dbManager = new DatabaseManager();

// 导出数据库管理器
export { dbManager, DatabaseManager };

// 便捷方法
export const saveRole = async (role) => {
  await dbManager.save('roles', role);
};

export const getRole = async (id) => {
  return await dbManager.get('roles', id);
};

export const getAllRoles = async () => {
  return await dbManager.getAll('roles');
};

export const deleteRole = async (id) => {
  return await dbManager.delete('roles', id);
};

export const saveModelSettings = async (settings) => {
  await dbManager.save('modelSettings', settings);
};

export const getModelSettings = async () => {
  return await dbManager.getAll('modelSettings');
};

export const saveSetting = async (key, value) => {
  await dbManager.save('settings', { key, value });
};

export const getSetting = async (key) => {
  const result = await dbManager.get('settings', key);
  return result ? result.value : null;
};

// 初始化数据库
export const initDatabase = async () => {
  try {
    await dbManager.init();
    console.log('数据库初始化成功');
    return true;
  } catch (error) {
    console.error('数据库初始化失败:', error);
    return false;
  }
};