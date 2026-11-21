import { ChangeDetectorRef, Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { AuthService, UserRole } from './services/auth.service';
import { MainPage } from './mainPage/mainPage';

export type AuthMode = 'login' | 'register' | 'forgot';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, RouterOutlet, MainPage],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  readonly authService = inject(AuthService);
  readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);

  currentLang = 'es';
  currentView: 'landing' | 'main' = 'landing';
  authMode: AuthMode = 'login';

  emailInput = '';
  passwordInput = '';
  confirmPasswordInput = '';
  nameInput = '';
  licenseInput = '';
  specialtyInput = '';

  showPassword = false;
  showConfirmPassword = false;
  isLoading = false;
  statusMessage: { type: 'success' | 'error'; text: string } | null = null;
  emailTaken = false;
  openFaqIndex: number | null = 0;

  readonly languages = [
    { code: 'es', short: 'ES', name: 'Castellano' },
    { code: 'ca', short: 'CA', name: 'Català' },
    { code: 'en', short: 'EN', name: 'English' }
  ];
  isLangMenuOpen = false;

  constructor() {
    this.translate.addLangs(['es', 'ca', 'en']);

    // Recupera el idioma elegido la última vez (si lo hay)
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('app_lang') : null;
    const initial = saved && this.languages.some((l) => l.code === saved) ? saved : 'es';
    this.currentLang = initial;
    this.translate.use(initial);

    // Mantiene el selector sincronizado (también si se cambia desde el panel) y recuerda la elección
    this.translate.onLangChange.subscribe((event) => {
      this.currentLang = event.lang;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('app_lang', event.lang);
      }
    });
  }

  get currentUser() {
    return this.authService.currentUser();
  }

  get selectedRole(): UserRole {
    return this.authService.selectedRole();
  }

  get currentLangShort(): string {
    return this.languages.find((l) => l.code === this.currentLang)?.short ?? 'ES';
  }

  toggleLangMenu(event: Event): void {
    event.stopPropagation();
    this.isLangMenuOpen = !this.isLangMenuOpen;
  }

  selectLanguage(code: string): void {
    this.translate.use(code);
    this.isLangMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.lang-menu')) {
      this.isLangMenuOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isLangMenuOpen = false;
  }

  selectRole(role: UserRole): void {
    this.authService.setRole(role);
  }

  setAuthMode(mode: AuthMode): void {
    this.authMode = mode;
    this.statusMessage = null;
    this.emailTaken = false;
  }

  onEmailChange(): void {
    this.emailTaken = false;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  toggleFaq(index: number): void {
    this.openFaqIndex = this.openFaqIndex === index ? null : index;
  }

  scrollTo(elementId: string): void {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  goToAuth(mode: AuthMode): void {
    this.setAuthMode(mode);
    const formEl = document.getElementById('auth-form-card');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth' });
    }
  }

  async onLogin(event?: Event): Promise<void> {
    if (event) event.preventDefault();
    this.statusMessage = null;

    if (!this.emailInput || !this.passwordInput) {
      this.statusMessage = {
        type: 'error',
        text: this.translate.instant('auth.errorEmptyFields')
      };
      return;
    }

    this.isLoading = true;
    try {
      const userCredential = await this.authService.login(this.emailInput, this.passwordInput);
      this.statusMessage = {
        type: 'success',
        text: this.translate.instant('auth.loginSuccess')
      };
      this.passwordInput = '';
    } catch (error: any) {
      this.statusMessage = {
        type: 'error',
        text: this.formatErrorMessage(error)
      };
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  async onRegister(event?: Event): Promise<void> {
    if (event) event.preventDefault();
    this.statusMessage = null;

    const missingProfessional =
      this.selectedRole === 'professional' &&
      (!this.licenseInput.trim() || !this.specialtyInput.trim());

    if (
      !this.nameInput.trim() ||
      !this.emailInput ||
      !this.passwordInput ||
      !this.confirmPasswordInput ||
      missingProfessional
    ) {
      this.statusMessage = {
        type: 'error',
        text: this.translate.instant('auth.errorEmptyFields')
      };
      return;
    }

    if (this.passwordInput !== this.confirmPasswordInput) {
      this.statusMessage = {
        type: 'error',
        text: this.translate.instant('auth.errorPasswordMismatch')
      };
      return;
    }

    if (this.passwordInput.length < 6) {
      this.statusMessage = {
        type: 'error',
        text: this.translate.instant('auth.errorShortPassword')
      };
      return;
    }

    this.isLoading = true;
    try {
      await this.authService.register(
        this.emailInput,
        this.passwordInput,
        this.nameInput,
        this.selectedRole,
        this.selectedRole === 'professional'
          ? { licenseNumber: this.licenseInput.trim(), specialty: this.specialtyInput.trim() }
          : undefined
      );
      this.statusMessage = {
        type: 'success',
        text: this.translate.instant('auth.registerSuccess')
      };
      this.passwordInput = '';
      this.confirmPasswordInput = '';
    } catch (error: any) {
      if (error?.code === 'auth/email-already-in-use') {
        this.emailTaken = true;
      } else {
        this.statusMessage = {
          type: 'error',
          text: this.formatErrorMessage(error)
        };
      }
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  async onForgotPassword(event?: Event): Promise<void> {
    if (event) event.preventDefault();
    this.statusMessage = null;

    if (!this.emailInput) {
      this.statusMessage = {
        type: 'error',
        text: this.translate.instant('auth.errorEmptyFields')
      };
      return;
    }

    this.isLoading = true;
    try {
      await this.authService.resetPassword(this.emailInput);
      this.statusMessage = {
        type: 'success',
        text: this.translate.instant('auth.resetSent')
      };
    } catch (error: any) {
      this.statusMessage = {
        type: 'error',
        text: this.formatErrorMessage(error)
      };
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  showMainPage(): void {
    this.currentView = 'main';
  }

  showLandingPage(): void {
    this.currentView = 'landing';
  }

  async onLogout(): Promise<void> {
    try {
      await this.authService.logout();
      this.statusMessage = null;
      this.emailInput = '';
      this.passwordInput = '';
      this.confirmPasswordInput = '';
      this.authMode = 'login';
      this.currentView = 'landing';
    } catch (error: any) {
      this.statusMessage = {
        type: 'error',
        text: this.formatErrorMessage(error)
      };
    } finally {
      this.cdr.markForCheck();
    }
  }

  private formatErrorMessage(error: any): string {
    const raw = this.authService.getFriendlyErrorMessage(error);
    const keys: Record<string, string> = {
      'auth/invalid-credential': 'invalidCredential',
      'auth/email-already-in-use': 'emailInUse',
      'auth/weak-password': 'weakPassword',
      'auth/invalid-email': 'invalidEmail',
      'auth/missing-password': 'missingPassword',
      'auth/too-many-requests': 'tooManyRequests',
      'auth/network-request-failed': 'network',
      'auth/user-disabled': 'userDisabled',
      'auth/profile-not-found': 'profileNotFound',
      'auth/license-in-use': 'licenseInUse'
    };

    return this.translate.instant(`auth.errors.${keys[raw] ?? 'generic'}`);
  }
}