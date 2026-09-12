import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the shell with all navigation items', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.brand h1')?.textContent).toContain('KENSEI');
    expect(compiled.querySelectorAll('.nav-links a')).toHaveLength(5);
    expect(compiled.querySelector('.nav-links a')?.textContent).toContain('01 // PROFILER');
  });

  it('should toggle the locale label through the i18n service', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const toggle = compiledLocaleButton(fixture.nativeElement as HTMLElement);

    expect(toggle.textContent).toContain('ES');
    toggle.click();
    fixture.detectChanges();
    expect(toggle.textContent).toContain('EN');
  });
});

function compiledLocaleButton(host: HTMLElement): HTMLButtonElement {
  const button = host.querySelector<HTMLButtonElement>('.lang-toggle-btn');
  if (!button) {
    throw new Error('locale button not found');
  }
  return button;
}
