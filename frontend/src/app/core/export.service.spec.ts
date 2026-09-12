import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ProfileDetail, ProfileSummary } from './api.service';
import { ExportService, escapeCsvCell, profileCsv, profilesCsv } from './export.service';

const profile: ProfileDetail = {
  id: 5,
  domain_target: 'example.com',
  status: 'COMPLETED',
  created_at: '2026-01-01T00:00:00',
  technologies: [
    {
      category: 'server',
      name: 'nginx',
      version: '1.25',
      confidence: 'high',
      evidence: 'Server: nginx',
    },
    {
      category: 'framework',
      name: 'React',
      version: null,
      confidence: 'medium',
      evidence: 'root el',
    },
  ],
  routes: [{ path: '/admin', framework: 'react-router', route_type: 'guard', module: null }],
  js_dependencies: [
    { name: 'react', version: '19.0.0', source: 'bundle', package_manager: 'npm' },
  ],
};

const profiles: ProfileSummary[] = [
  { id: 1, domain_target: 'example.com', status: 'COMPLETED', created_at: '2026-01-01T00:00:00' },
];

describe('CSV builders', () => {
  it('should escape quotes, commas and newlines', () => {
    expect(escapeCsvCell('plain')).toBe('plain');
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell(null)).toBe('');
  });

  it('should build a flat profile CSV with technology/route/dependency records', () => {
    const csv = profileCsv(profile);
    const lines = csv.split('\n');

    expect(lines[0]).toContain('record_type,category,name');
    expect(lines).toHaveLength(5);
    expect(lines[1]).toContain('technology,server,nginx,1.25,high');
    expect(lines[2]).toContain('technology,framework,React');
    expect(lines[3]).toContain('route,,/admin');
    expect(lines[3]).toContain('guard,react-router');
    expect(lines[4]).toContain('dependency,,react,19.0.0');
    expect(lines[4]).toContain('npm,bundle');
  });

  it('should build a summary CSV for the history list', () => {
    const csv = profilesCsv(profiles);
    expect(csv.split('\n')).toHaveLength(2);
    expect(csv).toContain('1,example.com,COMPLETED');
  });
});

describe('ExportService downloads', () => {
  let service: ExportService;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clicks: number;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExportService);

    createObjectURL = vi.fn(() => 'blob:test');
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });

    clicks = 0;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      clicks += 1;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should download the profile JSON as a blob', async () => {
    service.downloadProfileJson(profile);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toContain('application/json');
    const payload = JSON.parse(await blob.text()) as ProfileDetail;
    expect(payload.domain_target).toBe('example.com');
    expect(clicks).toBe(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });

  it('should download the profile CSV as a blob', async () => {
    service.downloadProfileCsv(profile);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toContain('text/csv');
    expect(await blob.text()).toContain('nginx');
  });

  it('should gzip the profile for the BIN export', () => {
    service.downloadProfileBinary(profile);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/octet-stream');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should download the profile list as JSON and CSV', () => {
    service.downloadProfilesJson(profiles);
    service.downloadProfilesCsv(profiles);
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(clicks).toBe(2);
  });
});
