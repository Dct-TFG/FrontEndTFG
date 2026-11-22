import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../api.config';

export type Species = 'DOG' | 'CAT' | 'BIRD' | 'SMALL_MAMMAL' | 'OTHER';
export const SPECIES: Species[] = ['DOG', 'CAT', 'BIRD', 'SMALL_MAMMAL', 'OTHER'];

export type EntryType = 'DIAGNOSIS' | 'TREATMENT' | 'VACCINATION' | 'VISIT' | 'LAB_RESULT' | 'IMAGING';
export const ENTRY_TYPES: EntryType[] = [
  'VISIT',
  'DIAGNOSIS',
  'TREATMENT',
  'VACCINATION',
  'LAB_RESULT',
  'IMAGING'
];

export type AccessLevel = 'OWNER' | 'EDIT' | 'VIEW';

export interface Pet {
  id: string;
  ownerId: string;
  name: string;
  species: Species;
  breed: string;
  birthDate: string;
  lastEntryDate: string | null;
  hasPhoto: boolean;
}

export interface SharedPet extends Pet {
  accessLevel: 'EDIT' | 'VIEW';
  ownerName: string;
}

export interface PetDetail extends Omit<Pet, 'lastEntryDate'> {
  accessLevel: AccessLevel;
  ownerName: string | null;
}

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export const ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_ENTRY = 5;

export interface RecentEntry {
  id: string;
  type: EntryType;
  date: string;
  title: string;
  description: string;
  petId: string;
  petName: string;
  veterinarianName: string;
  centerName: string | null;
}

export interface EntryAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface ClinicalEntry {
  id: string;
  type: EntryType;
  date: string;
  title: string;
  description: string;
  createdAt: string;
  veterinarianName: string;
  centerName: string | null;
  attachments: EntryAttachment[];
}

export interface CreateEntryPayload {
  type: EntryType;
  date: string;
  title: string;
  description: string;
}

export interface CreatePetPayload {
  name: string;
  species: Species;
  breed: string;
  birthDate: string;
}

@Injectable({
  providedIn: 'root'
})
export class PetsService {
  private readonly http = inject(HttpClient);

  list(): Promise<Pet[]> {
    return firstValueFrom(this.http.get<Pet[]>(`${API_URL}/pets`));
  }

  sharedWithMe(): Promise<SharedPet[]> {
    return firstValueFrom(this.http.get<SharedPet[]>(`${API_URL}/pets/shared-with-me`));
  }

  get(petId: string): Promise<PetDetail> {
    return firstValueFrom(this.http.get<PetDetail>(`${API_URL}/pets/${petId}`));
  }

  recentEntries(): Promise<RecentEntry[]> {
    return firstValueFrom(this.http.get<RecentEntry[]>(`${API_URL}/pets/recent-entries`));
  }

  create(payload: CreatePetPayload): Promise<Pet> {
    return firstValueFrom(this.http.post<Pet>(`${API_URL}/pets`, payload));
  }

  uploadPhoto(petId: string, file: File): Promise<{ hasPhoto: boolean }> {
    const body = new FormData();
    body.append('photo', file);
    return firstValueFrom(this.http.put<{ hasPhoto: boolean }>(`${API_URL}/pets/${petId}/photo`, body));
  }

  photo(petId: string): Promise<Blob> {
    return firstValueFrom(this.http.get(`${API_URL}/pets/${petId}/photo`, { responseType: 'blob' }));
  }

  entries(petId: string): Promise<ClinicalEntry[]> {
    return firstValueFrom(this.http.get<ClinicalEntry[]>(`${API_URL}/pets/${petId}/entries`));
  }

  createEntry(petId: string, payload: CreateEntryPayload): Promise<ClinicalEntry> {
    return firstValueFrom(this.http.post<ClinicalEntry>(`${API_URL}/pets/${petId}/entries`, payload));
  }

  uploadAttachment(entryId: string, file: File): Promise<EntryAttachment> {
    const body = new FormData();
    body.append('file', file);
    return firstValueFrom(
      this.http.post<EntryAttachment>(`${API_URL}/entries/${entryId}/attachments`, body)
    );
  }

  attachment(entryId: string, attachmentId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${API_URL}/entries/${entryId}/attachments/${attachmentId}`, { responseType: 'blob' })
    );
  }
}
