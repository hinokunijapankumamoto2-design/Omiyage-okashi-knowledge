import { gunzipSync } from 'node:zlib';

/**
 * Minimal reader for the ustar entries inside an npm .tgz.
 *
 * npm publishes plain gzipped ustar archives, so a full tar library would be a
 * dependency bought for nothing. This reads only what the artifact scanner
 * needs: regular-file paths and their bytes.
 */
export interface TarEntry {
  path: string;
  size: number;
  text: string;
}

export interface ExtractLimits {
  maxEntries: number;
  maxFileBytes: number;
  /** Only these extensions are read; everything else is listed but not decoded. */
  readExtensions: string[];
}

/**
 * Risk priority for the scan budget. An archive can easily hold more files
 * than the cap, and reading translation files while skipping the install
 * script would make the scan look thorough while missing the only thing that
 * mattered. Lower sorts first.
 */
export function riskPriority(path: string): number {
  const p = path.toLowerCase();
  if (/(^|\/)(package\.json)$/.test(p)) return 0;
  if (/\.(sh|bash)$/.test(p)) return 1;
  if (/(^|\/)(scripts?|bin|install|postinstall|setup)(\/|\.)/.test(p)) return 1;
  if (/(^|\/)(locales?|i18n|fixtures?|__snapshots__|docs?)\//.test(p)) return 5;
  if (/\.(js|mjs|cjs|ts)$/.test(p)) return 2;
  if (/\.(ya?ml)$/.test(p)) return 3;
  return 4;
}

export interface ExtractResult {
  /** Every regular-file path in the archive, whether or not its bytes were read. */
  paths: string[];
  entries: TarEntry[];
  truncated: boolean;
}

const BLOCK = 512;

export function extractTgz(buf: Buffer, limits: ExtractLimits): ExtractResult {
  const tar = gunzipSync(buf);
  const paths: string[] = [];
  const candidates: TarEntry[] = [];
  let offset = 0;

  while (offset + BLOCK <= tar.length) {
    const header = tar.subarray(offset, offset + BLOCK);
    // Two consecutive zero blocks terminate the archive.
    if (header.every((b) => b === 0)) break;

    const name = cstr(header.subarray(0, 100));
    const prefix = cstr(header.subarray(345, 500));
    const sizeField = cstr(header.subarray(124, 136)).trim();
    const size = parseInt(sizeField, 8);
    const typeflag = String.fromCharCode(header[156] ?? 0);

    if (!Number.isFinite(size) || size < 0) break;

    const fullPath = prefix ? `${prefix}/${name}` : name;
    const dataStart = offset + BLOCK;
    const dataEnd = dataStart + size;
    if (dataEnd > tar.length) break;

    // '0' and '\0' are regular files; everything else (dirs, links, pax
    // headers) is skipped.
    if (typeflag === '0' || typeflag === '\0') {
      paths.push(fullPath);
      const ext = extensionOf(fullPath);
      if (size <= limits.maxFileBytes && limits.readExtensions.includes(ext)) {
        candidates.push({ path: fullPath, size, text: tar.subarray(dataStart, dataEnd).toString('utf8') });
      }
    }

    offset = dataStart + Math.ceil(size / BLOCK) * BLOCK;
  }

  // Spend the scan budget on the files most likely to carry risk, not on
  // whichever files happened to come first in the archive.
  candidates.sort((a, b) => riskPriority(a.path) - riskPriority(b.path) || a.path.localeCompare(b.path));
  const entries = candidates.slice(0, limits.maxEntries);

  return { paths, entries, truncated: candidates.length > entries.length };
}

function cstr(b: Buffer): string {
  const end = b.indexOf(0);
  return b.subarray(0, end === -1 ? b.length : end).toString('utf8');
}

export function extensionOf(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot <= 0 ? '' : base.slice(dot).toLowerCase();
}
