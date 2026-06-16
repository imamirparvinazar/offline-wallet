const GameWalletDB = {
  DB_NAME: 'GameWalletDB',
  DB_VERSION: 1,
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains('wallet')) {
          const walletStore = db.createObjectStore('wallet', { keyPath: 'id' });
          walletStore.createIndex('walletName', 'walletName', { unique: false });
        }

        if (!db.objectStoreNames.contains('transactions')) {
          const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
          txStore.createIndex('type', 'type', { unique: false });
          txStore.createIndex('date', 'date', { unique: false });
        }

        if (!db.objectStoreNames.contains('usedTransactions')) {
          const usedStore = db.createObjectStore('usedTransactions', { keyPath: 'transactionId' });
          usedStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        reject(new Error('خطا در اتصال به دیتابیس: ' + e.target.error));
      };
    });
  },

  _getStore(storeName, mode = 'readonly') {
    const tx = this.db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  },

  async getWallet() {
    return new Promise((resolve, reject) => {
      const store = this._getStore('wallet');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result.length > 0 ? request.result[0] : null);
      request.onerror = () => reject(new Error('خطا در خواندن کیف پول'));
    });
  },

  async createWallet(walletData) {
    return new Promise((resolve, reject) => {
      const store = this._getStore('wallet', 'readwrite');
      const request = store.put(walletData);
      request.onsuccess = () => resolve(walletData);
      request.onerror = () => reject(new Error('خطا در ساخت کیف پول'));
    });
  },

  async updateBalance(amount) {
    const wallet = await this.getWallet();
    if (!wallet) throw new Error('کیف پول یافت نشد');
    wallet.balance = amount;
    return new Promise((resolve, reject) => {
      const store = this._getStore('wallet', 'readwrite');
      const request = store.put(wallet);
      request.onsuccess = () => resolve(wallet);
      request.onerror = () => reject(new Error('بروزرسانی موجودی ناموفق'));
    });
  },

  async addTransaction(transaction) {
    return new Promise((resolve, reject) => {
      const store = this._getStore('transactions', 'readwrite');
      const request = store.add(transaction);
      request.onsuccess = () => {
        this._trimTransactions().then(() => resolve(transaction)).catch(reject);
      };
      request.onerror = () => reject(new Error('خطا در ذخیره تراکنش'));
    });
  },

  async getTransactions() {
    return new Promise((resolve, reject) => {
      const store = this._getStore('transactions');
      const request = store.getAll();
      request.onsuccess = () => {
        const sorted = request.result.sort((a, b) => b.date - a.date);
        resolve(sorted.slice(0, 10));
      };
      request.onerror = () => reject(new Error('خطا در خواندن تراکنش‌ها'));
    });
  },

  async _trimTransactions() {
    return new Promise((resolve, reject) => {
      const store = this._getStore('transactions', 'readwrite');
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result.sort((a, b) => b.date - a.date);
        if (all.length > 10) {
          const toDelete = all.slice(10);
          const delStore = this._getStore('transactions', 'readwrite');
          toDelete.forEach(tx => delStore.delete(tx.id));
        }
        resolve();
      };
      request.onerror = () => reject();
    });
  },

  async isTransactionUsed(transactionId) {
    return new Promise((resolve, reject) => {
      const store = this._getStore('usedTransactions');
      const request = store.get(transactionId);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(new Error('خطا در بررسی تراکنش'));
    });
  },

  async markTransactionUsed(transactionId) {
    return new Promise((resolve, reject) => {
      const store = this._getStore('usedTransactions', 'readwrite');
      const request = store.put({
        transactionId: transactionId,
        createdAt: Date.now()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('خطا در ثبت تراکنش استفاده شده'));
    });
  },

  async getUsedTransactions() {
    return new Promise((resolve, reject) => {
      const store = this._getStore('usedTransactions');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('خطا در خواندن تراکنش‌های استفاده شده'));
    });
  }
};
