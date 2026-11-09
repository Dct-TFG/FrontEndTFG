import { Component, inject, OnInit, HostListener, Output, EventEmitter, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { AuthService, UserRole } from '../services/auth.service';

@Component({
  selector: 'app-main-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './mainPage.html',
  styleUrl: './mainPage.css'
})
export class MainPage implements OnInit {
  readonly authService = inject(AuthService);
  readonly translate = inject(TranslateService);
  private readonly elementRef = inject(ElementRef);

  @Output() logout = new EventEmitter<void>();
  @Output() backToLanding = new EventEmitter<void>();

  currentLang = 'es';
  isLangPopupOpen = false;
  isUserMenuOpen = false;
  activeNav = 'home';

  currentDateFormatted = '';
  currentDateIso = '2026-10-22';

  ngOnInit(): void {
    this.currentLang = this.translate.getCurrentLang() || this.translate.currentLang() || 'es';
    this.updateFormattedDate();

    this.translate.onLangChange.subscribe((event) => {
      this.currentLang = event.lang;
      this.updateFormattedDate();
    });
  }

  get currentUser() {
    return this.authService.currentUser();
  }

  get selectedRole(): UserRole {
    return this.authService.selectedRole();
  }

  get userName(): string {
    const user = this.currentUser;
    if (user?.displayName) return user.displayName;
    if (user?.email) return user.email.split('@')[0];
    return 'Clara Ruiz';
  }

  get userEmail(): string {
    return this.currentUser?.email || 'clara.ruiz@petkeepers.app';
  }

  get userInitials(): string {
    const name = this.userName.trim();
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (name.substring(0, 2) || 'CR').toUpperCase();
  }

  getLangDisplayName(lang: string): string {
    switch (lang) {
      case 'ca':
        return 'Català';
      case 'en':
        return 'English';
      case 'es':
      default:
        return 'Castellano';
    }
  }

  toggleLangPopup(event?: Event): void {
    if (event) event.stopPropagation();
    this.isLangPopupOpen = !this.isLangPopupOpen;
    if (this.isLangPopupOpen) {
      this.isUserMenuOpen = false;
    }
  }

  toggleUserMenu(event?: Event): void {
    if (event) event.stopPropagation();
    this.isUserMenuOpen = !this.isUserMenuOpen;
    if (this.isUserMenuOpen) {
      this.isLangPopupOpen = false;
    }
  }

  selectLanguage(lang: string): void {
    this.currentLang = lang;
    this.translate.use(lang);
    this.isLangPopupOpen = false;
    this.updateFormattedDate();
  }

  switchLang(event: Event): void {
    const lang = (event.target as HTMLSelectElement).value;
    this.selectLanguage(lang);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!this.elementRef.nativeElement.contains(target)) {
      this.isLangPopupOpen = false;
      this.isUserMenuOpen = false;
      return;
    }
    // If click inside component but outside the wrappers
    const isLangClick = target.closest('.lang-switcher-wrapper');
    const isUserClick = target.closest('.user-menu-wrapper');
    if (!isLangClick) {
      this.isLangPopupOpen = false;
    }
    if (!isUserClick) {
      this.isUserMenuOpen = false;
    }
  }

  setActiveNav(item: string): void {
    this.activeNav = item;
  }

  navigate(section: string): void {
    if (section === 'landing') {
      this.backToLanding.emit();
    } else {
      this.activeNav = 'home';
    }
  }

  async onLogout(): Promise<void> {
    this.isUserMenuOpen = false;
    try {
      await this.authService.logout();
    } finally {
      this.logout.emit();
      this.backToLanding.emit();
    }
  }

  viewHistory(petName: string): void {
    console.log(`Ver historial de ${petName}`);
  }

  addPet(): void {
    console.log('Añadir mascota');
  }

  private updateFormattedDate(): void {
    const date = new Date(2026, 9, 22); // 22 Oct 2026
    const locale = this.currentLang === 'ca' ? 'ca-ES' : this.currentLang === 'en' ? 'en-US' : 'es-ES';

    try {
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      };
      const formatted = new Intl.DateTimeFormat(locale, options).format(date);
      // Capitalize first letter
      this.currentDateFormatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      this.currentDateFormatted = 'Jueves, 22 de octubre de 2026';
    }
  }
}
