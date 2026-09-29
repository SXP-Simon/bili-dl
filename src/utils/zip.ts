/**
 * 纯 TypeScript 轻量级 ZIP 归档构建器 (无任何外部依赖)
 * 遵循 PKZip 2.0 规范，完整支持 UTF-8 路径名与目录层级结构
 */

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c >>> 0;
}

export function calculateCrc32(data: Uint8Array): number {
  let crc = 0 ^ (-1);
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

export interface ZipFileInput {
  name: string; // 相对路径，如 "Folder/P01_标题.srt"
  data: Uint8Array | string;
}

/**
 * 将多个文件打包为一个标准的 .zip Blob
 */
export function createZipArchive(files: ZipFileInput[]): Blob {
  const textEncoder = new TextEncoder();
  const fileEntries: Array<{
    nameBytes: Uint8Array;
    dataBytes: Uint8Array;
    crc: number;
    offset: number;
  }> = [];

  const chunks: Uint8Array[] = [];
  let currentOffset = 0;

  // 1. 写入 Local File Headers 与 File Data
  for (const file of files) {
    const nameBytes = textEncoder.encode(file.name.replace(/\\/g, '/'));
    const dataBytes = typeof file.data === 'string' ? textEncoder.encode(file.data) : file.data;
    const crc = calculateCrc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);

    view.setUint32(0, 0x04034b50, true); // Local file header signature
    view.setUint16(4, 20, true);         // Version needed to extract (2.0)
    view.setUint16(6, 0x0800, true);     // General purpose bit flag (Bit 11 = UTF-8)
    view.setUint16(8, 0, true);          // Compression method (0 = Store)
    view.setUint16(10, 0, true);         // File last mod time
    view.setUint16(12, 0, true);         // File last mod date
    view.setUint32(14, crc, true);       // CRC-32
    view.setUint32(18, dataBytes.length, true); // Compressed size
    view.setUint32(22, dataBytes.length, true); // Uncompressed size
    view.setUint16(26, nameBytes.length, true); // File name length
    view.setUint16(28, 0, true);                // Extra field length

    localHeader.set(nameBytes, 30);

    chunks.push(localHeader);
    chunks.push(dataBytes);

    fileEntries.push({
      nameBytes,
      dataBytes,
      crc,
      offset: currentOffset,
    });

    currentOffset += localHeader.length + dataBytes.length;
  }

  const centralDirStartOffset = currentOffset;
  let centralDirSize = 0;

  // 2. 写入 Central Directory Headers
  for (const entry of fileEntries) {
    const cdHeader = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(cdHeader.buffer);

    view.setUint32(0, 0x02014b50, true); // Central file header signature
    view.setUint16(4, 20, true);         // Version made by
    view.setUint16(6, 20, true);         // Version needed to extract (2.0)
    view.setUint16(8, 0x0800, true);     // General purpose bit flag (UTF-8)
    view.setUint16(10, 0, true);         // Compression method (Store)
    view.setUint16(12, 0, true);         // File last mod time
    view.setUint16(14, 0, true);         // File last mod date
    view.setUint32(16, entry.crc, true); // CRC-32
    view.setUint32(20, entry.dataBytes.length, true); // Compressed size
    view.setUint32(24, entry.dataBytes.length, true); // Uncompressed size
    view.setUint16(28, entry.nameBytes.length, true); // File name length
    view.setUint16(30, 0, true);                      // Extra field length
    view.setUint16(32, 0, true);                      // File comment length
    view.setUint16(34, 0, true);                      // Disk number start
    view.setUint16(36, 0, true);                      // Internal file attributes
    view.setUint32(38, 0, true);                      // External file attributes
    view.setUint32(42, entry.offset, true);           // Relative offset of local header

    cdHeader.set(entry.nameBytes, 46);

    chunks.push(cdHeader);
    centralDirSize += cdHeader.length;
    currentOffset += cdHeader.length;
  }

  // 3. 写入 End of Central Directory Record (EOCD)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);

  eocdView.setUint32(0, 0x06054b50, true);         // EOCD signature
  eocdView.setUint16(4, 0, true);                  // Number of this disk
  eocdView.setUint16(6, 0, true);                  // Disk where central directory starts
  eocdView.setUint16(8, fileEntries.length, true); // Number of central directory records on this disk
  eocdView.setUint16(10, fileEntries.length, true);// Total number of central directory records
  eocdView.setUint32(12, centralDirSize, true);    // Size of central directory
  eocdView.setUint32(16, centralDirStartOffset, true); // Offset of start of central directory
  eocdView.setUint16(20, 0, true);                 // Comment length

  chunks.push(eocd);

  return new Blob(chunks as any[], { type: 'application/zip' });
}
