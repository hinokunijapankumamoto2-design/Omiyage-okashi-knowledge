import { dataPath, readJson } from '../util/io.js';
import type { CapabilityCategory, Relation } from '../types.js';

export interface TaxonomyEntry {
  id: string;
  name: string;
  category: CapabilityCategory;
  description: string;
  aliases: string[];
}

export interface GoalArchetype {
  id: string;
  description: string;
  match: string[];
  required: string[];
  optional: string[];
  rationale: string;
}

interface TaxonomyFile {
  version: string;
  capabilities: TaxonomyEntry[];
  relations: Relation[];
  goalArchetypes: GoalArchetype[];
}

let cached: TaxonomyFile | null = null;

export function loadTaxonomy(): TaxonomyFile {
  if (!cached) cached = readJson<TaxonomyFile>(dataPath('capability-registry.json'));
  return cached;
}

export function capabilityById(id: string): TaxonomyEntry | undefined {
  return loadTaxonomy().capabilities.find((c) => c.id === id);
}

export function capabilityName(id: string): string {
  return capabilityById(id)?.name ?? id;
}

export function allCapabilityIds(): string[] {
  return loadTaxonomy().capabilities.map((c) => c.id);
}

export function relations(): Relation[] {
  return loadTaxonomy().relations;
}

export function goalArchetypes(): GoalArchetype[] {
  return loadTaxonomy().goalArchetypes ?? [];
}
