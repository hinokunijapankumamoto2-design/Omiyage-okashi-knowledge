import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Package Validator.
 *
 * Checks that a generated directory is actually a well-formed Claude Code
 * plugin, not just a folder full of markdown. Structural checks only - it does
 * not claim the plugin is *good*, only that it is loadable.
 */

export interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
}

export interface PackageValidation {
  ok: boolean;
  issues: ValidationIssue[];
  checked: string[];
}

export function validatePluginPackage(dir: string): PackageValidation {
  const issues: ValidationIssue[] = [];
  const checked: string[] = [];
  const err = (message: string) => issues.push({ severity: 'error', message });
  const warn = (message: string) => issues.push({ severity: 'warning', message });

  if (!existsSync(dir)) {
    return { ok: false, issues: [{ severity: 'error', message: `Plugin directory does not exist: ${dir}` }], checked };
  }

  const manifestPath = resolve(dir, '.claude-plugin', 'plugin.json');
  checked.push('.claude-plugin/plugin.json');
  if (!existsSync(manifestPath)) {
    err('Missing .claude-plugin/plugin.json');
  } else {
    let manifest: Record<string, unknown> | null = null;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    } catch (e) {
      err(`plugin.json is not valid JSON: ${(e as Error).message}`);
    }
    if (manifest) {
      if (typeof manifest.name !== 'string' || manifest.name.length === 0) {
        err('plugin.json is missing the required "name" field.');
      } else if (!/^[a-z0-9][a-z0-9-]*$/.test(manifest.name)) {
        err(`plugin.json "name" must be lowercase kebab-case, got "${String(manifest.name)}".`);
      }
      for (const key of ['agents', 'commands'] as const) {
        const v = manifest[key];
        if (v === undefined) continue;
        const paths = Array.isArray(v) ? v : [v];
        for (const p of paths) {
          if (typeof p !== 'string' || !p.startsWith('./')) {
            err(`plugin.json "${key}" path must be relative and start with "./", got ${JSON.stringify(p)}.`);
          } else if (!existsSync(resolve(dir, p))) {
            err(`plugin.json "${key}" points at a missing path: ${p}`);
          }
        }
      }
      const hooks = manifest.hooks;
      if (typeof hooks === 'string' && !existsSync(resolve(dir, hooks))) {
        err(`plugin.json "hooks" points at a missing file: ${hooks}`);
      }
    }
  }

  const skillsDir = resolve(dir, 'skills');
  if (existsSync(skillsDir)) {
    for (const name of readdirSync(skillsDir)) {
      const skillDir = resolve(skillsDir, name);
      if (!statSync(skillDir).isDirectory()) continue;
      const skillFile = resolve(skillDir, 'SKILL.md');
      checked.push(`skills/${name}/SKILL.md`);
      if (!existsSync(skillFile)) {
        err(`skills/${name} has no SKILL.md`);
        continue;
      }
      const fm = parseFrontmatter(readFileSync(skillFile, 'utf8'));
      if (!fm) {
        err(`skills/${name}/SKILL.md has no YAML frontmatter block.`);
        continue;
      }
      if (!fm.name) err(`skills/${name}/SKILL.md frontmatter is missing "name".`);
      else if (fm.name !== name) {
        err(`skills/${name}/SKILL.md declares name "${fm.name}", which does not match its directory.`);
      }
      if (!fm.description) err(`skills/${name}/SKILL.md frontmatter is missing "description".`);
      else if (fm.description.length < 20) {
        warn(`skills/${name}/SKILL.md description is very short; the model uses it to decide when to load the skill.`);
      }
    }
  } else {
    warn('No skills/ directory. A plugin with no skills, agents or commands does nothing.');
  }

  const agentsDir = resolve(dir, 'agents');
  if (existsSync(agentsDir)) {
    for (const file of readdirSync(agentsDir)) {
      if (!file.endsWith('.md')) continue;
      checked.push(`agents/${file}`);
      const fm = parseFrontmatter(readFileSync(resolve(agentsDir, file), 'utf8'));
      if (!fm) {
        err(`agents/${file} has no YAML frontmatter block.`);
        continue;
      }
      if (!fm.description) err(`agents/${file} frontmatter is missing "description".`);
    }
  }

  const hooksFile = resolve(dir, 'hooks', 'hooks.json');
  if (existsSync(hooksFile)) {
    checked.push('hooks/hooks.json');
    try {
      const parsed = JSON.parse(readFileSync(hooksFile, 'utf8')) as { hooks?: unknown };
      if (parsed.hooks === undefined) err('hooks/hooks.json has no "hooks" key.');
    } catch (e) {
      err(`hooks/hooks.json is not valid JSON: ${(e as Error).message}`);
    }
  }

  for (const required of ['PROVENANCE.md', 'README.md', 'capability-manifest.json']) {
    checked.push(required);
    if (!existsSync(resolve(dir, required))) err(`Missing ${required}`);
  }

  const provenancePath = resolve(dir, 'PROVENANCE.md');
  if (existsSync(provenancePath)) {
    const text = readFileSync(provenancePath, 'utf8');
    if (!/reused code/i.test(text)) {
      err('PROVENANCE.md does not state a "Reused code" position.');
    }
  }

  return { ok: !issues.some((i) => i.severity === 'error'), issues, checked };
}

/** Minimal frontmatter reader: enough for `name:` and `description:`. */
function parseFrontmatter(text: string): { name?: string; description?: string } | null {
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return null;
  const block = text.slice(3, end);
  const out: { name?: string; description?: string } = {};
  for (const line of block.split('\n')) {
    const m = /^(name|description)\s*:\s*(.*)$/.exec(line.trim());
    if (!m || !m[1]) continue;
    const value = (m[2] ?? '').trim().replace(/^["']|["']$/g, '');
    if (m[1] === 'name') out.name = value;
    else out.description = value;
  }
  return out;
}
