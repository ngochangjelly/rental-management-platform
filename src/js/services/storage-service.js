/**
 * Storage Service Layer
 * Provides flexible storage abstraction for localStorage and IndexedDB
 * Designed for future extensibility
 */

class StorageService {
  constructor(storageType = 'localStorage') {
    this.storageType = storageType;
    this.storage = this._initializeStorage(storageType);
  }

  _initializeStorage(type) {
    switch (type) {
      case 'localStorage':
        return new LocalStorageAdapter();
      case 'indexedDB':
        return new IndexedDBAdapter();
      default:
        return new LocalStorageAdapter();
    }
  }

  async save(key, data) {
    return await this.storage.save(key, data);
  }

  async get(key) {
    return await this.storage.get(key);
  }

  async remove(key) {
    return await this.storage.remove(key);
  }

  async getAll(keyPrefix) {
    return await this.storage.getAll(keyPrefix);
  }

  async clear(keyPrefix) {
    return await this.storage.clear(keyPrefix);
  }
}

/**
 * LocalStorage Adapter
 * Implements storage interface using browser localStorage
 */
class LocalStorageAdapter {
  async save(key, data) {
    try {
      const serializedData = JSON.stringify({
        data,
        timestamp: Date.now(),
        version: '1.0'
      });
      localStorage.setItem(key, serializedData);
      return { success: true };
    } catch (error) {
      console.error('LocalStorage save error:', error);
      return { success: false, error: error.message };
    }
  }

  async get(key) {
    try {
      const item = localStorage.getItem(key);
      if (!item) return { success: false, error: 'Item not found' };
      
      const parsed = JSON.parse(item);
      return { success: true, data: parsed.data, timestamp: parsed.timestamp };
    } catch (error) {
      console.error('LocalStorage get error:', error);
      return { success: false, error: error.message };
    }
  }

  async remove(key) {
    try {
      localStorage.removeItem(key);
      return { success: true };
    } catch (error) {
      console.error('LocalStorage remove error:', error);
      return { success: false, error: error.message };
    }
  }

  async getAll(keyPrefix) {
    try {
      const items = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(keyPrefix)) {
          const result = await this.get(key);
          if (result.success) {
            items.push({
              key: key.replace(keyPrefix, ''),
              fullKey: key,
              data: result.data,
              timestamp: result.timestamp
            });
          }
        }
      }
      return { success: true, items };
    } catch (error) {
      console.error('LocalStorage getAll error:', error);
      return { success: false, error: error.message };
    }
  }

  async clear(keyPrefix) {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(keyPrefix)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      return { success: true, removed: keysToRemove.length };
    } catch (error) {
      console.error('LocalStorage clear error:', error);
      return { success: false, error: error.message };
    }
  }
}

/**
 * IndexedDB Adapter (Future implementation)
 * Placeholder for future IndexedDB support
 */
class IndexedDBAdapter {
  constructor() {
    console.warn('IndexedDB adapter not yet implemented, falling back to localStorage');
    this.fallback = new LocalStorageAdapter();
  }

  async save(key, data) {
    return await this.fallback.save(key, data);
  }

  async get(key) {
    return await this.fallback.get(key);
  }

  async remove(key) {
    return await this.fallback.remove(key);
  }

  async getAll(keyPrefix) {
    return await this.fallback.getAll(keyPrefix);
  }

  async clear(keyPrefix) {
    return await this.fallback.clear(keyPrefix);
  }
}

/**
 * Contract Template Storage Service
 * Specialized service for managing contract templates
 */
class ContractTemplateService {
  constructor(storageType = 'localStorage') {
    this.storage = new StorageService(storageType);
    this.keyPrefix = 'contract_template_';
  }

  async saveTemplate(templateName, contractData, additionalData = {}) {
    const templateKey = this.keyPrefix + this._sanitizeKey(templateName);
    const templateData = {
      name: templateName,
      contractData: { ...contractData },
      additionalData: { ...additionalData },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const result = await this.storage.save(templateKey, templateData);
    if (result.success) {
      console.log('✅ Template saved:', templateName);
    } else {
      console.error('❌ Failed to save template:', result.error);
    }
    return result;
  }

  async getTemplate(templateName) {
    const templateKey = this.keyPrefix + this._sanitizeKey(templateName);
    return await this.storage.get(templateKey);
  }

  async getAllTemplates() {
    const result = await this.storage.getAll(this.keyPrefix);
    if (result.success) {
      // Sort by most recently updated
      result.items.sort((a, b) => 
        new Date(b.data.updatedAt) - new Date(a.data.updatedAt)
      );
    }
    return result;
  }

  async deleteTemplate(templateName) {
    const templateKey = this.keyPrefix + this._sanitizeKey(templateName);
    const result = await this.storage.remove(templateKey);
    if (result.success) {
      console.log('✅ Template deleted:', templateName);
    } else {
      console.error('❌ Failed to delete template:', result.error);
    }
    return result;
  }

  async updateTemplate(templateName, contractData, additionalData = {}) {
    const existing = await this.getTemplate(templateName);
    if (!existing.success) {
      return await this.saveTemplate(templateName, contractData, additionalData);
    }

    const templateKey = this.keyPrefix + this._sanitizeKey(templateName);
    const templateData = {
      ...existing.data,
      contractData: { ...contractData },
      additionalData: { ...additionalData },
      updatedAt: new Date().toISOString()
    };

    return await this.storage.save(templateKey, templateData);
  }

  async clearAllTemplates() {
    return await this.storage.clear(this.keyPrefix);
  }

  _sanitizeKey(templateName) {
    return templateName
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  _generateUniqueTemplateName(baseName) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    return `${baseName}_${timestamp}`;
  }
}

// Export for use in other modules
window.StorageService = StorageService;
window.ContractTemplateService = ContractTemplateService;