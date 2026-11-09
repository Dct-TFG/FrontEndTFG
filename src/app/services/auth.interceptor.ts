import { HttpInterceptorFn } from '@angular/common/http';
import { from, switchMap } from 'rxjs';
import { auth } from '../firebase.config';
import { API_URL } from '../api.config';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const user = auth.currentUser;
  if (!req.url.startsWith(API_URL) || !user) {
    return next(req);
  }
  return from(user.getIdToken()).pipe(
    switchMap((token) =>
      next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))
    )
  );
};