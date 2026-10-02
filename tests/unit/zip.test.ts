import { describe, it, expect } from 'vitest';
import { createZipArchive, type ZipFileInput } from '../../src/utils/zip';

describe('zip utility', () => {
  it('should generate a valid zip Blob with PK signatures', async () => {
    const files: ZipFileInput[] = [
      {
        name: 'hello.txt',
        data: 'Hello, world!',
      },
      {
        name: 'folder/sub.txt',
        data: new TextEncoder().encode('Binary content'),
      },
    ];

    const blob = createZipArchive(files);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/zip');
    expect(blob.size).toBeGreaterThan(0);

    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Verify Local File Header signature (0x04034b50 -> 'P', 'K', 0x03, 0x04)
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
  });

  it('should handle empty file lists gracefully', () => {
    const blob = createZipArchive([]);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBe(22); // Empty ZIP EOCD header size is exactly 22 bytes
  });
});
