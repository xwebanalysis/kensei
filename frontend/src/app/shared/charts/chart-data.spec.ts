import { describe, expect, it } from 'vitest';

import { ProfileSummary, Technology } from '../../core/api.service';
import {
  detectionConfidenceData,
  profilesPerDayData,
  profileStatusData,
  technologyCategoryData,
} from './chart-data';

const techs: Technology[] = [
  { category: 'frontend', name: 'angular', version: '22', confidence: 'high', evidence: '' },
  { category: 'backend', name: 'nginx', version: null, confidence: 'medium', evidence: '' },
  { category: 'frontend', name: 'rxjs', version: '7', confidence: 'low', evidence: '' },
  { category: 'cdn', name: 'cloudflare', version: null, confidence: 'high', evidence: '' },
];

describe('chart-data builders', () => {
  it('groups technologies by category, most common first', () => {
    const data = technologyCategoryData(techs);
    expect(data).toEqual([
      { label: 'frontend', value: 2 },
      { label: 'backend', value: 1 },
      { label: 'cdn', value: 1 },
    ]);
  });

  it('builds the confidence donut in high/medium/low order', () => {
    expect(detectionConfidenceData(techs)).toEqual([
      { label: 'high', value: 2, color: 'success' },
      { label: 'medium', value: 1, color: 'warning' },
      { label: 'low', value: 1, color: 'critical' },
    ]);
  });

  it('counts profiles per day chronologically', () => {
    const profiles: ProfileSummary[] = [
      { id: 2, domain_target: 'b.com', status: 'COMPLETED', created_at: '2026-09-02T10:00:00' },
      { id: 1, domain_target: 'a.com', status: 'RUNNING', created_at: '2026-09-01T09:00:00' },
      { id: 3, domain_target: 'c.com', status: 'COMPLETED', created_at: '2026-09-02T11:00:00' },
    ];
    expect(profilesPerDayData(profiles)).toEqual([
      { label: '2026-09-01', value: 1 },
      { label: '2026-09-02', value: 2 },
    ]);
  });

  it('maps statuses to colors', () => {
    const profiles: ProfileSummary[] = [
      { id: 1, domain_target: 'a.com', status: 'COMPLETED', created_at: '2026-09-01T09:00:00' },
      { id: 2, domain_target: 'b.com', status: 'ERROR', created_at: '2026-09-02T09:00:00' },
    ];
    expect(profileStatusData(profiles)).toEqual([
      { label: 'COMPLETED', value: 1, color: 'success' },
      { label: 'ERROR', value: 1, color: 'critical' },
    ]);
  });
});
