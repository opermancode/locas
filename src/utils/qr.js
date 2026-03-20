// Pure JS QR Code generator
// Generates a UPI QR code as an SVG string, then as a data URI
// UPI deep link format: upi://pay?pa=UPI_ID&pn=NAME&am=AMOUNT&cu=INR

// We use a minimal QR encoding library embedded here
// Based on qrcodejs (MIT licensed, no dependencies)

const QRErrorCorrectLevel = { L: 1, M: 0, Q: 3, H: 2 };

function QR8bitByte(data) {
  this.mode = 4;
  this.data = data;
  this.parsedData = [];
  for (let i = 0; i < data.length; i++) {
    const byteArray = [];
    const code = data.charCodeAt(i);
    if (code > 65536) {
      byteArray[0] = 0xF0 | ((code & 0x1C0000) >>> 18);
      byteArray[1] = 0x80 | ((code & 0x3F000)  >>> 12);
      byteArray[2] = 0x80 | ((code & 0xFC0)    >>> 6);
      byteArray[3] = 0x80 | (code & 0x3F);
    } else if (code > 2048) {
      byteArray[0] = 0xE0 | ((code & 0xF000) >>> 12);
      byteArray[1] = 0x80 | ((code & 0xFC0)  >>> 6);
      byteArray[2] = 0x80 | (code & 0x3F);
    } else if (code > 128) {
      byteArray[0] = 0xC0 | ((code & 0x7C0) >>> 6);
      byteArray[1] = 0x80 | (code & 0x3F);
    } else {
      byteArray[0] = code;
    }
    this.parsedData.push(...byteArray);
  }
  if (this.parsedData.length !== this.data.length) {
    this.parsedData.unshift(191, 187, 239);
  }
}
QR8bitByte.prototype = {
  getLength() { return this.parsedData.length; },
  write(buffer) {
    for (let i = 0; i < this.parsedData.length; i++) {
      buffer.put(this.parsedData[i], 8);
    }
  }
};

