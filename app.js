const App = {
  wallet: null,
  currentPage: 'home',
  scannerActive: false,
  numpadTarget: null,
  numpadValue: '',

  async init() {
    try {
      await GameWalletDB.init();
      this.wallet = await GameWalletDB.getWallet();
      this.initTheme();

      document.getElementById('createWalletBtn').addEventListener('click', () => this.createWallet());
      document.getElementById('walletNameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.createWallet();
      });

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
    this.setupNumpad();
  },

  setupEventListeners() {
    document.getElementById('sendBtn').addEventListener('click', () => this.navigate('send'));
    document.getElementById('receiveBtn').addEventListener('click', () => this.navigate('receive'));
    document.getElementById('viewAllHistoryBtn').addEventListener('click', () => this.navigate('history'));

    document.getElementById('generateQrBtn').addEventListener('click', () => this.generateQR());
    document.getElementById('closeQrBtn').addEventListener('click', () => this.closeQR());
    document.getElementById('backBtn').addEventListener('click', () => this.navigate('home'));

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

  setupNumpad() {
    var self = this;
    var input = document.getElementById('sendAmountInput');

    input.addEventListener('focus', function() {
      self.openNumpad(input);
    });

    input.addEventListener('click', function() {
      self.openNumpad(input);
    });

    document.getElementById('numpadOverlay').addEventListener('click', function(e) {
      if (e.target === e.currentTarget) {
        self.closeNumpad();
      }
    });

    document.querySelectorAll('.numpad-key').forEach(function(key) {
      key.addEventListener('click', function() {
        var val = this.dataset.key;
        if (val === 'backspace') {
          self.numpadValue = self.numpadValue.slice(0, -1);
        } else if (val === 'confirm') {
          self.closeNumpad();
          return;
        } else {
          if (self.numpadValue.length < 8) {
            if (self.numpadValue === '0') {
              self.numpadValue = val;
            } else {
              self.numpadValue += val;
            }
          }
        }
        document.getElementById('numpadDisplay').textContent = self.numpadValue || '0';
        input.value = self.numpadValue;
      });
    });
  },

  openNumpad(input) {
    this.numpadTarget = input;
    this.numpadValue = input.value || '';
    document.getElementById('numpadDisplay').textContent = this.numpadValue || '0';
    document.getElementById('numpadOverlay').classList.add('active');
  },

  closeNumpad() {
    document.getElementById('numpadOverlay').classList.remove('active');
    this.numpadTarget = null;
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

  async loadTransactions(filter) {
    filter = filter || 'all';
    try {
      var transactions = await GameWalletDB.getTransactions();
      var listEl = filter === 'all' ? 'transactionList' : 'historyList';

      if (transactions.length === 0) {
        document.getElementById(listEl).innerHTML =
          '<div class="empty-state">' +
          '<div class="empty-state-icon">📭</div>' +
          '<div class="empty-state-text">هنوز تراکنشی ثبت نشده است</div>' +
          '</div>';
        return;
      }

      var filtered = filter === 'all'
        ? transactions.slice(0, 5)
        : transactions.filter(function(tx) { return tx.type === filter; });

      document.getElementById(listEl).innerHTML = filtered.map(tx => this.renderTransaction(tx)).join('');

      if (filter !== 'all') {
        this.updateStats(transactions);
      }
    } catch (err) {
      console.error('Error loading transactions:', err);
    }
  },

  renderTransaction(tx) {
    var isReceive = tx.type === 'receive';
    var icon = isReceive ? '📥' : '📤';
    var iconClass = isReceive ? 'receive' : 'send';
    var amountSign = isReceive ? '+' : '-';
    var name = isReceive ? (tx.sender || 'ناشناس') : (tx.receiver ? 'به ' + tx.receiver : 'ارسال');
    var date = this.formatDate(tx.date);

    return '<div class="transaction-item">' +
      '<div class="transaction-icon ' + iconClass + '">' + icon + '</div>' +
      '<div class="transaction-info">' +
      '<div class="transaction-name">' + this.escapeHtml(name) + '</div>' +
      '<div class="transaction-date">' + date + '</div>' +
      '</div>' +
      '<div class="transaction-amount ' + iconClass + '">' + amountSign + this.formatNumber(tx.amount) + '</div>' +
      '</div>';
  },

  updateStats(transactions) {
    var received = transactions.filter(function(tx) { return tx.type === 'receive'; }).reduce(function(sum, tx) { return sum + tx.amount; }, 0);
    var sent = transactions.filter(function(tx) { return tx.type === 'send'; }).reduce(function(sum, tx) { return sum + tx.amount; }, 0);
    document.getElementById('totalReceived').textContent = this.formatNumber(received);
    document.getElementById('totalSent').textContent = this.formatNumber(sent);
  },

  async filterHistory(filter) {
    try {
      var transactions = await GameWalletDB.getTransactions();
      var filtered = filter === 'all'
        ? transactions
        : transactions.filter(function(tx) { return tx.type === filter; });

      if (filtered.length === 0) {
        document.getElementById('historyList').innerHTML =
          '<div class="empty-state">' +
          '<div class="empty-state-icon">📭</div>' +
          '<div class="empty-state-text">تراکنشی یافت نشد</div>' +
          '</div>';
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

    document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
    document.getElementById(page + 'Page').classList.add('active');

    document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
    var navItem = document.querySelector('.nav-item[data-page="' + page + '"]');
    if (navItem) navItem.classList.add('active');

    var titles = { home: 'کیف پول بازی', send: 'ارسال سکه', receive: 'دریافت سکه', history: 'تاریخچه', settings: 'تنظیمات' };
    document.getElementById('topBarTitle').textContent = titles[page] || 'کیف پول بازی';

    var topBar = document.getElementById('topBar');
    var bottomNav = document.getElementById('bottomNav');
    var backBtn = document.getElementById('backBtn');
    var pagesWithNav = ['home', 'history', 'settings'];
    bottomNav.style.display = pagesWithNav.includes(page) ? 'flex' : 'none';
    backBtn.style.display = page === 'home' ? 'none' : 'flex';
    topBar.style.display = 'flex';

    if (page === 'home') this.loadDashboard();
    if (page === 'history') {
      document.querySelectorAll('.filter-chip').forEach(function(c) { c.classList.remove('active'); });
      document.querySelector('.filter-chip[data-filter="all"]').classList.add('active');
      this.loadTransactions('all');
    }
    if (page === 'send') {
      document.getElementById('sendAmountInput').value = '';
      this.numpadValue = '';
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
    var self = this;
    var amountInput = document.getElementById('sendAmountInput');
    var amount = parseInt(amountInput.value);

    if (!amount || amount <= 0) {
      this.showToast('لطفاً مقدار معتبر وارد کنید', 'error');
      return;
    }

    if (amount > this.wallet.balance) {
      this.showToast('موجودی ناکافی!', 'error');
      return;
    }

    this.showModal(
      'تأیید ارسال',
      'آیا از ارسال ' + this.formatNumber(amount) + ' سکه مطمئن هستید؟\nموجودی شما کم خواهد شد.',
      'warning',
      async function() {
        try {
          self.wallet.balance -= amount;
          await GameWalletDB.updateBalance(self.wallet.balance);

          var transactionId = GameCrypto.generateUUID();
          var signature = await GameCrypto.createSignature(
            transactionId, amount, self.wallet.walletName, self.wallet.secret
          );

          var transactionData = {
            id: transactionId,
            amount: amount,
            sender: self.wallet.walletName,
            createdAt: Date.now(),
            signature: signature
          };

          var qrJson = JSON.stringify(transactionData);

          var qrCanvas = QRGenerator.generate(qrJson, { size: 300, margin: 4 });
          var qrWrapper = document.getElementById('qrWrapper');
          qrWrapper.innerHTML = '';
          qrWrapper.appendChild(qrCanvas);

          var tx = {
            id: GameCrypto.generateUUID(),
            type: 'send',
            amount: amount,
            sender: self.wallet.walletName,
            receiver: 'گیرنده',
            date: Date.now()
          };
          await GameWalletDB.addTransaction(tx);

          document.getElementById('qrAmountDisplay').textContent = self.formatNumber(amount) + ' سکه';
          document.getElementById('qrContainer').classList.remove('hidden');
          document.getElementById('generateQrBtn').style.display = 'none';
          document.getElementById('sendBalanceHint').textContent = self.formatNumber(self.wallet.balance);
          self.showToast(self.formatNumber(amount) + ' سکه ارسال شد', 'success');
        } catch (err) {
          self.showToast('خطا در ساخت QR Code', 'error');
          self.wallet.balance += amount;
          await GameWalletDB.updateBalance(self.wallet.balance);
        }
      }
    );
  },

  closeQR() {
    document.getElementById('qrContainer').classList.add('hidden');
    document.getElementById('generateQrBtn').style.display = 'flex';
  },

  async startScanner() {
    var self = this;

    if (!QRScanner.isSupported()) {
      document.getElementById('scannerStatus').textContent = 'اسکنر QR در این مرورگر پشتیبانی نمی‌شود';
      return;
    }

    this.scannerActive = true;
    document.getElementById('scannerStatus').textContent = 'در حال راه‌اندازی دوربین...';

    await QRScanner.start(
      'qr-reader',
      function(data) { self.handleScannedData(data); },
      function(error) {
        document.getElementById('scannerStatus').textContent = error;
        self.showToast(error, 'error');
      }
    );
  },

  async stopScanner() {
    this.scannerActive = false;
    await QRScanner.stop();
    document.getElementById('scannerStatus').textContent = 'اسکنر متوقف شد';
  },

  async handleScannedData(data) {
    if (!this.scannerActive) return;

    await this.stopScanner();

    var parsed;
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
      var isUsed = await GameWalletDB.isTransactionUsed(parsed.id);
      if (isUsed) {
        this.showModal('خطا', 'این تراکنش قبلاً استفاده شده است!', 'error');
        return;
      }
    } catch (e) {
      this.showModal('خطا', 'خطا در بررسی تراکنش', 'error');
      return;
    }

    var self = this;
    this.showModal(
      'تأیید دریافت',
      this.formatNumber(parsed.amount) + ' سکه از "' + this.escapeHtml(parsed.sender) + '" دریافت می‌شود.',
      'info',
      async function() {
        try {
          self.wallet.balance += parsed.amount;
          await GameWalletDB.updateBalance(self.wallet.balance);

          var tx = {
            id: GameCrypto.generateUUID(),
            type: 'receive',
            amount: parsed.amount,
            sender: parsed.sender,
            receiver: self.wallet.walletName,
            date: Date.now()
          };
          await GameWalletDB.addTransaction(tx);
          await GameWalletDB.markTransactionUsed(parsed.id);

          self.showToast(self.formatNumber(parsed.amount) + ' سکه دریافت شد!', 'success');
          self.loadDashboard();
        } catch (err) {
          self.showToast('خطا در ثبت تراکنش: ' + err.message, 'error');
        }
      }
    );
  },

  async resetWallet() {
    var self = this;
    this.showModal(
      'حذف کیف پول',
      'آیا مطمئن هستید؟ تمام اطلاعات حذف خواهد شد.',
      'warning',
      async function() {
        try {
          indexedDB.deleteDatabase('GameWalletDB');
          localStorage.clear();
          self.wallet = null;
          self.showToast('کیف پول حذف شد', 'success');
          setTimeout(function() { location.reload(); }, 1000);
        } catch (err) {
          self.showToast('خطا در حذف کیف پول', 'error');
        }
      }
    );
  },

  exportWallet() {
    var data = JSON.stringify(this.wallet, null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'wallet-' + this.wallet.id.substring(0, 8) + '.json';
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
    var savedTheme = localStorage.getItem('wallet-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = savedTheme ? savedTheme === 'dark' : prefersDark;
    this.setTheme(isDark ? 'dark' : 'light');
  },

  toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme');
    this.setTheme(current === 'dark' ? 'light' : 'dark');
  },

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wallet-theme', theme);
    document.getElementById('darkModeToggle').checked = theme === 'dark';
    document.getElementById('themeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
  },

  showModal(title, message, type, onConfirm) {
    type = type || 'info';
    var overlay = document.getElementById('modalOverlay');
    var iconEl = document.getElementById('modalIcon');
    var titleEl = document.getElementById('modalTitle');
    var msgEl = document.getElementById('modalMessage');
    var actionsEl = document.getElementById('modalActions');

    var icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    iconEl.textContent = icons[type] || icons.info;
    iconEl.className = 'modal-icon ' + type;
    titleEl.textContent = title;
    msgEl.textContent = message;

    if (onConfirm) {
      actionsEl.innerHTML =
        '<button class="btn btn-text" id="modalCancelBtn">لغو</button>' +
        '<button class="btn btn-primary" id="modalConfirmBtn">تأیید</button>';

      document.getElementById('modalCancelBtn').addEventListener('click', function() { App.closeModal(); });
      document.getElementById('modalConfirmBtn').addEventListener('click', function() {
        App.closeModal();
        onConfirm();
      });
    } else {
      actionsEl.innerHTML = '<button class="btn btn-primary btn-full" id="modalConfirmBtn">بستن</button>';
      document.getElementById('modalConfirmBtn').addEventListener('click', function() { App.closeModal(); });
    }

    overlay.classList.add('active');
  },

  closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
  },

  showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toastContainer');
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(function() {
      toast.classList.add('hidden');
      setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
  },

  formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  formatDate(timestamp) {
    var date = new Date(timestamp);
    var now = new Date();
    var diff = now - date;

    if (diff < 60000) return 'همین الان';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' دقیقه پیش';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' ساعت پیش';

    var day = date.getDate();
    var month = date.getMonth() + 1;
    var year = date.getFullYear();
    return day + '/' + month + '/' + year;
  },

  escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', function() { App.init(); });
