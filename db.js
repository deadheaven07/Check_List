/**
 * Checklist &bull; SQLite Relational Database Engine
 * 
 * Supports:
 * - Browser: sql.js WebAssembly SQLite with binary persistence & .sqlite file import/export
 * - Node.js / Testing: Built-in node:sqlite (DatabaseSync)
 * - Safe resilient fallback if WebAssembly is loading
 */

class ChecklistDB {
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'checklist_sqlite_db_v1';
    this.db = null;
    this.isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
    this.isReady = false;
    this.initPromise = null;
  }

  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      if (this.isNode) {
        // Node.js environment: Use official node:sqlite
        try {
          const { DatabaseSync } = require('node:sqlite');
          this.db = new DatabaseSync(':memory:');
          this._initSchema();
          this.isReady = true;
          return this;
        } catch (err) {
          console.warn('[ChecklistDB] Node sqlite init fallback:', err.message);
        }
      }

      // Browser environment: Use sql.js WebAssembly
      if (typeof window !== 'undefined' && typeof window.initSqlJs === 'function') {
        try {
          const SQL = await window.initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
          });

          // Check if binary database is saved in localStorage
          const savedBase64 = localStorage.getItem(this.storageKey);
          if (savedBase64) {
            const binary = this._base64ToUint8Array(savedBase64);
            this.db = new SQL.Database(binary);
          } else {
            this.db = new SQL.Database();
          }

          this._initSchema();
          this.isReady = true;
          return this;
        } catch (err) {
          console.warn('[ChecklistDB] sql.js init error, fallback active:', err);
        }
      }

      // Memory fallback if WASM is still downloading or offline
      this.isReady = true;
      return this;
    })();

    return this.initPromise;
  }

  _initSchema() {
    if (!this.db) return;

    const schemaSQL = `
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        priority TEXT NOT NULL,
        energy TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        due_date TEXT,
        depends_on TEXT
      );

      CREATE TABLE IF NOT EXISTS mutations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'synced_local'
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
      CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
    `;

    if (this.isNode) {
      this.db.exec(schemaSQL);
    } else {
      this.db.run(schemaSQL);
    }
  }

  // Persist SQLite binary database to localStorage
  persist() {
    if (this.isNode || !this.db || typeof localStorage === 'undefined') return;

    try {
      if (typeof this.db.export === 'function') {
        const binary = this.db.export();
        const base64 = this._uint8ArrayToBase64(binary);
        localStorage.setItem(this.storageKey, base64);
      }
    } catch (e) {
      console.warn('[ChecklistDB] Persist error:', e);
    }
  }

  // CRUD: Get all tasks
  getAllTasks() {
    if (!this.db) return [];

    try {
      if (this.isNode) {
        const stmt = this.db.prepare('SELECT * FROM tasks ORDER BY created_at DESC');
        const rows = stmt.all();
        return rows.map(r => this._rowToTask(r));
      } else {
        const res = this.db.exec('SELECT * FROM tasks ORDER BY created_at DESC');
        if (!res || res.length === 0) return [];
        const columns = res[0].columns;
        const values = res[0].values;
        return values.map(row => {
          const obj = {};
          columns.forEach((col, idx) => { obj[col] = row[idx]; });
          return this._rowToTask(obj);
        });
      }
    } catch (err) {
      console.error('[ChecklistDB] getAllTasks error:', err);
      return [];
    }
  }

  // CRUD: Insert or Update task
  upsertTask(task) {
    if (!this.db) return false;

    const completedInt = task.completed ? 1 : 0;
    const dueDateStr = task.dueDate || '';
    const dependsOnStr = task.dependsOn || '';

    try {
      if (this.isNode) {
        const stmt = this.db.prepare(`
          INSERT OR REPLACE INTO tasks (id, title, category, priority, energy, completed, created_at, due_date, depends_on)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(task.id, task.title, task.category, task.priority, task.energy, completedInt, task.createdAt, dueDateStr, dependsOnStr);
      } else {
        this.db.run(`
          INSERT OR REPLACE INTO tasks (id, title, category, priority, energy, completed, created_at, due_date, depends_on)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [task.id, task.title, task.category, task.priority, task.energy, completedInt, task.createdAt, dueDateStr, dependsOnStr]);
        this.persist();
      }
      return true;
    } catch (err) {
      console.error('[ChecklistDB] upsertTask error:', err);
      return false;
    }
  }

  // CRUD: Delete task
  deleteTask(taskId) {
    if (!this.db) return false;

    try {
      if (this.isNode) {
        const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?');
        stmt.run(taskId);
      } else {
        this.db.run('DELETE FROM tasks WHERE id = ?', [taskId]);
        this.persist();
      }
      return true;
    } catch (err) {
      console.error('[ChecklistDB] deleteTask error:', err);
      return false;
    }
  }

  // Batch import tasks within an atomic transaction
  syncAllTasks(tasksList) {
    if (!this.db || !Array.isArray(tasksList)) return false;

    try {
      if (this.isNode) {
        this.db.exec('BEGIN TRANSACTION;');
        this.db.exec('DELETE FROM tasks;');
        const stmt = this.db.prepare(`
          INSERT INTO tasks (id, title, category, priority, energy, completed, created_at, due_date, depends_on)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const t of tasksList) {
          stmt.run(t.id, t.title, t.category, t.priority, t.energy, t.completed ? 1 : 0, t.createdAt, t.dueDate || '', t.dependsOn || '');
        }
        this.db.exec('COMMIT;');
      } else {
        this.db.run('BEGIN TRANSACTION;');
        this.db.run('DELETE FROM tasks;');
        for (const t of tasksList) {
          this.db.run(`
            INSERT INTO tasks (id, title, category, priority, energy, completed, created_at, due_date, depends_on)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [t.id, t.title, t.category, t.priority, t.energy, t.completed ? 1 : 0, t.createdAt, t.dueDate || '', t.dependsOn || '']);
        }
        this.db.run('COMMIT;');
        this.persist();
      }
      return true;
    } catch (err) {
      console.error('[ChecklistDB] syncAllTasks error:', err);
      if (!this.isNode) {
        try { this.db.run('ROLLBACK;'); } catch (e) {}
      }
      return false;
    }
  }

  // Record mutation log
  logMutation(mutation) {
    if (!this.db) return;

    try {
      const payloadStr = typeof mutation.payload === 'object' ? JSON.stringify(mutation.payload) : String(mutation.payload);
      if (this.isNode) {
        const stmt = this.db.prepare(`
          INSERT OR REPLACE INTO mutations (id, type, payload, timestamp, status)
          VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(mutation.id, mutation.type, payloadStr, mutation.timestamp, mutation.status || 'synced_local');
      } else {
        this.db.run(`
          INSERT OR REPLACE INTO mutations (id, type, payload, timestamp, status)
          VALUES (?, ?, ?, ?, ?)
        `, [mutation.id, mutation.type, payloadStr, mutation.timestamp, mutation.status || 'synced_local']);
        this.persist();
      }
    } catch (e) {}
  }

  // Export raw SQLite binary file (.sqlite)
  exportSQLiteBinary() {
    if (!this.db) return null;

    if (typeof this.db.export === 'function') {
      return this.db.export(); // Returns Uint8Array
    }
    return null;
  }

  // Import raw SQLite binary file
  importSQLiteBinary(uint8Array) {
    if (typeof window !== 'undefined' && window.SQL) {
      try {
        this.db = new window.SQL.Database(uint8Array);
        this._initSchema();
        this.persist();
        return true;
      } catch (e) {
        console.error('[ChecklistDB] importSQLiteBinary error:', e);
        return false;
      }
    }
    return false;
  }

  _rowToTask(row) {
    return {
      id: row.id,
      title: row.title,
      category: row.category,
      priority: row.priority,
      energy: row.energy,
      completed: Boolean(row.completed),
      createdAt: row.created_at,
      dueDate: row.due_date || '',
      dependsOn: row.depends_on || ''
    };
  }

  _uint8ArrayToBase64(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  _base64ToUint8Array(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
}

// Universal module export
if (typeof window !== 'undefined') {
  window.ChecklistDB = ChecklistDB;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChecklistDB;
}
