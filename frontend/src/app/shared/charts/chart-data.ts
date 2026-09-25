import type { ProfileSummary, Technology } from '../../core/api.service';
import type { XwaChartColorKey, XwaChartDatum } from './xwa-chart.component';

/** Confidence colors follow the app-wide severity-tag convention. */
const CONFIDENCE_COLORS: Record<string, XwaChartColorKey> = {
  high: 'success',
  medium: 'warning',
  low: 'critical',
};

/** Technology inventory grouped by category (descending count). */
export function technologyCategoryData(technologies: Technology[]): XwaChartDatum[] {
  const counts = new Map<string, number>();
  for (const tech of technologies ?? []) {
    const key = (tech.category || 'unknown').toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value }));
}

/** Detection confidence distribution (high/medium/low) for a donut. */
export function detectionConfidenceData(technologies: Technology[]): XwaChartDatum[] {
  const order = ['high', 'medium', 'low'];
  const counts = new Map<string, number>();
  for (const tech of technologies ?? []) {
    const key = (tech.confidence ?? '').toLowerCase();
    if (counts.has(key) || order.includes(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return order
    .filter((key) => (counts.get(key) ?? 0) > 0)
    .map((key) => ({ label: key, value: counts.get(key) ?? 0, color: CONFIDENCE_COLORS[key] }));
}

/** Profiles per calendar day (chronological labels), for a line chart. */
export function profilesPerDayData(profiles: ProfileSummary[]): XwaChartDatum[] {
  const byDay = new Map<string, number>();
  for (const profile of profiles ?? []) {
    const day = String(profile.created_at ?? '').slice(0, 10) || 'UNKNOWN';
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value }));
}

/** Profile status distribution (COMPLETED/RUNNING/ERROR/...) for a donut. */
export function profileStatusData(profiles: ProfileSummary[]): XwaChartDatum[] {
  const counts = new Map<string, number>();
  for (const profile of profiles ?? []) {
    const key = String(profile.status ?? 'UNKNOWN').toUpperCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value, color: statusColorKey(label) }));
}

function statusColorKey(status: string): XwaChartColorKey {
  if (status === 'COMPLETED') return 'success';
  if (status === 'RUNNING' || status === 'PENDING') return 'warning';
  if (status === 'ERROR' || status === 'CANCELLED' || status === 'FAILED') return 'critical';
  return 'neutral-strong';
}
