import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../api.config';

export type PermissionLevel = 'VIEW' | 'EDIT';

export interface VeterinaryService {
  entityId: string;
  type: 'CENTER' | 'VETERINARIAN';
  name: string;
  detail: string;
}

export interface PetPermission extends VeterinaryService {
  level: PermissionLevel;
  grantedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class PermissionsService {
  private readonly http = inject(HttpClient);

  search(query: string): Promise<VeterinaryService[]> {
    const params = query.trim() ? new HttpParams().set('q', query.trim()) : undefined;
    return firstValueFrom(
      this.http.get<VeterinaryService[]>(`${API_URL}/veterinary-services`, { params })
    );
  }

  list(petId: string): Promise<PetPermission[]> {
    return firstValueFrom(this.http.get<PetPermission[]>(`${API_URL}/pets/${petId}/permissions`));
  }

  grant(petId: string, entityId: string, level: PermissionLevel): Promise<PetPermission> {
    return firstValueFrom(
      this.http.put<PetPermission>(`${API_URL}/pets/${petId}/permissions/${entityId}`, { level })
    );
  }

  revoke(petId: string, entityId: string): Promise<{ revoked: boolean }> {
    return firstValueFrom(
      this.http.delete<{ revoked: boolean }>(`${API_URL}/pets/${petId}/permissions/${entityId}`)
    );
  }
}
