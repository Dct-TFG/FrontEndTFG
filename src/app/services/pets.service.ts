import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../api.config';

export type Species = 'DOG' | 'CAT' | 'BIRD' | 'SMALL_MAMMAL' | 'OTHER';
export const SPECIES: Species[] = ['DOG', 'CAT', 'BIRD', 'SMALL_MAMMAL', 'OTHER'];

export type EntryType = 'DIAGNOSIS' | 'TREATMENT' | 'VACCINATION' | 'VISIT' | 'LAB_RESULT';

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

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export interface RecentEntry {
  id: string;
  type: EntryType;
  date: string;
  description: string;
  petId: string;
  petName: string;
  veterinarianName: string;
  centerName: string | null;
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
}