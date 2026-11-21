import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../api.config';

export interface CenterSummary {
  id: string;
  name: string;
  address: string;
}

@Injectable({
  providedIn: 'root'
})
export class CentersService {
  private readonly http = inject(HttpClient);
  private cache: Promise<CenterSummary[]> | null = null;

  list(): Promise<CenterSummary[]> {
    if (!this.cache) {
      this.cache = firstValueFrom(this.http.get<CenterSummary[]>(`${API_URL}/centers`)).catch((e) => {
        this.cache = null;
        throw e;
      });
    }
    return this.cache;
  }
}
