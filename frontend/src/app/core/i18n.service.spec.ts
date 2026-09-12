import { TestBed } from '@angular/core/testing';

import { I18nService } from './i18n.service';

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(I18nService);
  });

  it('should default to English', () => {
    expect(service.locale()).toBe('en');
    expect(service.t('nav.profiler')).toBe('01 // PROFILER');
  });

  it('should toggle to Spanish and back', () => {
    service.toggle();
    expect(service.locale()).toBe('es');
    expect(service.t('nav.profiler')).toBe('01 // PERFILADOR');
    expect(service.nextLocaleLabel()).toBe('EN');

    service.toggle();
    expect(service.locale()).toBe('en');
  });

  it('should interpolate parameters', () => {
    expect(service.t('history.profilesCount', { count: 3 })).toBe('3 PROFILE(S)');
    service.setLocale('es');
    expect(service.t('history.profilesCount', { count: 3 })).toBe('3 PERFIL(ES)');
  });

  it('should fall back to the key when missing', () => {
    expect(service.t('does.not.exist')).toBe('does.not.exist');
  });

  it('should persist the selected locale', () => {
    service.setLocale('es');
    expect(localStorage.getItem('kensei-locale')).toBe('es');
    expect(new I18nService().locale()).toBe('es');
  });
});
