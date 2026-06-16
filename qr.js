const QRGenerator = {
  generate(text, options = {}) {
    const size = options.size || 300;
    const darkColor = options.darkColor || '#000000';
    const lightColor = options.lightColor || '#ffffff';
    const margin = options.margin || 4;

    const qr = this._encode(text);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const moduleCount = qr.length;
    const cellSize = (size - margin * 2) / moduleCount;

    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = lightColor;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = darkColor;
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (qr[row][col]) {
          ctx.fillRect(
            margin + col * cellSize,
            margin + row * cellSize,
            cellSize + 0.5,
            cellSize + 0.5
          );
        }
      }
    }

    return canvas;
  },

  _encode(text) {
    const data = this._utf8Encode(text);
    const version = this._getMinVersion(data.length);
    const size = 17 + version * 4;
    const matrix = Array.from({ length: size }, () => Array(size).fill(null));
    const reserved = Array.from({ length: size }, () => Array(size).fill(false));

    this._placeFunctionPatterns(matrix, reserved, version, size);
    const dataBits = this._getDataBits(data, version);
    this._placeData(matrix, reserved, dataBits, size);
    this._applyBestMask(matrix, reserved, version, size);

    return matrix.map(row => row.map(cell => !!cell));
  },

  _utf8Encode(str) {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      let charCode = str.charCodeAt(i);
      if (charCode < 0x80) {
        bytes.push(charCode);
      } else if (charCode < 0x800) {
        bytes.push(0xc0 | (charCode >> 6));
        bytes.push(0x80 | (charCode & 0x3f));
      } else if (charCode < 0xd800 || charCode >= 0xe000) {
        bytes.push(0xe0 | (charCode >> 12));
        bytes.push(0x80 | ((charCode >> 6) & 0x3f));
        bytes.push(0x80 | (charCode & 0x3f));
      } else {
        i++;
        charCode = 0x10000 + (((charCode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        bytes.push(0xf0 | (charCode >> 18));
        bytes.push(0x80 | ((charCode >> 12) & 0x3f));
        bytes.push(0x80 | ((charCode >> 6) & 0x3f));
        bytes.push(0x80 | (charCode & 0x3f));
      }
    }
    return new Uint8Array(bytes);
  },

  _getMinVersion(dataLength) {
    const capacities = [
      17, 32, 53, 78, 106, 134, 154, 192, 230, 271,
      321, 367, 425, 458, 520, 586, 644, 718, 792, 858,
      929, 1003, 1091, 1171, 1273, 1367, 1465, 1528, 1628, 1732,
      1840, 1952, 2068, 2188, 2303, 2431, 2563, 2699, 2809, 2953
    ];
    const dataCapacity = Math.floor(capacities[0] * 0.7);
    for (let i = 0; i < capacities.length; i++) {
      const capacity = Math.floor(capacities[i] * 0.7);
      if (dataLength <= capacity) return i + 1;
    }
    return 40;
  },

  _getECInfo(version) {
    const table = [
      [7, 1, 19], [10, 1, 16], [15, 1, 13], [20, 1, 9], [26, 1, 11],
      [18, 2, 15], [20, 2, 11], [24, 2, 11], [30, 2, 11], [18, 2, 11],
      [20, 4, 11], [24, 4, 11], [26, 4, 11], [30, 3, 11], [22, 5, 11],
      [24, 5, 11], [28, 5, 11], [30, 1, 12], [28, 5, 12], [28, 1, 12]
    ];
    const idx = Math.min(version - 1, table.length - 1);
    return table[idx];
  },

  _placeFunctionPatterns(matrix, reserved, version, size) {
    this._placeFinderPatterns(matrix, reserved, size);
    this._placeAlignPatterns(matrix, reserved, version, size);
    this._placeTimingPatterns(matrix, reserved, size);
    this._reserveFormatArea(matrix, reserved, size);
  },

  _placeFinderPatterns(matrix, reserved, size) {
    const pattern = [
      [1,1,1,1,1,1,1],
      [1,0,0,0,0,0,1],
      [1,0,1,1,1,0,1],
      [1,0,1,1,1,0,1],
      [1,0,1,1,1,0,1],
      [1,0,0,0,0,0,1],
      [1,1,1,1,1,1,1]
    ];

    const positions = [[0, 0], [0, size - 7], [size - 7, 0]];

    positions.forEach(([row, col]) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (row + r < size && col + c < size) {
            matrix[row + r][col + c] = pattern[r][c] ? 1 : 0;
            reserved[row + r][col + c] = true;
          }
        }
      }
    });

    for (let i = 0; i < 8; i++) {
      if (i < size) {
        if (!reserved[7][i]) { matrix[7][i] = 0; reserved[7][i] = true; }
        if (!reserved[i][7]) { matrix[i][7] = 0; reserved[i][7] = true; }
        if (!reserved[size - 8][i]) { matrix[size - 8][i] = 0; reserved[size - 8][i] = true; }
        if (!reserved[i][size - 8]) { matrix[i][size - 8] = 0; reserved[i][size - 8] = true; }
      }
    }
    if (size > 14) {
      for (let i = 0; i < 8; i++) {
        if (!reserved[8][size - 1 - i]) { matrix[8][size - 1 - i] = 0; reserved[8][size - 1 - i] = true; }
        if (!reserved[size - 1 - i][8]) { matrix[size - 1 - i][8] = 0; reserved[size - 1 - i][8] = true; }
      }
    }
  },

  _placeAlignPatterns(matrix, reserved, version, size) {
    if (version < 2) return;
    const positions = this._getAlignmentPositions(version);
    positions.forEach(([row, col]) => {
      if (reserved[row][col]) return;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const nr = row + r, nc = col + c;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size && !reserved[nr][nc]) {
            matrix[nr][nc] = (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) ? 1 : 0;
            reserved[nr][nc] = true;
          }
        }
      }
    });
  },

  _getAlignmentPositions(version) {
    if (version === 1) return [];
    const first = 6;
    const last = 17 + version * 4 - 7;
    if (first === last) return [[first, first]];
    const count = Math.floor(version / 7) + 2;
    const step = Math.round((last - first) / (count - 1));
    const positions = [];
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < count; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === count - 1) || (i === count - 1 && j === 0)) continue;
        positions.push([first + i * step, first + j * step]);
      }
    }
    return positions;
  },

  _placeTimingPatterns(matrix, reserved, size) {
    for (let i = 8; i < size - 8; i++) {
      if (!reserved[6][i]) {
        matrix[6][i] = i % 2 === 0 ? 1 : 0;
        reserved[6][i] = true;
      }
      if (!reserved[i][6]) {
        matrix[i][6] = i % 2 === 0 ? 1 : 0;
        reserved[i][6] = true;
      }
    }
  },

  _reserveFormatArea(matrix, reserved, size) {
    for (let i = 0; i < 15; i++) {
      if (i < 9 && !reserved[8][i]) { reserved[8][i] = true; matrix[8][i] = 0; }
      if (i < 8 && !reserved[i][8]) { reserved[i][8] = true; matrix[i][8] = 0; }
      if (i < 8 && !reserved[size - 1 - i][8]) { reserved[size - 1 - i][8] = true; matrix[size - 1 - i][8] = 0; }
      if (!reserved[8][size - 1 - i]) { reserved[8][size - 1 - i] = true; matrix[8][size - 1 - i] = 0; }
    }
    if (size > 14) {
      for (let i = 0; i < 6; i++) {
        if (!reserved[size - 11 + i][8]) { reserved[size - 11 + i][8] = true; matrix[size - 11 + i][8] = 0; }
        if (!reserved[8][size - 11 + i]) { reserved[8][size - 11 + i] = true; matrix[8][size - 11 + i] = 0; }
      }
    }
  },

  _getDataBits(data, version) {
    const bits = [];
    const modeIndicator = 0b0100;
    bits.push(...this._intToBits(modeIndicator, 4));
    const charCountBits = version <= 9 ? 8 : 16;
    bits.push(...this._intToBits(data.length, charCountBits));
    for (let i = 0; i < data.length; i++) {
      bits.push(...this._intToBits(data[i], 8));
    }
    bits.push(0, 0, 0, 0);
    return bits;
  },

  _intToBits(value, length) {
    const bits = [];
    for (let i = length - 1; i >= 0; i--) {
      bits.push((value >> i) & 1);
    }
    return bits;
  },

  _placeData(matrix, reserved, dataBits, size) {
    let bitIndex = 0;
    let direction = -1;
    let col = size - 1;

    while (col >= 0) {
      if (col === 6) col--;
      const startRow = direction === -1 ? size - 1 : 0;
      const endRow = direction === -1 ? -1 : size;

      for (let row = startRow; row !== endRow; row += direction) {
        for (let c = 0; c < 2; c++) {
          const actualCol = col - c;
          if (actualCol < 0 || actualCol >= size) continue;
          if (reserved[row][actualCol]) continue;

          const bit = bitIndex < dataBits.length ? dataBits[bitIndex] : 0;
          matrix[row][actualCol] = bit;
          bitIndex++;
        }
      }

      col -= 2;
      direction *= -1;
    }
  },

  _applyBestMask(matrix, reserved, version, size) {
    let bestMask = 0;
    let bestPenalty = Infinity;

    for (let mask = 0; mask < 8; mask++) {
      const testMatrix = matrix.map(row => [...row]);

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (!reserved[r][c]) {
            if (this._shouldMask(mask, r, c)) {
              testMatrix[r][c] ^= 1;
            }
          }
        }
      }

      this._drawFormatBits(testMatrix, mask, size);
      const penalty = this._calculatePenalty(testMatrix, size);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestMask = mask;
      }
    }

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!reserved[r][c] && this._shouldMask(bestMask, r, c)) {
          matrix[r][c] ^= 1;
        }
      }
    }
    this._drawFormatBits(matrix, bestMask, size);
  },

  _shouldMask(mask, row, col) {
    switch (mask) {
      case 0: return (row + col) % 2 === 0;
      case 1: return row % 2 === 0;
      case 2: return col % 3 === 0;
      case 3: return (row + col) % 3 === 0;
      case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
      case 5: return (row * col) % 2 + (row * col) % 3 === 0;
      case 6: return ((row * col) % 2 + (row * col) % 3) % 2 === 0;
      case 7: return ((row + col) % 2 + (row * col) % 3) % 2 === 0;
      default: return false;
    }
  },

  _drawFormatBits(matrix, mask, size) {
    const formatBits = this._getFormatBits(mask);
    for (let i = 0; i < 6; i++) matrix[8][i] = (formatBits >> (14 - i)) & 1;
    matrix[8][7] = (formatBits >> 8) & 1;
    matrix[8][8] = (formatBits >> 7) & 1;
    matrix[7][8] = (formatBits >> 6) & 1;
    for (let i = 0; i < 6; i++) matrix[5 - i][8] = (formatBits >> (i)) & 1;

    for (let i = 0; i < 8; i++) matrix[size - 1 - i][8] = (formatBits >> (14 - i)) & 1;
    for (let i = 0; i < 7; i++) matrix[8][size - 7 + i] = (formatBits >> (6 - i)) & 1;
  },

  _getFormatBits(mask) {
    let data = (0 << 10) | (mask << 5);
    let rem = data;
    for (let i = 0; i < 10; i++) {
      rem = (rem << 1) ^ ((rem >> 9) * 0x537);
    }
    data = (data << 10) | rem;
    data ^= 0x5412;
    return data & 0x7fff;
  },

  _calculatePenalty(matrix, size) {
    let penalty = 0;
    for (let r = 0; r < size; r++) {
      let count = 1;
      for (let c = 1; c < size; c++) {
        if (matrix[r][c] === matrix[r][c - 1]) {
          count++;
          if (count === 5) penalty += 3;
          else if (count > 5) penalty += 1;
        } else {
          count = 1;
        }
      }
    }
    for (let c = 0; c < size; c++) {
      let count = 1;
      for (let r = 1; r < size; r++) {
        if (matrix[r][c] === matrix[r - 1][c]) {
          count++;
          if (count === 5) penalty += 3;
          else if (count > 5) penalty += 1;
        } else {
          count = 1;
        }
      }
    }
    return penalty;
  }
};
