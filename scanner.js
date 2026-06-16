const QRScanner = {
  html5QrCode: null,
  scanning: false,

  async start(elementId, onScan, onError) {
    if (typeof Html5Qrcode === 'undefined') {
      onError('کتابخانه اسکنر بارگذاری نشده. لطفاً اینترنت را بررسی کنید.');
      return;
    }

    try {
      this.html5QrCode = new Html5Qrcode(elementId);
      this.scanning = true;

      await this.html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          if (this.scanning) {
            onScan(decodedText);
          }
        },
        (errorMessage) => {
          // scanning in progress, ignore errors
        }
      );
    } catch (err) {
      if (err.toString().includes('NotAllowedError') || err.toString().includes('Permission')) {
        onError('دسترسی به دوربین رد شد. لطفاً دسترسی دوربین را فعال کنید.');
      } else if (err.toString().includes('NotFoundError') || err.toString().includes('DevicesNotFound')) {
        onError('دوربین یافت نشد.');
      } else {
        onError('خطا در راه‌اندازی اسکنر: ' + err.message);
      }
    }
  },

  async stop() {
    this.scanning = false;
    if (this.html5QrCode) {
      try {
        const state = this.html5QrCode.getState();
        if (state === 2) {
          await this.html5QrCode.stop();
        }
      } catch (e) {
        // ignore
      }
      this.html5QrCode = null;
    }
  },

  isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
};
