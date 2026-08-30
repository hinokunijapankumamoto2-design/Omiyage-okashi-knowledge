import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Project root, resolved from this file's location (dist/src/util -> project root). */
export function projectRoot(): string {
  return resolve(here, '..', '..', '..');
}

export function dataPath(...parts: string[]): string {
  return resolve(projectRoot(), 'data', ...parts);
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function writeFileEnsured(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, 'utf8');
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