function QRPolynomial(num, shift) {
  if (num.length === undefined) throw new Error(`${num.length}/${shift}`);
  let offset = 0;
  while (offset < num.length && num[offset] === 0) offset++;
  this.num = new Array(num.length - offset + shift);
  for (let i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
}
QRPolynomial.prototype = {
  get(idx) { return this.num[idx]; },
  getLength() { return this.num.length; },
  multiply(e) {
    const num = new Array(this.getLength() + e.getLength() - 1);
    for (let i = 0; i < this.getLength(); i++)
      for (let j = 0; j < e.getLength(); j++)
        num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
    return new QRPolynomial(num, 0);
  },
  mod(e) {
    if (this.getLength() - e.getLength() < 0) return this;
    const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
    const num = this.num.slice();
    for (let i = 0; i < e.getLength(); i++) num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
    return new QRPolynomial(num, 0).mod(e);
  }
};

const QRMath = {
  glog(n) {
    if (n < 1) throw new Error(`glog(${n})`);
    return QRMath.LOG_TABLE[n];
  },
  gexp(n) {
    while (n < 0) n += 255;
    while (n >= 256) n -= 255;
    return QRMath.EXP_TABLE[n];
  },
  EXP_TABLE: new Array(256),
  LOG_TABLE: new Array(256),
};
for (let i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
for (let i = 8; i < 256; i++) QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^ QRMath.EXP_TABLE[i - 5] ^ QRMath.EXP_TABLE[i - 6] ^ QRMath.EXP_TABLE[i - 8];
for (let i = 0; i < 255; i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;

const QRRSBlock = (() => {
  const RS_BLOCK_TABLE = [
    1,26,19,1,26,16,1,26,13,1,26,9,
    1,44,34,1,44,28,1,44,22,1,44,16,
    1,70,55,1,70,44,2,35,17,2,35,13,
    1,100,80,2,50,32,2,50,24,4,25,9,
    1,134,108,2,67,43,2,33,15,2,33,11,
    2,86,68,4,43,27,4,43,19,4,43,15,
    2,98,78,4,49,31,2,32,14,4,39,13,
    2,121,97,2,60,38,4,40,18,4,40,14,
    2,146,116,3,58,36,4,36,16,4,36,12,
    2,86,68,4,69,43,6,43,19,6,43,15,
    4,101,81,1,80,50,4,50,22,3,36,12,
    2,116,92,6,58,36,4,46,20,7,42,14,
    4,133,107,8,59,37,8,44,20,12,33,11,
    3,145,115,4,64,40,11,36,16,11,36,12,
    5,109,87,5,65,41,5,54,24,11,36,12,
    5,122,98,7,73,45,15,43,19,3,45,15,
    1,135,107,10,74,46,1,50,22,2,42,14,
    5,150,120,9,69,43,17,50,22,2,42,14,
    3,141,113,3,70,44,17,47,21,9,39,13,
    3,135,107,3,67,41,15,54,24,15,43,15,
    4,144,116,17,68,42,17,50,22,19,46,16,
    2,139,111,17,74,46,7,54,24,34,37,13,
    4,151,121,4,75,47,11,54,24,16,45,15,
    6,147,117,6,73,45,11,54,24,30,46,16,
    8,132,106,8,75,47,11,54,24,22,45,15,
    10,142,114,19,74,46,16,54,24,33,46,16,
    8,152,122,22,73,45,16,53,23,12,45,15,
    3,147,117,3,73,45,16,54,24,12,45,15,
    7,146,116,21,73,45,16,53,23,12,45,15,
    5,145,115,19,75,47,22,54,24,11,45,15,
    13,145,115,2,75,47,33,54,24,28,45,15,
    17,145,115,10,74,46,4,54,24,31,45,15,
    17,145,115,14,74,46,11,54,24,31,45,15,
    13,145,115,14,74,46,16,54,24,37,45,15,
    12,151,121,12,75,47,18,54,24,37,45,15,
    6,151,121,6,75,47,24,54,24,31,45,15,
    17,152,122,29,74,46,19,53,23,26,45,15,
    4,152,122,13,74,46,16,53,23,44,45,15,
    20,147,117,40,75,47,37,54,24,41,45,15,
    19,148,118,18,75,47,28,54,24,39,45,15,
  ];
  function getRsBlockTable(typeNumber, errorCorrectLevel) {
    switch (errorCorrectLevel) {
      case QRErrorCorrectLevel.L: return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectLevel.M: return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectLevel.Q: return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectLevel.H: return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
    }
  }
  return {
    getRSBlocks(typeNumber, errorCorrectLevel) {
      const rsBlock = getRsBlockTable(typeNumber, errorCorrectLevel);
      const length = rsBlock.length / 3;
      const list = [];
      for (let i = 0; i < length; i++) {
        const count = rsBlock[i * 3 + 0];
        const totalCount = rsBlock[i * 3 + 1];
        const dataCount = rsBlock[i * 3 + 2];
        for (let j = 0; j < count; j++) list.push({ totalCount, dataCount });
      }
      return list;
    }
  };
})();

function QRBitBuffer() { this.buffer = []; this.length = 0; }
QRBitBuffer.prototype = {
  get(index) { return ((this.buffer[Math.floor(index / 8)] >>> (7 - index % 8)) & 1) === 1; },
  put(num, length) { for (let i = 0; i < length; i++) this.putBit(((num >>> (length - i - 1)) & 1) === 1); },
  getLengthInBits() { return this.length; },
  putBit(bit) {
    const bufferIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufferIndex) this.buffer.push(0);
    if (bit) this.buffer[bufferIndex] |= (0x80 >>> (this.length % 8));
    this.length++;
  }
};

const QRCodeModel = (() => {
  const PAD0 = 0xEC, PAD1 = 0x11;
  const PATTERN_POSITION_TABLE = [
    [], [6,18], [6,22], [6,26], [6,30], [6,34],
    [6,22,38], [6,24,42], [6,26,46], [6,28,50], [6,30,54],
    [6,32,58], [6,34,62], [6,26,46,66], [6,26,48,70],
    [6,26,50,74], [6,30,54,78], [6,30,56,82], [6,30,58,86],
    [6,34,62,90], [6,28,50,72,94], [6,26,50,74,98],
    [6,30,54,78,102], [6,28,54,80,106], [6,32,58,84,110],
    [6,30,58,86,114], [6,34,62,90,118], [6,26,50,74,98,122],
    [6,30,54,78,102,126], [6,26,52,78,104,130],
    [6,30,56,82,108,134], [6,34,60,86,112,138],
    [6,30,58,86,114,142], [6,34,62,90,118,146],
    [6,30,54,78,102,126,150], [6,24,50,76,102,128,154],
    [6,28,54,80,106,132,158], [6,32,58,84,110,136,162],
    [6,26,54,82,110,138,166], [6,30,58,86,114,142,170],
  ];
  function getMaskFunction(maskPattern) {
    switch (maskPattern) {
      case 0: return (i,j) => (i+j)%2===0;
      case 1: return (i,j) => i%2===0;
      case 2: return (i,j) => j%3===0;
      case 3: return (i,j) => (i+j)%3===0;
      case 4: return (i,j) => (Math.floor(i/2)+Math.floor(j/3))%2===0;
      case 5: return (i,j) => (i*j)%2+(i*j)%3===0;
      case 6: return (i,j) => ((i*j)%2+(i*j)%3)%2===0;
      case 7: return (i,j) => ((i*j)%3+(i+j)%2)%2===0;
    }
  }
  function QRCode(typeNumber, errorCorrectLevel) {
    this.typeNumber = typeNumber;
    this.errorCorrectLevel = errorCorrectLevel;
    this.modules = null;
    this.moduleCount = 0;
    this.dataCache = null;
    this.dataList = [];
  }
  QRCode.prototype = {
    addData(data) {
      this.dataList.push(new QR8bitByte(data));
      this.dataCache = null;
    },
    isDark(row, col) {
      if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) throw new Error(`${row},${col}`);
      return this.modules[row][col];
    },
    getModuleCount() { return this.moduleCount; },
    make() { this.makeImpl(false, this.getBestMaskPattern()); },
    makeImpl(test, maskPattern) {
      this.moduleCount = this.typeNumber * 4 + 17;
      this.modules = Array.from({ length: this.moduleCount }, () => new Array(this.moduleCount).fill(null));
      this.setupPositionProbePattern(0, 0);
      this.setupPositionProbePattern(this.moduleCount - 7, 0);
      this.setupPositionProbePattern(0, this.moduleCount - 7);
      this.setupPositionAdjustPattern();
      this.setupTimingPattern();
      this.setupTypeInfo(test, maskPattern);
      if (this.typeNumber >= 7) this.setupTypeNumber(test);
      if (this.dataCache === null) this.dataCache = QRCode.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
      this.mapData(this.dataCache, maskPattern);
    },
    setupPositionProbePattern(row, col) {
      for (let r = -1; r <= 7; r++) {
        if (row + r <= -1 || this.moduleCount <= row + r) continue;
        for (let c = -1; c <= 7; c++) {
          if (col + c <= -1 || this.moduleCount <= col + c) continue;
          this.modules[row+r][col+c] =
            (0<=r&&r<=6&&(c===0||c===6)) ||
            (0<=c&&c<=6&&(r===0||r===6)) ||
            (2<=r&&r<=4&&2<=c&&c<=4);
        }
      }
    },
    setupTimingPattern() {
      for (let r = 8; r < this.moduleCount - 8; r++) if (this.modules[r][6] === null) this.modules[r][6] = r%2===0;
      for (let c = 8; c < this.moduleCount - 8; c++) if (this.modules[6][c] === null) this.modules[6][c] = c%2===0;
    },
    setupPositionAdjustPattern() {
      const pos = PATTERN_POSITION_TABLE[this.typeNumber - 1];
      for (let i = 0; i < pos.length; i++) {
        for (let j = 0; j < pos.length; j++) {
          const row = pos[i], col = pos[j];
          if (this.modules[row][col] !== null) continue;
          for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++)
            this.modules[row+r][col+c] = r===-2||r===2||c===-2||c===2||(r===0&&c===0);
        }
      }
    },
    setupTypeNumber(test) {
      const bits = QRUtil.getBCHTypeNumber(this.typeNumber);
      for (let i = 0; i < 18; i++) {
        this.modules[Math.floor(i/3)][i%3+this.moduleCount-8-3] = !test && ((bits>>i)&1)===1;
      }
      for (let i = 0; i < 18; i++) {
        this.modules[i%3+this.moduleCount-8-3][Math.floor(i/3)] = !test && ((bits>>i)&1)===1;
      }
    },
    setupTypeInfo(test, maskPattern) {
      const data = (this.errorCorrectLevel << 3) | maskPattern;
      const bits = QRUtil.getBCHTypeInfo(data);
      for (let i = 0; i < 15; i++) {
        const mod = !test && ((bits>>i)&1)===1;
        if (i<6) this.modules[i][8]=mod;
        else if (i<8) this.modules[i+1][8]=mod;
        else this.modules[this.moduleCount-15+i][8]=mod;
      }
      for (let i = 0; i < 15; i++) {
        const mod = !test && ((bits>>i)&1)===1;
        if (i<8) this.modules[8][this.moduleCount-i-1]=mod;
        else if (i<9) this.modules[8][15-i-1+1]=mod;
        else this.modules[8][15-i-1]=mod;
      }
      this.modules[this.moduleCount-8][8] = !test;
    },
    mapData(data, maskPattern) {
      let inc = -1, row = this.moduleCount - 1, bitIndex = 7, byteIndex = 0;
      const maskFunc = getMaskFunction(maskPattern);
      for (let col = this.moduleCount - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        while (true) {
          for (let c = 0; c < 2; c++) {
            if (this.modules[row][col-c] === null) {
              let dark = false;
              if (byteIndex < data.length) dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
              if (maskFunc(row, col-c)) dark = !dark;
              this.modules[row][col-c] = dark;
              bitIndex--;
              if (bitIndex === -1) { byteIndex++; bitIndex = 7; }
            }
          }
          row += inc;
          if (row < 0 || this.moduleCount <= row) { row -= inc; inc = -inc; break; }
        }
      }
    },
    getBestMaskPattern() {
      let minLostPoint = 0, pattern = 0;
      for (let i = 0; i < 8; i++) {
        this.makeImpl(true, i);
        const lostPoint = QRUtil.getLostPoint(this);
        if (i === 0 || minLostPoint > lostPoint) { minLostPoint = lostPoint; pattern = i; }
      }
      return pattern;
    },
  };
  QRCode.createData = function(typeNumber, errorCorrectLevel, dataList) {
    const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
    const buffer = new QRBitBuffer();
    for (let i = 0; i < dataList.length; i++) {
      const data = dataList[i];
      buffer.put(data.mode, 4);
      buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber));
      data.write(buffer);
    }
    let totalDataCount = 0;
    for (let i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
    if (buffer.getLengthInBits() > totalDataCount * 8) throw new Error(`code length overflow: ${buffer.getLengthInBits()} > ${totalDataCount*8}`);
    if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) buffer.put(0, 4);
    while (buffer.getLengthInBits() % 8 !== 0) buffer.putBit(false);
    while (true) {
      if (buffer.getLengthInBits() >= totalDataCount * 8) break;
      buffer.put(PAD0, 8);
      if (buffer.getLengthInBits() >= totalDataCount * 8) break;
      buffer.put(PAD1, 8);
    }
    return QRCode.createBytes(buffer, rsBlocks);
  };
  QRCode.createBytes = function(buffer, rsBlocks) {
    let offset = 0;
    let maxDcCount = 0, maxEcCount = 0;
    const dcdata = new Array(rsBlocks.length);
    const ecdata = new Array(rsBlocks.length);
    for (let r = 0; r < rsBlocks.length; r++) {
      const dcCount = rsBlocks[r].dataCount;
      const ecCount = rsBlocks[r].totalCount - dcCount;
      maxDcCount = Math.max(maxDcCount, dcCount);
      maxEcCount = Math.max(maxEcCount, ecCount);
      dcdata[r] = new Array(dcCount);
      for (let i = 0; i < dcdata[r].length; i++) dcdata[r][i] = 0xff & buffer.buffer[i + offset];
      offset += dcCount;
      const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
      const rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
      const modPoly = rawPoly.mod(rsPoly);
      ecdata[r] = new Array(rsPoly.getLength() - 1);
      for (let i = 0; i < ecdata[r].length; i++) {
        const modIndex = i + modPoly.getLength() - ecdata[r].length;
        ecdata[r][i] = modIndex >= 0 ? modPoly.get(modIndex) : 0;
      }
    }
    const totalCodeCount = rsBlocks.reduce((s, b) => s + b.totalCount, 0);
    const data = new Array(totalCodeCount);
    let index = 0;
    for (let i = 0; i < maxDcCount; i++) for (let r = 0; r < rsBlocks.length; r++) if (i < dcdata[r].length) data[index++] = dcdata[r][i];
    for (let i = 0; i < maxEcCount; i++) for (let r = 0; r < rsBlocks.length; r++) if (i < ecdata[r].length) data[index++] = ecdata[r][i];
    return data;
  };
  return QRCode;
})();

