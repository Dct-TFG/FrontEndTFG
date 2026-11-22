import { Component, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ATTACHMENT_TYPES,
  ClinicalEntry,
  ENTRY_TYPES,
  EntryAttachment,
  EntryType,
  MAX_ATTACHMENTS_PER_ENTRY,
  MAX_ATTACHMENT_BYTES,
  PetDetail,
  PetsService
} from '../../services/pets.service';
import { formatLongDate, localIsoDate, petAge, speciesIcon } from '../../shared/pet-utils';
import { PetAccessDialog } from '../pet-access/pet-access-dialog';

type Feedback = { type: 'success' | 'error'; text: string };

@Component({
  selector: 'app-pet-page',
  standalone: true,
  imports: [FormsModule, TranslatePipe, PetAccessDialog],
  templateUrl: './pet-page.html',
  styleUrl: './pet-page.css'
})
export class PetPage implements OnInit, OnDestroy {
  private readonly petsService = inject(PetsService);
  private readonly translate = inject(TranslateService);

  readonly petId = input.required<string>();
  readonly back = output<void>();

  readonly pet = signal<PetDetail | null>(null);
  readonly photoUrl = signal<string | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);

  readonly entries = signal<ClinicalEntry[]>([]);
  readonly entriesLoading = signal(true);
  readonly entriesError = signal(false);

  readonly isOwner = computed(() => this.pet()?.accessLevel === 'OWNER');
  readonly canWrite = computed(() => this.pet()?.accessLevel === 'EDIT');
  readonly accessOpen = signal(false);

  readonly entryTypes = ENTRY_TYPES;
  readonly acceptedFiles = ATTACHMENT_TYPES.join(',');
  readonly maxFiles = MAX_ATTACHMENTS_PER_ENTRY;
  readonly formOpen = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly files = signal<File[]>([]);
  readonly feedback = signal<Feedback | null>(null);
  readonly openingAttachment = signal<string | null>(null);
  form = { type: 'VISIT' as EntryType, date: '', title: '', description: '' };
  maxDate = '';

  ngOnInit(): void {
    void this.load();
  }

  ngOnDestroy(): void {
    const url = this.photoUrl();
    if (url) URL.revokeObjectURL(url);
  }

  get lang(): string {
    return this.translate.getCurrentLang() || 'es';
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const pet = await this.petsService.get(this.petId());
      this.pet.set(pet);
      void this.loadEntries();
      if (pet.hasPhoto) void this.loadPhoto();
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async loadEntries(): Promise<void> {
    this.entriesLoading.set(true);
    this.entriesError.set(false);
    try {
      this.entries.set(await this.petsService.entries(this.petId()));
    } catch {
      this.entriesError.set(true);
    } finally {
      this.entriesLoading.set(false);
    }
  }

  private async loadPhoto(): Promise<void> {
    try {
      const blob = await this.petsService.photo(this.petId());
      this.photoUrl.set(URL.createObjectURL(blob));
    } catch {
      this.photoUrl.set(null);
    }
  }

  age(pet: PetDetail) {
    return petAge(pet.birthDate);
  }

  icon(pet: PetDetail): string {
    return speciesIcon(pet.species);
  }

  date(iso: string): string {
    return formatLongDate(iso, this.lang);
  }

  fileSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  isPdf(attachment: EntryAttachment): boolean {
    return attachment.mimeType === 'application/pdf';
  }

  openForm(): void {
    this.maxDate = localIsoDate(new Date());
    this.form = { type: 'VISIT', date: this.maxDate, title: '', description: '' };
    this.files.set([]);
    this.formError.set(null);
    this.feedback.set(null);
    this.formOpen.set(true);
  }

  cancelForm(): void {
    if (this.saving()) return;
    this.formOpen.set(false);
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const chosen = Array.from(input.files ?? []);
    input.value = '';
    this.formError.set(null);

    for (const file of chosen) {
      if (!ATTACHMENT_TYPES.includes(file.type)) {
        this.formError.set(this.translate.instant('dashboard.petPage.errorFileType', { name: file.name }));
        return;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        this.formError.set(this.translate.instant('dashboard.petPage.errorFileSize', { name: file.name }));
        return;
      }
    }

    const next = [...this.files(), ...chosen];
    if (next.length > MAX_ATTACHMENTS_PER_ENTRY) {
      this.formError.set(
        this.translate.instant('dashboard.petPage.errorTooManyFiles', { max: MAX_ATTACHMENTS_PER_ENTRY })
      );
      return;
    }
    this.files.set(next);
  }

  removeFile(index: number): void {
    this.files.update((list) => list.filter((_, i) => i !== index));
  }

  async submit(event?: Event): Promise<void> {
    if (event) event.preventDefault();
    this.formError.set(null);

    const { type, date, title, description } = this.form;
    if (!date || !title.trim() || !description.trim()) {
      this.formError.set(this.translate.instant('dashboard.petPage.errorRequired'));
      return;
    }

    this.saving.set(true);
    try {
      const entry = await this.petsService.createEntry(this.petId(), {
        type,
        date,
        title: title.trim(),
        description: description.trim()
      });

      let failed = 0;
      for (const file of this.files()) {
        try {
          entry.attachments.push(await this.petsService.uploadAttachment(entry.id, file));
        } catch {
          failed++;
        }
      }

      this.formOpen.set(false);
      await this.loadEntries();
      this.feedback.set(
        failed > 0
          ? {
              type: 'error',
              text: this.translate.instant('dashboard.petPage.savedPartially', { count: failed })
            }
          : { type: 'success', text: this.translate.instant('dashboard.petPage.saved') }
      );
    } catch (e) {
      const offline = e instanceof HttpErrorResponse && e.status === 0;
      const forbidden = e instanceof HttpErrorResponse && e.status === 403;
      this.formError.set(
        this.translate.instant(
          offline
            ? 'dashboard.state.offline'
            : forbidden
              ? 'dashboard.petPage.errorForbidden'
              : 'dashboard.petPage.errorSave'
        )
      );
    } finally {
      this.saving.set(false);
    }
  }

  async openAttachment(entry: ClinicalEntry, attachment: EntryAttachment): Promise<void> {
    const tab = window.open('', '_blank');
    this.openingAttachment.set(attachment.id);
    try {
      const blob = await this.petsService.attachment(entry.id, attachment.id);
      const url = URL.createObjectURL(blob);
      if (tab) {
        tab.location.href = url;
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = attachment.fileName;
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      tab?.close();
      this.feedback.set({
        type: 'error',
        text: this.translate.instant('dashboard.petPage.errorAttachment')
      });
    } finally {
      this.openingAttachment.set(null);
    }
  }
}
