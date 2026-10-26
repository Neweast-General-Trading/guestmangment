import { inflateRawSync } from "node:zlib";

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;

export function unzipTextFiles(buf: Buffer): Map<string, string> {
  const files = new Map<string, string>();
  let offset = 0;
  while (offset + 30 <= buf.length) {
    const sig = buf.readUInt32LE(offset);
    if (sig === CENTRAL) break;
    if (sig !== LOCAL) {
      offset += 1;
      continue;
    }
    const flags = buf.readUInt16LE(offset + 6);
    const method = buf.readUInt16LE(offset + 8);
    let compSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const name = buf.subarray(offset + 30, offset + 30 + nameLen).toString("utf8");
    const dataStart = offset + 30 + nameLen + extraLen;
    if (flags & 0x8 && compSize === 0) {
      const desc = buf.indexOf(Buffer.from([0x50, 0x4b, 0x07, 0x08]), dataStart);
      if (desc < 0) break;
      compSize = desc - dataStart;
      const raw = inflateEntry(buf.subarray(dataStart, desc), method);
      if (raw) files.set(name, raw.toString("utf8"));
      offset = desc + 16;
      continue;
    }
    const raw = inflateEntry(buf.subarray(dataStart, dataStart + compSize), method);
    if (raw) files.set(name, raw.toString("utf8"));
    offset = dataStart + compSize;
  }
  return files;
}

function inflateEntry(data: Buffer, method: number) {
  if (!data.length && method !== 0) return Buffer.alloc(0);
  if (method === 0) return Buffer.from(data);
  if (method === 8) return inflateRawSync(data);
  return null;
}
