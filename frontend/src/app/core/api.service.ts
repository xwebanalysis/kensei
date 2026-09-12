import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface HealthResponse {
  status: string;
  database: string;
  version: string;
  tool: string;
}

export interface Technology {
  category: string;
  name: string;
  version: string | null;
  confidence: string;
  evidence: string;
}

export interface DiscoveredRoute {
  path: string;
  framework: string | null;
  route_type: string | null;
  module: string | null;
}

export interface JsDependency {
  name: string;
  version: string | null;
  source: string | null;
  package_manager: string | null;
}

export interface ProfileSummary {
  id: number;
  domain_target: string;
  status: string;
  created_at: string;
}

export interface ProfileDetail extends ProfileSummary {
  technologies: Technology[];
  routes: DiscoveredRoute[];
  js_dependencies: JsDependency[];
}

export interface ProfileReport {
  domain: string;
  profile_id: number;
  created_at: string;
  summary: {
    technologies_found: number;
    routes_discovered: number;
    guards_detected: number;
    js_dependencies_found: number;
    categories: string[];
  };
  technologies_by_category: Record<string, Array<Pick<Technology, 'name' | 'version' | 'confidence'>>>;
  outdated_technologies?: Array<Pick<Technology, 'name' | 'version' | 'evidence'>>;
}

export interface CompareResult {
  profiles: Array<{
    profile_id: number;
    domain: string;
    created_at: string;
    technology_count: number;
    technologies: string[];
  }>;
  changes: Array<{
    from_profile: number;
    to_profile: number;
    added: string[];
    removed: string[];
  }>;
}

export interface TrendPoint {
  profile_id: number;
  created_at: string;
  technologies: number;
  routes: number;
  guards: number;
  js_dependencies: number;
}

export interface TrendsResult {
  domain: string;
  points: TrendPoint[];
}

export interface VersionDb {
  [lib: string]: { latest: string; all: string[] };
}

export interface DeleteResult {
  status: string;
  profile_id?: number;
  count?: number;
}

/** Central typed client for the Kensei REST + WebSocket API. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly apiBaseUrl = environment.apiBaseUrl;
  readonly wsBaseUrl = environment.wsBaseUrl;

  health(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.apiBaseUrl}/api/health`);
  }

  listProfiles(): Observable<ProfileSummary[]> {
    return this.http.get<ProfileSummary[]>(`${this.apiBaseUrl}/api/profiles`);
  }

  getProfile(id: number): Observable<ProfileDetail> {
    return this.http.get<ProfileDetail>(`${this.apiBaseUrl}/api/profiles/${id}`);
  }

  deleteProfile(id: number): Observable<DeleteResult> {
    return this.http.delete<DeleteResult>(`${this.apiBaseUrl}/api/profiles/${id}`);
  }

  deleteAllProfiles(): Observable<DeleteResult> {
    return this.http.delete<DeleteResult>(`${this.apiBaseUrl}/api/profiles`);
  }

  report(id: number): Observable<ProfileReport> {
    return this.http.get<ProfileReport>(`${this.apiBaseUrl}/api/profiles/${id}/report`);
  }

  compare(ids: number[]): Observable<CompareResult> {
    return this.http.get<CompareResult>(
      `${this.apiBaseUrl}/api/profiles/compare?ids=${ids.join(',')}`,
    );
  }

  trends(domain: string): Observable<TrendsResult> {
    return this.http.get<TrendsResult>(
      `${this.apiBaseUrl}/api/profiles/trends?domain=${encodeURIComponent(domain)}`,
    );
  }

  versionDb(): Observable<VersionDb> {
    return this.http.get<VersionDb>(`${this.apiBaseUrl}/api/version-db`);
  }

  /** Server-side export URL (attachment served by the backend). */
  exportJsonUrl(id: number): string {
    return `${this.apiBaseUrl}/api/profiles/${id}/export/json`;
  }

  /** WebSocket URL for the live profiler (adds the optional auth token). */
  liveUrl(target: string, timeout = 180): string {
    const params = new URLSearchParams({ target, timeout: String(timeout) });
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('kensei_token') : null;
    if (token) {
      params.set('token', token);
    }
    return `${this.wsBaseUrl}/api/profile/live?${params.toString()}`;
  }
}
