import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
  deleteUser,
  User,
  UserCredential
} from 'firebase/auth';
import { auth } from '../firebase.config';
import { API_URL } from '../api.config';

export type UserRole = 'owner' | 'professional';

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: 'OWNER' | 'VETERINARIAN';
}

export interface ProfessionalData {
  licenseNumber: string;
  specialty: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly auth = auth;
  private readonly http = inject(HttpClient);

  readonly currentUser = signal<User | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly selectedRole = signal<UserRole>('owner');

  constructor() {
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser.set(user);
      if (user) {
        void this.loadProfile();
      } else {
        this.profile.set(null);
      }
    });

    if (typeof localStorage !== 'undefined') {
      const savedRole = localStorage.getItem('user_role') as UserRole;
      if (savedRole === 'owner' || savedRole === 'professional') {
        this.selectedRole.set(savedRole);
      }
    }
  }

  setRole(role: UserRole): void {
    this.selectedRole.set(role);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('user_role', role);
    }
  }

  async login(email: string, password: string): Promise<UserCredential> {
    const cred = await signInWithEmailAndPassword(this.auth, email.trim(), password);
    try {
      const profile = await firstValueFrom(this.http.get<Profile>(`${API_URL}/auth/me`));
      this.applyProfile(profile);
    } catch (e) {
      await signOut(this.auth);
      throw this.toError(e, 'No se ha podido cargar tu perfil.');
    }
    return cred;
  }

  async register(
    email: string,
    password: string,
    displayName: string,
    role: UserRole = 'owner',
    professional?: ProfessionalData
  ): Promise<UserCredential> {
    const cred = await createUserWithEmailAndPassword(this.auth, email.trim(), password);
    try {
      if (displayName && cred.user) {
        await updateProfile(cred.user, { displayName });
      }
      const profile = await firstValueFrom(
        this.http.post<Profile>(`${API_URL}/auth/register`, {
          fullName: displayName.trim(),
          role: role === 'owner' ? 'OWNER' : 'VETERINARIAN',
          ...(role === 'professional' ? professional : {})
        })
      );
      this.applyProfile(profile);
    } catch (e) {
      try {
        await deleteUser(cred.user);
      } catch {}
      throw this.toError(e, 'No se ha podido completar el registro.');
    }
    return cred;
  }

  async resetPassword(email: string): Promise<void> {
    return await sendPasswordResetEmail(this.auth, email.trim());
  }

  async logout(): Promise<void> {
    return await signOut(this.auth);
  }

  private applyProfile(profile: Profile): void {
    this.profile.set(profile);
    this.setRole(profile.role === 'OWNER' ? 'owner' : 'professional');
  }

  private async loadProfile(): Promise<void> {
    try {
      const profile = await firstValueFrom(this.http.get<Profile>(`${API_URL}/auth/me`));
      this.applyProfile(profile);
    } catch {
      // Durante el registro todavía no existe: se ignora
    }
  }

  private toError(e: unknown, fallback: string): Error {
    if (e instanceof HttpErrorResponse) {
      if (e.status === 0) {
        return new Error('No se puede conectar con el servidor.');
      }
      const msg = e.error?.message;
      if (Array.isArray(msg)) return new Error(msg.join('. '));
      if (typeof msg === 'string') return new Error(msg);
    }
    return new Error(fallback);
  }

  getFriendlyErrorMessage(err: any): string {
    const code = err?.code || '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'auth/invalid-credential';
      case 'auth/email-already-in-use':
        return 'auth/email-already-in-use';
      case 'auth/weak-password':
        return 'auth/weak-password';
      case 'auth/invalid-email':
        return 'auth/invalid-email';
      case 'auth/missing-password':
        return 'auth/missing-password';
      case 'auth/too-many-requests':
        return 'auth/too-many-requests';
      case 'auth/network-request-failed':
        return 'auth/network-request-failed';
      default:
        return err?.message || 'auth/generic-error';
    }
  }
}