import type { HealthAssessment, RepositoryProfile } from '../types.js';

/**
 * Health Engine.
 *
 * Returns `null` rather than a number when there is not enough signal. A
 * fabricated health score is worse than an honest UNKNOWN.
 */
export function assessHealth(repo: RepositoryProfile, now = new Date()): HealthAssessment {
  const signals: string[] = [];
  const unknowns: string[] = [];
  let points = 0;
  let possible = 0;

  possible += 2;
  if (repo.lastMeaningfulUpdate === 'UNKNOWN') {
    unknowns.push('Last meaningful update is unknown.');
    possible -= 2;
  } else if (Number.isNaN(Date.parse(repo.lastMeaningfulUpdate))) {
    unknowns.push(`Last meaningful update "${repo.lastMeaningfulUpdate}" is not a parseable date; treated as unknown rather than as a number.`);
    possible -= 2;
  } else {
    const days = daysBetween(new Date(repo.lastMeaningfulUpdate), now);
    if (days <= 90) {
      points += 2;
      signals.push(`Updated ${days} day(s) ago.`);
    } else if (days <= 365) {
      points += 1;
      signals.push(`Updated ${days} day(s) ago - slowing.`);
    } else {
      signals.push(`No meaningful update for ${days} day(s).`);
    }
  }

  possible += 1;
  if (repo.latestRelease === 'UNKNOWN') {
    unknowns.push('No release information observed.');
    possible -= 1;
  } else {
    points += 1;
    signals.push(`Latest release: ${repo.latestRelease}.`);
  }

  possible += 1;
  if (repo.tests === 'UNKNOWN') {
    unknowns.push('Presence of tests is unknown.');
    possible -= 1;
  } else if (repo.tests === 'PRESENT') {
    points += 1;
    signals.push('Tests present.');
  } else {
    signals.push('No tests found.');
  }

  possible += 1;
  if (repo.documentation === 'UNKNOWN') {
    unknowns.push('Presence of documentation is unknown.');
    possible -= 1;
  } else if (repo.documentation === 'PRESENT') {
    points += 1;
    signals.push('Documentation present.');
  } else {
    signals.push('No documentation found.');
  }

  // Fewer than two usable signals is not a health assessment, it is a guess.
  const score = possible >= 2 ? round1((points / possible) * 5) : null;
  if (score === null) unknowns.push('Too few signals to produce a health score.');

  return {
    score,
    lastMeaningfulUpdate: repo.lastMeaningfulUpdate,
    releaseCadence: repo.latestRelease === 'UNKNOWN' ? 'UNKNOWN' : 'observed-single-release',
    signals,
    unknowns,
  };
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
