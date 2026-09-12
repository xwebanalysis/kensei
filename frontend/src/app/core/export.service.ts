import { Injectable } from '@angular/core';
import { gzip } from 'pako';

import { ProfileDetail, ProfileSummary, Technology } from './api.service';

/** Escape a CSV cell (quotes/commas/newlines). */
export function escapeCsvCell(value: string | number | null | undefined): string {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Client-side profile CSV: one record per technology/route/dependency so the
 * file stays flat and spreadsheet-friendly.
 */
export function profileCsv(profile: ProfileDetail): string {
  const header = [
    'record_type',
    'category',
    'name',
    'version',
    'confidence',
    'evidence',
    'path',
    'route_type',
    'framework',
    'module',
    'package_manager',
    'source',
  ];
  const rows: Array<Array<string | number | null>> = [header];

  for (const tech of profile.technologies) {
    rows.push([
      'technology',
      tech.category,
      tech.name,
      tech.version,
      tech.confidence,
      tech.evidence,
    ]);
  }
  for (const route of profile.routes) {
    rows.push([
      'route',
      '',
      route.path,
      '',
      '',
      '',
      route.path,
      route.route_type,
      route.framework,
      route.module,
    ]);
  }
  for (const dep of profile.js_dependencies) {
    rows.push([
      'dependency',
      '',
      dep.name,
      dep.version,
      '',
      '',
      '',
      '',
      '',
      '',
      dep.package_manager,
      dep.source,
    ]);
  }

  return rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')).join('\n');
}

/** Client-side CSV for the history list. */
export function profilesCsv(profiles: ProfileSummary[]): string {
  const rows: Array<Array<string | number | null>> = [
    ['id', 'domain_target', 'status', 'created_at'],
    ...profiles.map((profile) => [
      profile.id,
      profile.domain_target,
      profile.status,
      profile.created_at,
    ]),
  ];
  return rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')).join('\n');
}

/**
 * Client-side exports (JSON/CSV/PDF/BIN). The PDF dependency is imported
 * lazily so the initial bundle stays lean and unit tests never load jsPDF.
 */
@Injectable({ providedIn: 'root' })
export class ExportService {
  downloadProfileJson(profile: ProfileDetail): void {
    const payload = JSON.stringify(profile, null, 2);
    this.download(
      new Blob([payload], { type: 'application/json;charset=utf-8' }),
      `${profile.domain_target}-profile-${profile.id}.json`,
    );
  }

  downloadProfileCsv(profile: ProfileDetail): void {
    this.download(
      new Blob([profileCsv(profile)], { type: 'text/csv;charset=utf-8' }),
      `${profile.domain_target}-profile-${profile.id}.csv`,
    );
  }

  downloadProfileBinary(profile: ProfileDetail): void {
    const bytes = gzip(JSON.stringify(profile));
    this.download(
      new Blob([bytes as unknown as BlobPart], { type: 'application/octet-stream' }),
      `${profile.domain_target}-profile-${profile.id}.bin`,
    );
  }

  async downloadProfilePdf(profile: ProfileDetail): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const margin = 40;
    let y = margin;

    const line = (text: string, size = 9, bold = false, gap = 13): void => {
      doc.setFont('courier', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      const wrapped = doc.splitTextToSize(text, 595 - margin * 2) as string[];
      for (const chunk of wrapped) {
        if (y > 800) {
          doc.addPage();
          y = margin;
        }
        doc.text(chunk, margin, y);
        y += gap;
      }
    };

    line('KENSEI / TECHNOLOGY PROFILE', 15, true, 20);
    line(`TARGET:  ${profile.domain_target}`, 10, true);
    line(`ID:      ${profile.id}`);
    line(`STATUS:  ${profile.status}`);
    line(`CREATED: ${profile.created_at}`);
    y += 8;

    line('SUMMARY', 11, true);
    line(`TECHNOLOGIES:   ${profile.technologies.length}`);
    line(`ROUTES:         ${profile.routes.length}`);
    line(`JS DEPENDENCIES: ${profile.js_dependencies.length}`);
    y += 8;

    line('TECHNOLOGIES', 11, true);
    for (const tech of profile.technologies) {
      line(this.techLine(tech));
      if (tech.evidence) {
        line(`  ${tech.evidence}`, 8, false, 11);
      }
    }

    if (profile.routes.length) {
      y += 8;
      line('ROUTES', 11, true);
      for (const route of profile.routes) {
        line(
          `- ${route.path} [${(route.route_type ?? 'route').toUpperCase()}]` +
            `${route.framework ? ` · ${route.framework}` : ''}` +
            `${route.module ? ` · ${route.module}` : ''}`,
        );
      }
    }

    if (profile.js_dependencies.length) {
      y += 8;
      line('JS DEPENDENCIES', 11, true);
      for (const dep of profile.js_dependencies) {
        line(
          `- ${dep.name}${dep.version ? ` v${dep.version}` : ''}` +
            `${dep.package_manager ? ` · ${dep.package_manager}` : ''}`,
        );
      }
    }

    doc.save(`${profile.domain_target}-profile-${profile.id}.pdf`);
  }

  downloadProfilesJson(profiles: ProfileSummary[]): void {
    this.download(
      new Blob([JSON.stringify(profiles, null, 2)], { type: 'application/json;charset=utf-8' }),
      'kensei-profiles.json',
    );
  }

  downloadProfilesCsv(profiles: ProfileSummary[]): void {
    this.download(
      new Blob([profilesCsv(profiles)], { type: 'text/csv;charset=utf-8' }),
      'kensei-profiles.csv',
    );
  }

  private techLine(tech: Technology): string {
    return (
      `- ${tech.name}${tech.version ? ` v${tech.version}` : ''}` +
      ` [${(tech.confidence || 'unknown').toUpperCase()}] ${tech.category}`
    );
  }

  private download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
}
