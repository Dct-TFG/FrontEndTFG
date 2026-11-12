import { Component, inject, OnInit, HostListener, Output, EventEmitter, ElementRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { AuthService, UserRole } from '../services/auth.service';
import { PetsService, Pet, RecentEntry, Species, SPECIES } from '../services/pets.service';

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
  private readonly petsService = inject(PetsService);
  private readonly elementRef = inject(ElementRef);

  @Output() logout = new EventEmitter<void>();
  @Output() backToLanding = new EventEmitter<void>();

  currentLang = 'es';
  isLangPopupOpen = false;
  isUserMenuOpen = false;
  activeNav = 'home';

  currentDateFormatted = '';
  currentDateIso = '';

  readonly pets = signal<Pet[]>([]);
  readonly recentEntries = signal<RecentEntry[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly isOwner = computed(() => this.authService.selectedRole() === 'owner');

  readonly speciesOptions = SPECIES;
  readonly isPetModalOpen = signal(false);
  readonly savingPet = signal(false);
  readonly petFormError = signal<string | null>(null);
  petForm = { name: '', species: 'DOG' as Species, breed: '', birthDate: '' };
  maxBirthDate = '';

  ngOnInit(): void {
    this.currentLang = this.translate.getCurrentLang() || this.translate.currentLang() || 'es';
    this.updateFormattedDate();

    this.translate.onLangChange.subscribe((event) => {
      this.currentLang = event.lang;
      this.updateFormattedDate();
    });

    if (this.isOwner()) {
      void this.loadData();
    } else {
      this.loading.set(false);
    }
  }

  get currentUser() {
    return this.authService.currentUser();
  }

  get selectedRole(): UserRole {
    return this.authService.selectedRole();
  }

  get userName(): string {
    const fullName = this.authService.profile()?.fullName;
    if (fullName) return fullName;
    const user = this.currentUser;
    if (user?.displayName) return user.displayName;
    if (user?.email) return user.email.split('@')[0];
    return '';
  }

  get userEmail(): string {
    return this.authService.profile()?.email || this.currentUser?.email || '';
  }

  get userInitials(): string {
    const name = this.userName.trim();
    if (!name) return '?';
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const [pets, recent] = await Promise.all([
        this.petsService.list(),
        this.petsService.recentEntries()
      ]);
      this.pets.set(pets);
      this.recentEntries.set(recent);
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  petNames(): string {
    const names = this.pets().map((p) => p.name);
    try {
      return new Intl.ListFormat(this.locale(), { style: 'long', type: 'conjunction' }).format(names);
    } catch {
      return names.join(', ');
    }
  }

  ageOf(pet: Pet): { key: string; count: number } {
    const birth = new Date(pet.birthDate);
    const now = new Date();
    let months =
      (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 +
      (now.getUTCMonth() - birth.getUTCMonth());
    if (now.getUTCDate() < birth.getUTCDate()) months--;

    if (months < 1) return { key: 'dashboard.pets.age.newborn', count: 0 };
    if (months < 12) {
      return { key: months === 1 ? 'dashboard.pets.age.month' : 'dashboard.pets.age.months', count: months };
    }
    const years = Math.floor(months / 12);
    return { key: years === 1 ? 'dashboard.pets.age.year' : 'dashboard.pets.age.years', count: years };
  }

  formatDate(iso: string): string {
    return new Intl.DateTimeFormat(this.locale(), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(iso));
  }

  formatDay(iso: string): string {
    return new Intl.DateTimeFormat(this.locale(), {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC'
    })
      .format(new Date(iso))
      .replace('.', '')
      .toUpperCase();
  }

  openPetModal(): void {
    this.petForm = { name: '', species: 'DOG', breed: '', birthDate: '' };
    this.petFormError.set(null);
    this.maxBirthDate = this.localIsoDate(new Date());
    this.isPetModalOpen.set(true);
  }

  closePetModal(): void {
    if (this.savingPet()) return;
    this.isPetModalOpen.set(false);
  }

  async submitPet(event?: Event): Promise<void> {
    if (event) event.preventDefault();
    this.petFormError.set(null);

    const { name, species, breed, birthDate } = this.petForm;
    if (!name.trim() || !breed.trim() || !birthDate) {
      this.petFormError.set(this.translate.instant('dashboard.petForm.errorRequired'));
      return;
    }

    this.savingPet.set(true);
    try {
      await this.petsService.create({
        name: name.trim(),
        species,
        breed: breed.trim(),
        birthDate
      });
      this.isPetModalOpen.set(false);
      await this.loadData();
    } catch (e) {
      this.petFormError.set(e instanceof Error ? e.message : this.translate.instant('dashboard.state.loadError'));
    } finally {
      this.savingPet.set(false);
    }
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
    const isLangClick = target.closest('.lang-switcher-wrapper');
    const isUserClick = target.closest('.user-menu-wrapper');
    if (!isLangClick) {
      this.isLangPopupOpen = false;
    }
    if (!isUserClick) {
      this.isUserMenuOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closePetModal();
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

  viewHistory(pet: Pet): void {
    console.log(`Ver historial de ${pet.name} (${pet.id})`);
  }

  getPetImage(pet: Pet): string {
    const nameLower = pet.name.toLowerCase();
    if (nameLower.includes('luna')) return 'images/v9_1737.png';
    if (nameLower.includes('milo')) return 'images/v9_1749.png';
    switch (pet.species) {
      case 'DOG':
        return 'images/vector-65.svg';
      case 'CAT':
        return 'images/vector-69.svg';
      case 'BIRD':
        return 'images/vector-73.svg';
      case 'SMALL_MAMMAL':
        return 'images/vector-77.svg';
      default:
        return 'images/vector-35.svg';
    }
  }

  isPetPhoto(pet: Pet): boolean {
    const nameLower = pet.name.toLowerCase();
    return nameLower.includes('luna') || nameLower.includes('milo');
  }

  private locale(): string {
    return this.currentLang === 'ca' ? 'ca-ES' : this.currentLang === 'en' ? 'en-GB' : 'es-ES';
  }

  private localIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private updateFormattedDate(): void {
    const date = new Date();
    this.currentDateIso = this.localIsoDate(date);
    try {
      const formatted = new Intl.DateTimeFormat(this.locale(), {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(date);
      this.currentDateFormatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      this.currentDateFormatted = this.currentDateIso;
    }
  }
}