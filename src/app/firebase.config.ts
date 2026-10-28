import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDovqoo_3R-3HkseN_JeiWguo-zBhYFxMA',
  authDomain: 'tfg-fib-41049.firebaseapp.com',
  projectId: 'tfg-fib-41049',
  storageBucket: 'tfg-fib-41049.firebasestorage.app',
  messagingSenderId: '891399900492',
  appId: '1:891399900492:web:6a69eb093a0843cba253e9',
  measurementId: 'G-SN4PJ37LJE'
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

if (typeof window !== 'undefined') {
  isSupported()
    .then(supported => {
      if (supported) {
        getAnalytics(app);
      }
    })
    .catch(() => {});
}
