import { Component, HostListener, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  PermissionLevel,
  PermissionsService,
  PetPermission,
  VeterinaryService
} from '../../services/permissions.service';

type Feedback = { type: 'success' | 'error'; text: string };

@Component({
  selector: 'app-pet-access-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './pet-access-dialog.html',
  styleUrl: './pet-access-dialog.css'
})
export class PetAccessDialog implements OnInit, OnDestroy {
  private readonly permissionsService = inject(PermissionsService);
  private readonly translate = inject(TranslateService);

  readonly petId = input.required<string>();
  readonly petName = input.required<string>();
  readonly closed = output<void>();

  readonly permissions = signal<PetPermission[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);

  readonly query = signal('');
  readonly results = signal<VeterinaryService[]>([]);
  readonly searching = signal(false);
  readonly searchError = signal(false);

  readonly pendingLevel = signal<Record<string, PermissionLevel>>({});
  readonly busyEntity = signal<string | null>(null);
  readonly confirmingRevoke = signal<string | null>(null);
  readonly feedback = signal<Feedback | null>(null);

  readonly grantedIds = computed(() => new Set(this.permissions().map((p) => p.entityId)));

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  ngOnInit(): void {
    void this.loadPermissions();
    void this.runSearch('');
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
  }

  @HostListener('document:keydown.escape')
  close(): void {
    if (this.busyEntity()) return;
    this.closed.emit();
  }

  async loadPermissions(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      this.permissions.set(await this.permissionsService.list(this.petId()));
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.runSearch(value), 300);
  }

  async runSearch(value: string): Promise<void> {
    this.searching.set(true);
    this.searchError.set(false);
    try {
      const found = await this.permissionsService.search(value);
      if (value === this.query()) this.results.set(found);
    } catch {
      this.searchError.set(true);
    } finally {
      this.searching.set(false);
    }
  }

  levelFor(entityId: string): PermissionLevel {
    return this.pendingLevel()[entityId] ?? 'VIEW';
  }

  setPendingLevel(entityId: string, level: PermissionLevel): void {
    this.pendingLevel.update((levels) => ({ ...levels, [entityId]: level }));
  }

  async grant(service: VeterinaryService): Promise<void> {
    const level = this.levelFor(service.entityId);
    await this.save(service.entityId, async () => {
      const saved = await this.permissionsService.grant(this.petId(), service.entityId, level);
      this.permissions.update((list) => [...list, saved]);
      return this.message(level === 'EDIT' ? 'grantedEdit' : 'grantedView', service.name);
    });
  }

  async changeLevel(permission: PetPermission, level: PermissionLevel): Promise<void> {
    if (level === permission.level) return;
    await this.save(permission.entityId, async () => {
      const saved = await this.permissionsService.grant(this.petId(), permission.entityId, level);
      this.permissions.update((list) =>
        list.map((p) => (p.entityId === saved.entityId ? saved : p))
      );
      return this.message(level === 'EDIT' ? 'changedEdit' : 'changedView', permission.name);
    });
  }

  async revoke(permission: PetPermission): Promise<void> {
    this.confirmingRevoke.set(null);
    await this.save(permission.entityId, async () => {
      await this.permissionsService.revoke(this.petId(), permission.entityId);
      this.permissions.update((list) => list.filter((p) => p.entityId !== permission.entityId));
      return this.message('revoked', permission.name);
    });
  }

  private async save(entityId: string, action: () => Promise<string>): Promise<void> {
    this.busyEntity.set(entityId);
    this.feedback.set(null);
    try {
      this.feedback.set({ type: 'success', text: await action() });
    } catch (e) {
      const offline = e instanceof HttpErrorResponse && e.status === 0;
      this.feedback.set({
        type: 'error',
        text: this.translate.instant(offline ? 'dashboard.state.offline' : 'dashboard.access.errorSave')
      });
    } finally {
      this.busyEntity.set(null);
    }
  }

  private message(key: string, name: string): string {
    return this.translate.instant(`dashboard.access.${key}`, { name, pet: this.petName() });
  }
}