const QRUtil = {
  PATTERN_POSITION_TABLE: [
    [], [6,18], [6,22], [6,26], [6,30], [6,34],
    [6,22,38], [6,24,42], [6,26,46], [6,28,50], [6,30,54],
    [6,32,58], [6,34,62], [6,26,46,66], [6,26,48,70],
    [6,26,50,74], [6,30,54,78], [6,30,56,82], [6,30,58,86],
    [6,34,62,90], [6,28,50,72,94], [6,26,50,74,98],
    [6,30,54,78,102], [6,28,54,80,106], [6,32,58,84,110],
    [6,30,58,86,114], [6,34,62,90,118], [6,26,50,74,98,122],
    [6,30,54,78,102,126], [6,26,52,78,104,130],
    [6,30,56,82,108,134], [6,34,60,86,112,138],
    [6,30,58,86,114,142], [6,34,62,90,118,146],
    [6,30,54,78,102,126,150], [6,24,50,76,102,128,154],
    [6,28,54,80,106,132,158], [6,32,58,84,110,136,162],
    [6,26,54,82,110,138,166], [6,30,58,86,114,142,170],
  ],
  G15: (1<<10)|(1<<8)|(1<<5)|(1<<4)|(1<<2)|(1<<1)|(1<<0),
  G18: (1<<12)|(1<<11)|(1<<10)|(1<<9)|(1<<8)|(1<<5)|(1<<2)|(1<<0),
  G15_MASK: (1<<14)|(1<<12)|(1<<10)|(1<<4)|(1<<1),
  getBCHTypeInfo(data) {
    let d = data << 10;
    while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0)
      d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15)));
    return ((data << 10) | d) ^ QRUtil.G15_MASK;
  },
  getBCHTypeNumber(data) {
    let d = data << 12;
    while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0)
      d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18)));
    return (data << 12) | d;
  },
  getBCHDigit(data) {
    let digit = 0;
    while (data !== 0) { digit++; data >>>= 1; }
    return digit;
  },
  getPatternPosition(typeNumber) { return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1]; },
  getMask(maskPattern, i, j) {
    switch (maskPattern) {
      case 0: return (i+j)%2===0;
      case 1: return i%2===0;
      case 2: return j%3===0;
      case 3: return (i+j)%3===0;
      case 4: return (Math.floor(i/2)+Math.floor(j/3))%2===0;
      case 5: return (i*j)%2+(i*j)%3===0;
      case 6: return ((i*j)%2+(i*j)%3)%2===0;
      case 7: return ((i*j)%3+(i+j)%2)%2===0;
    }
  },
  getErrorCorrectPolynomial(errorCorrectLength) {
    let a = new QRPolynomial([1], 0);
    for (let i = 0; i < errorCorrectLength; i++) a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
    return a;
  },
  getLengthInBits(mode, type) {
    if (1 <= type && type < 10) {
      switch (mode) { case 1: return 10; case 2: return 9; case 4: return 8; case 8: return 8; }
    } else if (type < 27) {
      switch (mode) { case 1: return 12; case 2: return 11; case 4: return 16; case 8: return 10; }
    } else {
      switch (mode) { case 1: return 14; case 2: return 13; case 4: return 16; case 8: return 12; }
    }
  },
  getLostPoint(qrCode) {
    const moduleCount = qrCode.getModuleCount();
    let lostPoint = 0;
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        let sameCount = 0;
        const dark = qrCode.isDark(row, col);
        for (let r = -1; r <= 1; r++) {
          if (row + r < 0 || moduleCount <= row + r) continue;
          for (let c = -1; c <= 1; c++) {
            if (col + c < 0 || moduleCount <= col + c) continue;
            if (r === 0 && c === 0) continue;
            if (dark === qrCode.isDark(row + r, col + c)) sameCount++;
          }
        }
        if (sameCount > 5) lostPoint += (3 + sameCount - 5);
      }
    }
    for (let row = 0; row < moduleCount - 1; row++) {
      for (let col = 0; col < moduleCount - 1; col++) {
        let count = 0;
        if (qrCode.isDark(row,   col))   count++;
        if (qrCode.isDark(row+1, col))   count++;
        if (qrCode.isDark(row,   col+1)) count++;
        if (qrCode.isDark(row+1, col+1)) count++;
        if (count === 0 || count === 4) lostPoint += 3;
      }
    }
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount - 6; col++) {
        if (qrCode.isDark(row,col) && !qrCode.isDark(row,col+1) && qrCode.isDark(row,col+2) && qrCode.isDark(row,col+3) && qrCode.isDark(row,col+4) && !qrCode.isDark(row,col+5) && qrCode.isDark(row,col+6)) lostPoint += 40;
      }
    }
    for (let col = 0; col < moduleCount; col++) {
      for (let row = 0; row < moduleCount - 6; row++) {
        if (qrCode.isDark(row,col) && !qrCode.isDark(row+1,col) && qrCode.isDark(row+2,col) && qrCode.isDark(row+3,col) && qrCode.isDark(row+4,col) && !qrCode.isDark(row+5,col) && qrCode.isDark(row+6,col)) lostPoint += 40;
      }
    }
    let darkCount = 0;
    for (let col = 0; col < moduleCount; col++) for (let row = 0; row < moduleCount; row++) if (qrCode.isDark(row, col)) darkCount++;
    const ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
    lostPoint += ratio * 10;
    return lostPoint;
  },
};

