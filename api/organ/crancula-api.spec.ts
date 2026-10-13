import {describe, expectTypeOf, it} from 'vitest';
import type {CranculaApi, OrganLibraryLoadResult, OrganLibrarySaveResult} from './crancula-api';
import type {OrganLibrarySnapshot} from './organ-library-snapshot';
import * as api from '../index';

describe('CranculaApi', () => {
  it('loads and saves the Organ library', () => {
    expectTypeOf<CranculaApi['organs']['load']>().toEqualTypeOf<() => Promise<OrganLibraryLoadResult>>();
    expectTypeOf<CranculaApi['organs']['save']>().toEqualTypeOf<
      (snapshot: OrganLibrarySnapshot) => Promise<OrganLibrarySaveResult>
    >();
  });

  it('describes every load outcome', () => {
    expectTypeOf<OrganLibraryLoadResult>().toEqualTypeOf<
      | {readonly status: 'loaded'; readonly snapshot: OrganLibrarySnapshot}
      | {readonly status: 'empty'}
      | {readonly status: 'unreadable'; readonly backupPath: string; readonly reason: string}
    >();
  });

  it('describes every save outcome', () => {
    expectTypeOf<OrganLibrarySaveResult>().toEqualTypeOf<
      | {readonly status: 'saved'}
      | {readonly status: 'rejected'; readonly reason: string}
      | {readonly status: 'failed'; readonly reason: string}
    >();
  });

  it('is exported from @api together with the Organ domain', () => {
    expectTypeOf(api.validateOrgan).toBeFunction();
    expectTypeOf(api.parseOrganLibrarySnapshot).toBeFunction();
    expectTypeOf(api.noteName).toBeFunction();
    expectTypeOf<api.CranculaApi>().toEqualTypeOf<CranculaApi>();
  });
});
