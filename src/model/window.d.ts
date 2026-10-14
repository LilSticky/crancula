import type {CranculaApi} from '@api/index';

declare global {
  interface Window {
    /** Exposed by the Electron preload script (`app/preload.ts`); absent in the browser dev server. */
    crancula?: CranculaApi;
  }
}
