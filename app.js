const App = {
  wallet: null,
  currentPage: 'home',
  scannerActive: false,

  async init() {
    try {
      await GameWalletDB.init();
      this.wallet = await GameWalletDB.getWallet();
      this.initTheme();

      if (!this.wallet) {
        this.showCreateWallet();
      } else {
        this.showApp();
      }

      this.hideSplash();
    } catch (err) {
      this.hideSplash();
      this.showToast('خطا در راه‌اندازی: ' + err.message, 'error');
    }
  },

  hideSplash() {
    setTimeout(() => {
      document.getElementById('splashScreen').classList.add('hidden');
    }, 1500);
  },

  showCreateWallet() {
    document.getElementById('createWalletPage').classList.add('active');
    document.getElementById('appContainer').style.display = 'none';
  },

  showApp() {
    document.getElementById('createWalletPage').classList.remove('active');
    document.getElementById('appContainer').style.display = 'flex';
    this.loadDashboard();
    this.setupEventListeners();
  },

  setupEventListeners() {
    document.getElementById('createWalletBtn').addEventListener('click', () => this.createWallet());
    document.getElementById('walletNameInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.createWallet();
    });

    document.getElementById('sendBtn').addEventListener('click', () => this.navigate('send'));
    document.getElementById('receiveBtn').addEventListener('click', () => this.navigate('receive'));
    document.getElementById('viewAllHistoryBtn').addEventListener('click', () => this.navigate('history'));

    document.getElementById('generateQrBtn').addEventListener('click', () => this.generateQR());
    document.getElementById('closeQrBtn').addEventListener('click', () => this.closeQR());
    document.getElementById('stopScanBtn').addEventListener('click', () => this.stopScanner());

    document.getElementById('bottomNav').addEventListener('click', (e) => {
      const navItem = e.target.closest('.nav-item');
      if (navItem) {
        const page = navItem.dataset.page;
        this.navigate(page);
      }
    });

    document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
    document.getElementById('darkModeToggle').addEventListener('change', (e) => {
      this.setTheme(e.target.checked ? 'dark' : 'light');
    });

    document.getElementById('resetWalletBtn').addEventListener('click', () => this.resetWallet());
    document.getElementById('exportWalletBtn').addEventListener('click', () => this.exportWallet());
    document.getElementById('aboutBtn').addEventListener('click', () => this.showAbout());

    document.getElementById('historyPage').addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (chip) {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.filterHistory(chip.dataset.filter);
      }
    });

    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeModal();
    });
  },

  async createWallet() {
    const nameInput = document.getElementById('walletNameInput');
    const name = nameInput.value.trim();

    if (!name) {
      this.showToast('لطفاً نام کیف پول را وارد کنید', 'error');
      nameInput.focus();
      return;
    }

    const wallet = {
      id: GameCrypto.generateUUID(),
      walletName: name,
      balance: 10000,
      createdAt: Date.now(),
      secret: GameCrypto.generateUUID()
    };

    try {
      await GameWalletDB.createWallet(wallet);
      this.wallet = wallet;
      this.showToast('کیف پول با موفقیت ساخته شد! 🎉', 'success');
      this.showApp();
    } catch (err) {
      this.showToast('خطا در ساخت کیف پول: ' + err.message, 'error');
    }
  },

  async loadDashboard() {
    if (!this.wallet) return;

    try {
      this.wallet = await GameWalletDB.getWallet();
      if (!this.wallet) return;

      document.getElementById('walletNameDisplay').textContent = this.wallet.walletName;
      document.getElementById('walletBalanceDisplay').innerHTML =
        this.formatNumber(this.wallet.balance) + ' <span class="wallet-card-balance-unit">سکه</span>';
      document.getElementById('walletIdDisplay').textContent = this.wallet.id.substring(0, 8) + '...';
      document.getElementById('sendBalanceHint').textContent = this.formatNumber(this.wallet.balance);

      await this.loadTransactions();
    } catch (err) {
      console.error('Error loading dashboard:', err);
    }
  },

  async loadTransactions(filter = 'all') {
    try {
      const transactions = await GameWalletDB.getTransactions();
      const listEl = filter === 'all' ? 'transactionList' : 'historyList';

      if (transactions.length === 0) {
        document.getElementById(listEl).innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <div class="empty-state-text">هنوز تراکنشی ثبت نشده است</div>
          </div>`;
        return;
      }

      const filtered = filter === 'all'
        ? transactions.slice(0, 5)
        : transactions.filter(tx => tx.type === filter);

      document.getElementById(listEl).innerHTML = filtered.map(tx => this.renderTransaction(tx)).join('');

      if (filter !== 'all') {
        this.updateStats(transactions);
      }
    } catch (err) {
      console.error('Error loading transactions:', err);
    }
  },

  renderTransaction(tx) {
    const isReceive = tx.type === 'receive';
    const icon = isReceive ? '📥' : '📤';
    const iconClass = isReceive ? 'receive' : 'send';
    const amountSign = isReceive ? '+' : '-';
    const name = isReceive ? (tx.sender || 'ناشناس') : (tx.receiver ? 'به ' + tx.receiver : 'ارسال');
    const date = this.formatDate(tx.date);

    return `
      <div class="transaction-item">
        <div class="transaction-icon ${iconClass}">${icon}</div>
        <div class="transaction-info">
          <div class="transaction-name">${this.escapeHtml(name)}</div>
          <div class="transaction-date">${date}</div>
        </div>
        <div class="transaction-amount ${iconClass}">${amountSign}${this.formatNumber(tx.amount)}</div>
      </div>`;
  },

  updateStats(transactions) {
    const received = transactions.filter(tx => tx.type === 'receive').reduce((sum, tx) => sum + tx.amount, 0);
    const sent = transactions.filter(tx => tx.type === 'send').reduce((sum, tx) => sum + tx.amount, 0);
    document.getElementById('totalReceived').textContent = this.formatNumber(received);
    document.getElementById('totalSent').textContent = this.formatNumber(sent);
  },

  async filterHistory(filter) {
    try {
      const transactions = await GameWalletDB.getTransactions();
      const filtered = filter === 'all'
        ? transactions
        : transactions.filter(tx => tx.type === filter);

      if (filtered.length === 0) {
        document.getElementById('historyList').innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <div class="empty-state-text">تراکنشی یافت نشد</div>
          </div>`;
        return;
      }

      document.getElementById('historyList').innerHTML = filtered.map(tx => this.renderTransaction(tx)).join('');
      this.updateStats(transactions);
    } catch (err) {
      this.showToast('خطا در بارگذاری تاریخچه', 'error');
    }
  },

  navigate(page) {
    this.currentPage = page;

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(page + 'Page').classList.add('active');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navItem) navItem.classList.add('active');

    const titles = { home: 'کیف پول بازی', send: 'ارسال سکه', receive: 'دریافت سکه', history: 'تاریخچه', settings: 'تنظیمات' };
    document.getElementById('topBarTitle').textContent = titles[page] || 'کیف پول بازی';

    const topBar = document.getElementById('topBar');
    const bottomNav = document.getElementById('bottomNav');
    const pagesWithNav = ['home', 'history', 'settings'];
    bottomNav.style.display = pagesWithNav.includes(page) ? 'flex' : 'none';
    topBar.style.display = 'flex';

    if (page === 'home') this.loadDashboard();
    if (page === 'history') {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      document.querySelector('.filter-chip[data-filter="all"]').classList.add('active');
      this.loadTransactions('all');
    }
    if (page === 'send') {
      document.getElementById('sendAmountInput').value = '';
      document.getElementById('qrContainer').classList.add('hidden');
      document.getElementById('generateQrBtn').style.display = 'flex';
      document.getElementById('sendBalanceHint').textContent = this.formatNumber(this.wallet.balance);
    }
    if (page === 'receive') {
      this.startScanner();
    } else {
      this.stopScanner();
    }
  },

  async generateQR() {
    const amountInput = document.getElementById('sendAmountInput');
    const amount = parseInt(amountInput.value);

    if (!amount || amount <= 0) {
      this.showToast('لطفاً مقدار معتبر وارد کنید', 'error');
      amountInput.focus();
      return;
    }

    if (amount > this.wallet.balance) {
      this.showToast('موجودی ناکافی! ❌', 'error');
      return;
    }

    const transactionId = GameCrypto.generateUUID();
    const signature = await GameCrypto.createSignature(
      transactionId, amount, this.wallet.walletName, this.wallet.secret
    );

    const transactionData = {
      id: transactionId,
      amount: amount,
      sender: this.wallet.walletName,
      createdAt: Date.now(),
      signature: signature
    };

    const qrJson = JSON.stringify(transactionData);

    try {
      const qrCanvas = QRGenerator.generate(qrJson, { size: 300, margin: 4 });
      const qrWrapper = document.getElementById('qrWrapper');
      qrWrapper.innerHTML = '';
      qrWrapper.appendChild(qrCanvas);

      document.getElementById('qrAmountDisplay').textContent = this.formatNumber(amount) + ' سکه';
      document.getElementById('qrContainer').classList.remove('hidden');
      document.getElementById('generateQrBtn').style.display = 'none';
    } catch (err) {
      this.showToast('خطا در ساخت QR Code', 'error');
    }
  },

  closeQR() {
    document.getElementById('qrContainer').classList.add('hidden');
    document.getElementById('generateQrBtn').style.display = 'flex';
  },

  async startScanner() {
    if (!QRScanner.isSupported()) {
      document.getElementById('scannerStatus').textContent = 'اسکنر QR در این مرورگر پشتیبانی نمی‌شود';
      return;
    }

    this.scannerActive = true;
    document.getElementById('stopScanBtn').style.display = 'inline-flex';
    document.getElementById('scannerStatus').textContent = 'در حال راه‌اندازی دوربین...';

    await QRScanner.start(
      'scannerVideo',
      'scannerCanvas',
      (data) => this.handleScannedData(data),
      (error) => {
        document.getElementById('scannerStatus').textContent = error;
        this.showToast(error, 'error');
      }
    );
  },

  stopScanner() {
    this.scannerActive = false;
    QRScanner.stop();
    document.getElementById('stopScanBtn').style.display = 'none';
    document.getElementById('scannerStatus').textContent = 'اسکنر متوقف شد';
  },

  async handleScannedData(data) {
    if (!this.scannerActive) return;

    this.stopScanner();

    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch (e) {
      this.showModal('خطا', 'کد QR نامعتبر است', 'error');
      return;
    }

    if (!parsed.id || !parsed.amount || !parsed.sender || !parsed.signature) {
      this.showModal('خطا', 'ساختار داده نامعتبر است', 'error');
      return;
    }

    if (parsed.amount <= 0) {
      this.showModal('خطا', 'مقدار نامعتبر', 'error');
      return;
    }

    try {
      const isUsed = await GameWalletDB.isTransactionUsed(parsed.id);
      if (isUsed) {
        this.showModal('خطا', 'این تراکنش قبلاً استفاده شده است!', 'error');
        return;
      }
    } catch (e) {
      this.showModal('خطا', 'خطا در بررسی تراکنش', 'error');
      return;
    }

    this.showModal(
      'تأیید دریافت',
      `${this.formatNumber(parsed.amount)} سکه از "${this.escapeHtml(parsed.sender)}" دریافت می‌شود.`,
      'info',
      async () => {
        try {
          this.wallet.balance += parsed.amount;
          await GameWalletDB.updateBalance(this.wallet.balance);

          const tx = {
            id: GameCrypto.generateUUID(),
            type: 'receive',
            amount: parsed.amount,
            sender: parsed.sender,
            receiver: this.wallet.walletName,
            date: Date.now()
          };
          await GameWalletDB.addTransaction(tx);
          await GameWalletDB.markTransactionUsed(parsed.id);

          this.showToast(`✅ ${this.formatNumber(parsed.amount)} سکه دریافت شد!`, 'success');
          this.loadDashboard();
        } catch (err) {
          this.showToast('خطا در ثبت تراکنش: ' + err.message, 'error');
        }
      }
    );
  },

  async resetWallet() {
    this.showModal(
      'حذف کیف پول',
      'آیا مطمئن هستید؟ تمام اطلاعات حذف خواهد شد.',
      'warning',
      async () => {
        try {
          indexedDB.deleteDatabase('GameWalletDB');
          localStorage.clear();
          this.wallet = null;
          this.showToast('کیف پول حذف شد', 'success');
          setTimeout(() => location.reload(), 1000);
        } catch (err) {
          this.showToast('خطا در حذف کیف پول', 'error');
        }
      }
    );
  },

  exportWallet() {
    const data = JSON.stringify(this.wallet, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wallet-${this.wallet.id.substring(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('فایل ذخیره شد', 'success');
  },

  showAbout() {
    this.showModal(
      'درباره برنامه',
      'کیف پول بازی نسخه ۱.۰.۰\n\nیک کیف پول دیجیتال آفلاین برای انتقال اعتبار با QR Code.\n\nتمام داده‌ها روی دستگاه ذخیره می‌شوند.',
      'info'
    );
  },

  initTheme() {
    const savedTheme = localStorage.getItem('wallet-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme ? savedTheme === 'dark' : prefersDark;

    this.setTheme(isDark ? 'dark' : 'light');
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    this.setTheme(current === 'dark' ? 'light' : 'dark');
  },

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wallet-theme', theme);
    document.getElementById('darkModeToggle').checked = theme === 'dark';
    document.getElementById('themeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
  },

  showModal(title, message, type = 'info', onConfirm = null) {
    const overlay = document.getElementById('modalOverlay');
    const iconEl = document.getElementById('modalIcon');
    const titleEl = document.getElementById('modalTitle');
    const msgEl = document.getElementById('modalMessage');
    const actionsEl = document.getElementById('modalActions');

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    iconEl.textContent = icons[type] || icons.info;
    iconEl.className = 'modal-icon ' + type;
    titleEl.textContent = title;
    msgEl.textContent = message;

    if (onConfirm) {
      actionsEl.innerHTML = `
        <button class="btn btn-text" id="modalCancelBtn">لغو</button>
        <button class="btn btn-primary" id="modalConfirmBtn">تأیید</button>`;

      document.getElementById('modalCancelBtn').addEventListener('click', () => this.closeModal());
      document.getElementById('modalConfirmBtn').addEventListener('click', () => {
        this.closeModal();
        onConfirm();
      });
    } else {
      actionsEl.innerHTML = `<button class="btn btn-primary btn-full" id="modalConfirmBtn">بستن</button>`;
      document.getElementById('modalConfirmBtn').addEventListener('click', () => this.closeModal());
    }

    overlay.classList.add('active');
  },

  closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hidden');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'همین الان';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' دقیقه پیش';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' ساعت پیش';

    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