// ── Public API ────────────────────────────────────────────────────

/**
 * Generate UPI QR code as SVG data URI
 * @param {string} upiId - e.g. "9876543210@paytm"
 * @param {string} name  - Business name
 * @param {number} amount - Optional amount (0 = any amount)
 * @returns {string} SVG data URI string
 */
export function generateUPIQRDataURI(upiId, name = '', amount = 0) {
  try {
    // Build UPI deep link
    const upiURL = amount > 0
      ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR`
      : `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&cu=INR`;

    // Auto-detect QR version based on content length
    let typeNumber = 5;
    if (upiURL.length > 100) typeNumber = 7;
    if (upiURL.length > 150) typeNumber = 9;
    if (upiURL.length > 200) typeNumber = 10;

    const qr = new QRCodeModel(typeNumber, QRErrorCorrectLevel.M);
    qr.addData(upiURL);
    qr.make();

    const count = qr.getModuleCount();
    const cellSize = 4;
    const margin = 16;
    const size = count * cellSize + margin * 2;

    // Build SVG
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
    svg += `<rect width="${size}" height="${size}" fill="white"/>`;

    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) {
          const x = col * cellSize + margin;
          const y = row * cellSize + margin;
          svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
        }
      }
    }
    svg += '</svg>';

    // Convert SVG to data URI
    const encoded = encodeURIComponent(svg)
      .replace(/'/g, '%27')
      .replace(/"/g, '%22');

    return `data:image/svg+xml;charset=utf-8,${encoded}`;
  } catch (e) {
    console.error('QR generation failed:', e);
    return null;
  }
}

/**
 * Build UPI QR HTML block for invoice templates
 */
export function buildUPIQRBlock(upiId, businessName, accentColor = '#1E40AF') {
  if (!upiId) return '';
  const dataURI = generateUPIQRDataURI(upiId, businessName);
  if (!dataURI) return '';

  return `
    <div style="border:1px solid ${accentColor}22;border-radius:6px;padding:10px;text-align:center;background:#fff;margin-top:8px">
      <div style="font-size:9px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">
        Scan &amp; Pay via UPI
      </div>
      <img src="${dataURI}" width="90" height="90" style="display:block;margin:0 auto" />
      <div style="font-size:9px;color:#555;margin-top:5px;font-weight:600">${upiId}</div>
    </div>
  `;
}
