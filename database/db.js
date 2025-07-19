const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, 'equipment_tracker.db');
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.createTables()
            .then(() => resolve())
            .catch(reject);
        }
      });
    });
  }

  async createTables() {
    // Check if tables already exist
    const tableExists = await this.get(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='admins'
    `);
    
    if (tableExists) {
      console.log('Database tables already exist, skipping creation');
      return Promise.resolve();
    }
    
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    return new Promise((resolve, reject) => {
      this.db.exec(schema, (err) => {
        if (err) {
          console.error('Error creating tables:', err);
          reject(err);
        } else {
          console.log('Database tables created successfully');
          resolve();
        }
      });
    });
  }

  // Generic query method
  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Database query error:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Insert method that returns the inserted ID
  async insert(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('Database insert error:', err);
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  // Update/Delete method
  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('Database run error:', err);
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  // Get single row
  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          console.error('Database get error:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Transaction support
  async transaction(callback) {
    return new Promise(async (resolve, reject) => {
      this.db.run('BEGIN TRANSACTION', async (err) => {
        if (err) {
          reject(err);
          return;
        }

        try {
          const result = await callback();
          this.db.run('COMMIT', (err) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        } catch (error) {
          this.db.run('ROLLBACK', () => {
            reject(error);
          });
        }
      });
    });
  }

  // Generate unique asset tag
  async generateAssetTag() {
    const prefix = 'IT';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    
    let assetTag = `${prefix}-${timestamp}-${random}`;
    
    // Check if tag already exists
    const existing = await this.get('SELECT id FROM equipment WHERE asset_tag = ?', [assetTag]);
    if (existing) {
      // If collision, try again (very unlikely)
      return this.generateAssetTag();
    }
    
    return assetTag;
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

module.exports = new Database();