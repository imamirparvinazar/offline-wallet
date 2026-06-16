const QRScanner = {
  videoElement: null,
  canvasElement: null,
  stream: null,
  scanning: false,
  animationFrame: null,

  async start(videoId, canvasId, onScan, onError) {
    this.videoElement = document.getElementById(videoId);
    this.canvasElement = document.getElementById(canvasId);

    if (!this.videoElement || !this.canvasElement) {
      onError('المان‌های اسکنر یافت نشدند');
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      this.videoElement.srcObject = this.stream;
      await this.videoElement.play();
      this.scanning = true;
      this._scanLoop(onScan, onError);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        onError('دسترسی به دوربین رد شد. لطفاً دسترسی دوربین را فعال کنید.');
      } else if (err.name === 'NotFoundError') {
        onError('دوربین یافت نشد.');
      } else {
        onError('خطا در دسترسی به دوربین: ' + err.message);
      }
    }
  },

  _scanLoop(onScan, onError) {
    if (!this.scanning) return;

    if (typeof BarcodeDetector !== 'undefined') {
      this._scanWithBarcodeDetector(onScan, onError);
    } else {
      this._scanWithCanvas(onScan, onError);
    }
  },

  async _scanWithBarcodeDetector(onScan, onError) {
    try {
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const ctx = this.canvasElement.getContext('2d');

      const detect = async () => {
        if (!this.scanning) return;
        try {
          if (this.videoElement.readyState === this.videoElement.HAVE_ENOUGH_DATA) {
            this.canvasElement.width = this.videoElement.videoWidth;
            this.canvasElement.height = this.videoElement.videoHeight;
            ctx.drawImage(this.videoElement, 0, 0);

            const bitmap = await createImageBitmap(this.canvasElement);
            const codes = await detector.detect(bitmap);

            if (codes.length > 0 && codes[0].rawValue) {
              onScan(codes[0].rawValue);
              return;
            }
          }
        } catch (e) {
          // Continue scanning
        }
        this.animationFrame = requestAnimationFrame(detect);
      };
      detect();
    } catch (e) {
      this._scanWithCanvas(onScan, onError);
    }
  },

  _scanWithCanvas(onScan, onError) {
    const ctx = this.canvasElement.getContext('2d');

    const detect = () => {
      if (!this.scanning) return;

      if (this.videoElement.readyState === this.videoElement.HAVE_ENOUGH_DATA) {
        this.canvasElement.width = this.videoElement.videoWidth;
        this.canvasElement.height = this.videoElement.videoHeight;
        ctx.drawImage(this.videoElement, 0, 0);

        try {
          const imageData = ctx.getImageData(0, 0, this.canvasElement.width, this.canvasElement.height);
          const code = this._decodeQRFromImageData(imageData);
          if (code) {
            onScan(code);
            return;
          }
        } catch (e) {
          // Continue scanning
        }
      }

      this.animationFrame = requestAnimationFrame(detect);
    };
    detect();
  },

  _decodeQRFromImageData(imageData) {
    return null;
  },

  stop() {
    this.scanning = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  },

  isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
};
