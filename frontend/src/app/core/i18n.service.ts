import { Injectable, signal } from '@angular/core';

export type Locale = 'en' | 'es';
export type TranslationParams = Record<string, string | number>;

const TRANSLATIONS: Record<Locale, Record<string, string>> = {
  en: {
    // Shell
    'app.title': 'KENSEI',
    'app.tagline': 'XWA - MODULE',
    'app.version': 'V. 0.2.0',
    'nav.profiler': '01 // PROFILER',
    'nav.jsAnalysis': '02 // JS ANALYSIS',
    'nav.spaRoutes': '03 // SPA ROUTES',
    'nav.history': '04 // HISTORY & ARCHIVE',
    'nav.inventory': '05 // INVENTORY',
    'aria.mainNavigation': 'Main navigation',
    'aria.primaryContent': 'Primary content',
    // Common
    'common.loading': 'LOADING...',
    'common.select': '— SELECT —',
    'common.noData': '[ NO DATA ]',
    'action.yes': 'YES',
    'action.no': 'NO',
    // Profiler
    'profiler.title': 'PROFILER',
    'profiler.subtitle': 'WEB TECHNOLOGY STACK PROFILER',
    'profiler.statusScanning': 'SCANNING...',
    'profiler.statusComplete': 'COMPLETE',
    'profiler.statusError': 'ERROR',
    'profiler.statusReady': 'MODULE READY',
    'profiler.scan': 'SCAN',
    'profiler.scanning': 'SCANNING...',
    'profiler.phases': 'PHASES',
    'profiler.phase': 'PHASE',
    'profiler.inProgress': '[ IN PROGRESS ]',
    'profiler.done': '[ DONE ]',
    'profiler.liveResults': 'LIVE RESULTS',
    'profiler.liveLog': 'LIVE LOG',
    'profiler.noEvents': '[ NO EVENTS YET ]',
    'profiler.target': 'TARGET',
    'profiler.technologies': 'TECHNOLOGIES',
    'profiler.routes': 'ROUTES',
    'profiler.guards': 'GUARDS',
    'profiler.jsDeps': 'JS DEPS',
    'profiler.report': 'REPORT',
    'profiler.outdated': 'OUTDATED',
    'profiler.authGuards': 'AUTH GUARDS',
    'profiler.jsDependencies': 'JS DEPENDENCIES',
    'profiler.viewAll': 'VIEW ALL PROFILES →',
    'profiler.wsError': 'WebSocket connection failed. Is the backend on {url}?',
    'profiler.closedError': 'Connection closed unexpectedly.',
    'profiler.reportError': 'Failed to load profile report.',
    // JS analysis
    'js.title': 'JS ANALYSIS',
    'js.subtitle': 'JAVASCRIPT BUNDLE DEPENDENCIES',
    'js.profile': 'PROFILE',
    'js.dependencies': '{count} DEPENDENCIES',
    'js.empty': '[ NO JS DEPENDENCIES FOUND ]',
    'js.knownVersions': 'KNOWN LIBRARY VERSIONS',
    'js.latest': 'LATEST: {version}',
    'js.loadError': 'Failed to load.',
    // SPA routes
    'spa.title': 'SPA ROUTES',
    'spa.subtitle': 'ANGULAR, REACT, VUE ROUTE DISCOVERY',
    'spa.summary': '{routes} ROUTES · {guards} GUARDS',
    'spa.empty': '[ NO ROUTES DISCOVERED ]',
    'spa.routeMap': 'ROUTE MAP',
    'spa.authGuards': 'AUTH GUARDS',
    'spa.unknown': 'UNKNOWN',
    // History
    'history.title': 'HISTORY & ARCHIVE',
    'history.subtitle': 'BROWSE PAST PROFILES',
    'history.deleteAll': 'DELETE ALL',
    'history.deleting': 'DELETING...',
    'history.confirmAll': '[ CONFIRM DELETE ALL? ]',
    'history.compare': 'COMPARE SELECTED',
    'history.comparing': 'COMPARING...',
    'history.empty': '[ NO PROFILES YET — RUN A SCAN FROM THE PROFILER TAB ]',
    'history.delete': 'DELETE',
    'history.confirm': '[ CONFIRM? ]',
    'history.compareResults': 'COMPARE RESULTS',
    'history.change': 'PROFILE {from} → PROFILE {to}',
    'history.added': 'ADDED',
    'history.removed': 'REMOVED',
    'history.noChanges': '[ NO CHANGES DETECTED ]',
    'history.trendsTitle': 'HISTORICAL TRENDS',
    'history.trendsSubtitle': 'TECHNOLOGY EVOLUTION OVER TIME',
    'history.domain': 'DOMAIN',
    'history.loadTrends': 'LOAD TRENDS',
    'history.profilesCount': '{count} PROFILE(S)',
    'history.exportList': 'EXPORT LIST',
    'history.profilesError': 'Failed to load profiles.',
    'history.compareError': 'Compare failed.',
    'history.deleteAllError': 'Failed to delete all profiles.',
    'history.trendsError': 'Trends failed.',
    // Charts (shared xwa-chart)
    'charts.techCategories': 'TECHNOLOGY BY CATEGORY',
    'charts.confidence': 'DETECTION CONFIDENCE',
    'charts.profilesPerDay': 'PROFILES PER DAY',
    'charts.status': 'PROFILE STATUS',
    'charts.trends': 'TECHNOLOGY TREND',
    'charts.latestProfile': 'LATEST PROFILE: {domain} (ID {id})',
    // Inventory
    'inv.title': 'INVENTORY',
    'inv.subtitle': 'FULL TECHNOLOGY STACK REPORT',
    'inv.profile': 'PROFILE',
    'inv.technologies': 'TECHNOLOGIES',
    'inv.routes': 'ROUTES',
    'inv.dependencies': 'JS DEPENDENCIES',
    'inv.detailsError': 'Failed to load profile details.',
    // Export actions (shared)
    'export.client': 'CLIENT',
    'export.server': 'SERVER',
    'export.pdfBusy': 'PDF...',
    'export.error': '[ ERROR: PDF EXPORT FAILED ]',
    'export.saved': '[ EXPORTED ]',
  },
  es: {
    // Shell
    'app.title': 'KENSEI',
    'app.tagline': 'XWA - MODULO',
    'app.version': 'V. 0.2.0',
    'nav.profiler': '01 // PERFILADOR',
    'nav.jsAnalysis': '02 // ANALISIS JS',
    'nav.spaRoutes': '03 // RUTAS SPA',
    'nav.history': '04 // HISTORIAL Y ARCHIVO',
    'nav.inventory': '05 // INVENTARIO',
    'aria.mainNavigation': 'Navegacion principal',
    'aria.primaryContent': 'Contenido principal',
    // Common
    'common.loading': 'CARGANDO...',
    'common.select': '— SELECCIONAR —',
    'common.noData': '[ SIN DATOS ]',
    'action.yes': 'SI',
    'action.no': 'NO',
    // Profiler
    'profiler.title': 'PERFILADOR',
    'profiler.subtitle': 'PERFILADOR DE STACK TECNOLOGICO WEB',
    'profiler.statusScanning': 'ESCANEANDO...',
    'profiler.statusComplete': 'COMPLETO',
    'profiler.statusError': 'ERROR',
    'profiler.statusReady': 'MODULO LISTO',
    'profiler.scan': 'ESCANEAR',
    'profiler.scanning': 'ESCANEANDO...',
    'profiler.phases': 'FASES',
    'profiler.phase': 'FASE',
    'profiler.inProgress': '[ EN CURSO ]',
    'profiler.done': '[ HECHO ]',
    'profiler.liveResults': 'RESULTADOS EN VIVO',
    'profiler.liveLog': 'LOG EN VIVO',
    'profiler.noEvents': '[ SIN EVENTOS TODAVIA ]',
    'profiler.target': 'OBJETIVO',
    'profiler.technologies': 'TECNOLOGIAS',
    'profiler.routes': 'RUTAS',
    'profiler.guards': 'GUARDIAS',
    'profiler.jsDeps': 'DEPS JS',
    'profiler.report': 'INFORME',
    'profiler.outdated': 'OBSOLETAS',
    'profiler.authGuards': 'GUARDIAS DE AUTH',
    'profiler.jsDependencies': 'DEPENDENCIAS JS',
    'profiler.viewAll': 'VER TODOS LOS PERFILES →',
    'profiler.wsError': 'Fallo la conexion WebSocket. ¿Backend en {url}?',
    'profiler.closedError': 'La conexion se cerro inesperadamente.',
    'profiler.reportError': 'No se pudo cargar el informe del perfil.',
    // JS analysis
    'js.title': 'ANALISIS JS',
    'js.subtitle': 'DEPENDENCIAS DE BUNDLES JAVASCRIPT',
    'js.profile': 'PERFIL',
    'js.dependencies': '{count} DEPENDENCIAS',
    'js.empty': '[ SIN DEPENDENCIAS JS ]',
    'js.knownVersions': 'VERSIONES CONOCIDAS',
    'js.latest': 'ULTIMA: {version}',
    'js.loadError': 'No se pudo cargar.',
    // SPA routes
    'spa.title': 'RUTAS SPA',
    'spa.subtitle': 'DESCUBRIMIENTO DE RUTAS ANGULAR, REACT, VUE',
    'spa.summary': '{routes} RUTAS · {guards} GUARDIAS',
    'spa.empty': '[ SIN RUTAS DESCUBIERTAS ]',
    'spa.routeMap': 'MAPA DE RUTAS',
    'spa.authGuards': 'GUARDIAS DE AUTH',
    'spa.unknown': 'DESCONOCIDO',
    // History
    'history.title': 'HISTORIAL Y ARCHIVO',
    'history.subtitle': 'EXPLORAR PERFILES ANTERIORES',
    'history.deleteAll': 'BORRAR TODO',
    'history.deleting': 'BORRANDO...',
    'history.confirmAll': '[ ¿CONFIRMAR BORRAR TODO? ]',
    'history.compare': 'COMPARAR SELECCION',
    'history.comparing': 'COMPARANDO...',
    'history.empty': '[ SIN PERFILES — EJECUTA UN ESCANEO EN EL PERFILADOR ]',
    'history.delete': 'BORRAR',
    'history.confirm': '[ ¿CONFIRMAR? ]',
    'history.compareResults': 'RESULTADOS DE COMPARACION',
    'history.change': 'PERFIL {from} → PERFIL {to}',
    'history.added': 'AÑADIDO',
    'history.removed': 'ELIMINADO',
    'history.noChanges': '[ SIN CAMBIOS DETECTADOS ]',
    'history.trendsTitle': 'TENDENCIAS HISTORICAS',
    'history.trendsSubtitle': 'EVOLUCION TECNOLOGICA EN EL TIEMPO',
    'history.domain': 'DOMINIO',
    'history.loadTrends': 'CARGAR TENDENCIAS',
    'history.profilesCount': '{count} PERFIL(ES)',
    'history.exportList': 'EXPORTAR LISTA',
    'history.profilesError': 'No se pudieron cargar los perfiles.',
    'history.compareError': 'Fallo la comparacion.',
    'history.deleteAllError': 'No se pudieron borrar todos los perfiles.',
    'history.trendsError': 'Fallo la carga de tendencias.',
    // Charts (shared xwa-chart)
    'charts.techCategories': 'TECNOLOGIA POR CATEGORIA',
    'charts.confidence': 'CONFIANZA DE DETECCION',
    'charts.profilesPerDay': 'PERFILES POR DIA',
    'charts.status': 'ESTADO DE PERFILES',
    'charts.trends': 'TENDENCIA TECNOLOGICA',
    'charts.latestProfile': 'ULTIMO PERFIL: {domain} (ID {id})',
    // Inventory
    'inv.title': 'INVENTARIO',
    'inv.subtitle': 'INFORME COMPLETO DEL STACK TECNOLOGICO',
    'inv.profile': 'PERFIL',
    'inv.technologies': 'TECNOLOGIAS',
    'inv.routes': 'RUTAS',
    'inv.dependencies': 'DEPENDENCIAS JS',
    'inv.detailsError': 'No se pudieron cargar los detalles del perfil.',
    // Export actions (shared)
    'export.client': 'CLIENTE',
    'export.server': 'SERVIDOR',
    'export.pdfBusy': 'PDF...',
    'export.error': '[ ERROR: FALLO LA EXPORTACION PDF ]',
    'export.saved': '[ EXPORTADO ]',
  },
};

/** Tiny key-based i18n service (en/es) with `{param}` interpolation. */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly storageKey = 'kensei-locale';
  readonly locale = signal<Locale>(this.readStoredLocale());

  t(key: string, params?: TranslationParams): string {
    const table = TRANSLATIONS[this.locale()];
    const template = table[key] ?? TRANSLATIONS.en[key] ?? key;
    return params ? this.interpolate(template, params) : template;
  }

  toggle(): void {
    this.setLocale(this.locale() === 'en' ? 'es' : 'en');
  }

  setLocale(locale: Locale): void {
    this.locale.set(locale);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, locale);
    }
  }

  localeLabel(): string {
    return this.locale().toUpperCase();
  }

  nextLocaleLabel(): string {
    return this.locale() === 'en' ? 'ES' : 'EN';
  }

  nextLocaleAriaLabel(): string {
    return `Switch language to ${this.nextLocaleLabel()}`;
  }

  private interpolate(template: string, params: TranslationParams): string {
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  }

  private readStoredLocale(): Locale {
    if (typeof localStorage === 'undefined') {
      return 'en';
    }
    return localStorage.getItem(this.storageKey) === 'es' ? 'es' : 'en';
  }
}
