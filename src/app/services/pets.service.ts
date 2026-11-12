import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../api.config';
import { toApiError } from './api-error';

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
}

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

  async create(payload: CreatePetPayload): Promise<Pet> {
    try {
      return await firstValueFrom(this.http.post<Pet>(`${API_URL}/pets`, payload));
    } catch (e) {
      throw toApiError(e, 'No se ha podido crear la mascota.');
    }
  }
}