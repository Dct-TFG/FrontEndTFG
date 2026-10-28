import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { provideTranslateService } from '@ngx-translate/core';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideTranslateService({
          lang: 'es'
        })
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should default to es language and login auth mode', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.currentLang).toBe('es');
    expect(app.authMode).toBe('login');
  });

  it('should switch auth mode', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.setAuthMode('register');
    expect(app.authMode).toBe('register');
    app.setAuthMode('forgot');
    expect(app.authMode).toBe('forgot');
  });

  it('should toggle FAQ open index', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.openFaqIndex).toBe(0);
    app.toggleFaq(1);
    expect(app.openFaqIndex).toBe(1);
    app.toggleFaq(1);
    expect(app.openFaqIndex).toBeNull();
  });
});
