import {InjectionToken} from '@angular/core';
import type {Platform} from './edit-keys';

function platformOf(userAgent: string): Platform {
  if (/Mac/i.test(userAgent)) return 'darwin';
  if (/Linux|X11/i.test(userAgent)) return 'linux';
  return 'win32';
}

/** The platform whose shortcuts the Tape view shows and reads; derived from the browser, fakeable in tests. */
export const PLATFORM = new InjectionToken<Platform>('PLATFORM', {
  providedIn: 'root',
  factory: () => platformOf(navigator.userAgent),
});
