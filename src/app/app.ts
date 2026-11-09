import { Component, inject } from '@angular/core';
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
  openFaqIndex: number | null = 0;

  constructor() {
    this.translate.addLangs(['es', 'ca', 'en']);
    this.translate.use('es');
  }

  get currentUser() {
    return this.authService.currentUser();
  }

  get selectedRole(): UserRole {
    return this.authService.selectedRole();
  }

  switchLang(event: Event): void {
    const lang = (event.target as HTMLSelectElement).value;
    this.currentLang = lang;
    this.translate.use(lang);
  }

  selectRole(role: UserRole): void {
    this.authService.setRole(role);
  }

  setAuthMode(mode: AuthMode): void {
    this.authMode = mode;
    this.statusMessage = null;
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
      this.statusMessage = {
        type: 'error',
        text: this.formatErrorMessage(error)
      };
    } finally {
      this.isLoading = false;
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
    }
  }

  private formatErrorMessage(error: any): string {
    const raw = this.authService.getFriendlyErrorMessage(error);
    const messages: Record<string, Record<string, string>> = {
      'auth/invalid-credential': {
        es: 'Correo electrónico o contraseña incorrectos.',
        ca: 'Correu electrònic o contrasenya incorrectes.',
        en: 'Incorrect email or password.'
      },
      'auth/email-already-in-use': {
        es: 'Este correo electrónico ya está registrado. Prueba a iniciar sesión.',
        ca: 'Aquest correu electrònic ja està registrat. Prova a iniciar sessió.',
        en: 'This email is already in use. Try logging in.'
      },
      'auth/weak-password': {
        es: 'La contraseña debe tener al menos 6 caracteres.',
        ca: 'La contrasenya ha de tenir com a mínim 6 caràcters.',
        en: 'Password must be at least 6 characters.'
      },
      'auth/invalid-email': {
        es: 'El formato de correo electrónico no es válido.',
        ca: 'El format de correu electrònic no és vàlid.',
        en: 'Invalid email address format.'
      },
      'auth/too-many-requests': {
        es: 'Demasiados intentos fallidos. Por favor, espera un momento.',
        ca: 'Massa intents fallits. Si us plau, espera un moment.',
        en: 'Too many attempts. Please try again later.'
      },
      'auth/network-request-failed': {
        es: 'Error de conexión. Comprueba tu conexión a internet.',
        ca: 'Error de connexió. Comprova la teva connexió.',
        en: 'Network error. Please verify your connection.'
      }
    };

    const lang = this.currentLang || 'es';
    if (messages[raw] && messages[raw][lang]) {
      return messages[raw][lang];
    }
    return error?.message || 'Ha ocurrido un error inesperado.';
  }
}