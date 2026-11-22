import { Species } from '../services/pets.service';

export function petAge(birthDate: string): { key: string; count: number } {
  const birth = new Date(birthDate);
  const now = new Date();
  let months =
    (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 + (now.getUTCMonth() - birth.getUTCMonth());
  if (now.getUTCDate() < birth.getUTCDate()) months--;

  if (months < 1) return { key: 'dashboard.pets.age.newborn', count: 0 };
  if (months < 12) {
    return { key: months === 1 ? 'dashboard.pets.age.month' : 'dashboard.pets.age.months', count: months };
  }
  const years = Math.floor(months / 12);
  return { key: years === 1 ? 'dashboard.pets.age.year' : 'dashboard.pets.age.years', count: years };
}

export function speciesIcon(species: Species): string {
  switch (species) {
    case 'DOG':
      return 'images/vector-65.svg';
    case 'CAT':
      return 'images/vector-69.svg';
    case 'BIRD':
      return 'images/vector-73.svg';
    case 'SMALL_MAMMAL':
      return 'images/vector-77.svg';
    default:
      return 'images/vector-35.svg';
  }
}

export function localeFor(lang: string): string {
  return lang === 'ca' ? 'ca-ES' : lang === 'en' ? 'en-GB' : 'es-ES';
}

export function localIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatLongDate(iso: string, lang: string): string {
  return new Intl.DateTimeFormat(localeFor(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(iso));
}
