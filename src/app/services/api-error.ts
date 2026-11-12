import { HttpErrorResponse } from '@angular/common/http';

export function toApiError(e: unknown, fallback: string): Error {
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