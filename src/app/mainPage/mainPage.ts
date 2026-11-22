import { Component, inject, OnInit, OnDestroy, HostListener, Output, EventEmitter, ElementRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { AuthService, UserRole } from '../services/auth.service';
import {
  PetsService,
  Pet,
  SharedPet,
  RecentEntry,
  Species,
  SPECIES,
  PHOTO_TYPES,
  MAX_PHOTO_BYTES
} from '../services/pets.service';
import { CentersService, CenterSummary } from '../services/centers.service';
import { PetAccessDialog } from './pet-access/pet-access-dialog';
import { PetPage } from './pet-page/pet-page';
import { formatLongDate, localIsoDate, localeFor, petAge, speciesIcon } from '../shared/pet-utils';

@Component({
  selector: 'app-main-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, PetAccessDialog, PetPage],
  templateUrl: './mainPage.html',
  styleUrl: './mainPage.css'
})
export class MainPage implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);
  readonly translate = inject(TranslateService);
  private readonly petsService = inject(PetsService);
  private readonly centersService = inject(CentersService);
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
  readonly recentError = signal(false);
  readonly isOwner = computed(() => this.authService.selectedRole() === 'owner');

  readonly speciesOptions = SPECIES;
  readonly isPetModalOpen = signal(false);
  readonly savingPet = signal(false);
  readonly petFormError = signal<string | null>(null);
  petForm = { name: '', species: 'DOG' as Species, breed: '', birthDate: '' };
  maxBirthDate = '';

  readonly photoUrls = signal<Record<string, string>>({});
  readonly uploadingPhotoFor = signal<string | null>(null);
  readonly photoNotice = signal<string | null>(null);
  readonly acceptedPhotoTypes = PHOTO_TYPES.join(',');
  newPetPhoto: File | null = null;
  readonly newPetPhotoPreview = signal<string | null>(null);

  readonly accessPet = signal<Pet | null>(null);
  readonly selectedPetId = signal<string | null>(null);
  readonly sharedPets = signal<SharedPet[]>([]);

  readonly workplace = computed(() => this.authService.profile()?.centers?.[0] ?? null);
  readonly centers = signal<CenterSummary[]>([]);
  readonly centersError = signal(false);
  readonly editingWorkplace = signal(false);
  readonly savingWorkplace = signal(false);
  readonly workplaceMessage = signal<{ type: 'success' | 'error'; key: string } | null>(null);
  workplaceSelection = '';

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
      void this.loadSharedPets();
    }
  }

  async startEditingWorkplace(): Promise<void> {
    this.workplaceMessage.set(null);
    this.workplaceSelection = this.workplace()?.id ?? '';
    this.editingWorkplace.set(true);
    await this.loadCenters();
  }

  async loadCenters(): Promise<void> {
    this.centersError.set(false);
    try {
      this.centers.set(await this.centersService.list());
    } catch {
      this.centersError.set(true);
    }
  }

  cancelEditingWorkplace(): void {
    this.editingWorkplace.set(false);
  }

  async saveWorkplace(): Promise<void> {
    const centerId = this.workplaceSelection || null;
    if (centerId === (this.workplace()?.id ?? null)) {
      this.editingWorkplace.set(false);
      return;
    }

    this.savingWorkplace.set(true);
    this.workplaceMessage.set(null);
    try {
      await this.authService.setWorkplace(centerId);
      this.editingWorkplace.set(false);
      this.workplaceMessage.set({ type: 'success', key: 'dashboard.workplace.saved' });
    } catch (e) {
      const offline = e instanceof HttpErrorResponse && e.status === 0;
      this.workplaceMessage.set({
        type: 'error',
        key: offline ? 'dashboard.state.offline' : 'dashboard.workplace.errorSave'
      });
    } finally {
      this.savingWorkplace.set(false);
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
    this.recentError.set(false);

    const [pets, recent] = await Promise.allSettled([
      this.petsService.list(),
      this.petsService.recentEntries()
    ]);

    if (pets.status === 'fulfilled') {
      this.pets.set(pets.value);
      void this.loadPhotos(pets.value);
    } else {
      this.loadError.set(true);
    }

    if (recent.status === 'fulfilled') {
      this.recentEntries.set(recent.value);
    } else {
      this.recentError.set(true);
    }

    this.loading.set(false);
  }

  ngOnDestroy(): void {
    this.revokeAll();
    this.clearNewPetPhoto();
  }

  private async loadPhotos(pets: Pet[]): Promise<void> {
    const entries = await Promise.all(
      pets
        .filter((p) => p.hasPhoto)
        .map(async (p) => {
          try {
            return [p.id, URL.createObjectURL(await this.petsService.photo(p.id))] as const;
          } catch {
            return null;
          }
        })
    );
    this.revokeAll();
    this.photoUrls.set(Object.fromEntries(entries.filter((e) => e !== null)));
  }

  private revokeAll(): void {
    Object.values(this.photoUrls()).forEach((url) => URL.revokeObjectURL(url));
  }

  private photoError(file: File): string | null {
    if (!PHOTO_TYPES.includes(file.type)) return 'dashboard.photo.errorType';
    if (file.size > MAX_PHOTO_BYTES) return 'dashboard.photo.errorSize';
    return null;
  }

  onNewPetPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const error = this.photoError(file);
    if (error) {
      this.petFormError.set(this.translate.instant(error));
      return;
    }
    this.petFormError.set(null);
    this.clearNewPetPhoto();
    this.newPetPhoto = file;
    this.newPetPhotoPreview.set(URL.createObjectURL(file));
  }

  clearNewPetPhoto(): void {
    const preview = this.newPetPhotoPreview();
    if (preview) URL.revokeObjectURL(preview);
    this.newPetPhotoPreview.set(null);
    this.newPetPhoto = null;
  }

  async onCardPhotoSelected(pet: Pet, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.photoNotice.set(null);
    const error = this.photoError(file);
    if (error) {
      this.photoNotice.set(this.translate.instant(error));
      return;
    }

    this.uploadingPhotoFor.set(pet.id);
    try {
      await this.petsService.uploadPhoto(pet.id, file);
      this.pets.update((list) => list.map((p) => (p.id === pet.id ? { ...p, hasPhoto: true } : p)));
      const old = this.photoUrls()[pet.id];
      if (old) URL.revokeObjectURL(old);
      this.photoUrls.update((urls) => ({ ...urls, [pet.id]: URL.createObjectURL(file) }));
    } catch {
      this.photoNotice.set(this.translate.instant('dashboard.photo.errorUpload'));
    } finally {
      this.uploadingPhotoFor.set(null);
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
    return petAge(pet.birthDate);
  }

  formatDate(iso: string): string {
    return formatLongDate(iso, this.currentLang);
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
    this.clearNewPetPhoto();
    this.petFormError.set(null);
    this.maxBirthDate = this.localIsoDate(new Date());
    this.isPetModalOpen.set(true);
  }

  closePetModal(): void {
    if (this.savingPet()) return;
    this.isPetModalOpen.set(false);
    this.clearNewPetPhoto();
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
    this.photoNotice.set(null);
    try {
      const pet = await this.petsService.create({
        name: name.trim(),
        species,
        breed: breed.trim(),
        birthDate
      });

      if (this.newPetPhoto) {
        try {
          await this.petsService.uploadPhoto(pet.id, this.newPetPhoto);
        } catch {
          this.photoNotice.set(this.translate.instant('dashboard.photo.errorAfterCreate'));
        }
      }

      this.isPetModalOpen.set(false);
      this.clearNewPetPhoto();
      await this.loadData();
    } catch (e) {
      const offline = e instanceof HttpErrorResponse && e.status === 0;
      this.petFormError.set(
        this.translate.instant(offline ? 'dashboard.state.offline' : 'dashboard.petForm.errorSave')
      );
    } finally {
      this.savingPet.set(false);
    }
  }

  getLangDisplayName(lang: string): string {
    return this.translate.instant(`dashboard.lang.${lang}`);
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
    this.isLangPopupOpen = false;
    this.isUserMenuOpen = false;
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
    this.selectedPetId.set(pet.id);
    window.scrollTo({ top: 0 });
  }

  closePetPage(): void {
    this.selectedPetId.set(null);
    if (this.isOwner()) {
      void this.loadData();
    } else {
      void this.loadSharedPets();
    }
  }

  async loadSharedPets(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const pets = await this.petsService.sharedWithMe();
      this.sharedPets.set(pets);
      void this.loadPhotos(pets);
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  getPetImage(pet: Pet): string {
    return speciesIcon(pet.species);
  }

  private locale(): string {
    return localeFor(this.currentLang);
  }

  private localIsoDate(date: Date): string {
    return localIsoDate(date);
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