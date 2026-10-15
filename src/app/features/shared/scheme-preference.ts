import {Injectable, signal} from '@angular/core';

export type Scheme = 'system' | 'light' | 'dark';

const SCHEME_KEY = 'crancula.scheme';
const SCHEME_CLASSES: Record<Exclude<Scheme, 'system'>, string> = {light: 'cr-light', dark: 'cr-dark'};

function isScheme(value: string | null): value is Scheme {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** The colour scheme the user picked, remembered in `localStorage` and applied as a class on `<html>`. */
@Injectable({providedIn: 'root'})
export class SchemePreference {
  private readonly current = signal<Scheme>(this.stored());

  readonly scheme = this.current.asReadonly();

  constructor() {
    this.apply(this.current());
  }

  choose(scheme: Scheme): void {
    localStorage.setItem(SCHEME_KEY, scheme);
    this.current.set(scheme);
    this.apply(scheme);
  }

  private stored(): Scheme {
    const stored = localStorage.getItem(SCHEME_KEY);
    return isScheme(stored) ? stored : 'system';
  }

  private apply(scheme: Scheme): void {
    const classes = document.documentElement.classList;
    classes.remove(SCHEME_CLASSES.light, SCHEME_CLASSES.dark);
    if (scheme !== 'system') classes.add(SCHEME_CLASSES[scheme]);
  }
}
