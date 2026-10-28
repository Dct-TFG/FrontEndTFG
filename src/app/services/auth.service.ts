import { Injectable, signal } from '@angular/core';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User,
  UserCredential
} from 'firebase/auth';
import { auth } from '../firebase.config';

export type UserRole = 'owner' | 'professional';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly auth = auth;
  readonly currentUser = signal<User | null>(null);
  readonly selectedRole = signal<UserRole>('owner');

  constructor() {
    // Listen to Firebase auth state changes
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser.set(user);
    });

    // Restore saved role preference if available
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
    return await signInWithEmailAndPassword(this.auth, email.trim(), password);
  }

  async register(email: string, password: string, displayName?: string, role: UserRole = 'owner'): Promise<UserCredential> {
    const cred = await createUserWithEmailAndPassword(this.auth, email.trim(), password);
    if (displayName && cred.user) {
      await updateProfile(cred.user, { displayName });
    }
    this.setRole(role);
    return cred;
  }

  async resetPassword(email: string): Promise<void> {
    return await sendPasswordResetEmail(this.auth, email.trim());
  }

  async logout(): Promise<void> {
    return await signOut(this.auth);
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
