const QRGenerator = {
  generate(text, options = {}) {
    const size = options.size || 300;

    if (typeof qrcode === 'undefined') {
      throw new Error('کتابخانه QR بارگذاری نشده است. لطفاً اینترنت را بررسی کنید.');
    }

    var qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();

    var moduleCount = qr.getModuleCount();
    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');

    var margin = options.margin || 4;
    var cellSize = (size - margin * 2) / moduleCount;

    ctx.fillStyle = options.lightColor || '#ffffff';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = options.darkColor || '#000000';
    for (var r = 0; r < moduleCount; r++) {
      for (var c = 0; c < moduleCount; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect(
            margin + c * cellSize,
            margin + r * cellSize,
            cellSize + 0.5,
            cellSize + 0.5
          );
        }
      }
    }

    return canvas;
  }
};
