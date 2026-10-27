import {describe, expectTypeOf, it} from 'vitest';
import type {
  CranculaApi,
  OrganLibraryLoadResult,
  OrganLibrarySaveResult,
  ScoresSaveRequest,
  ScoresSaveResult,
  SetLanguageResult,
  SvgSaveRequest,
  SvgSaveResult,
  TapeLibraryLoadResult,
  TapeLibrarySaveResult,
} from './crancula-api';
import type {TapeLibrarySnapshot} from '../tape/tape-library-snapshot';
import type {OrganLibrarySnapshot} from '../organ/organ-library-snapshot';
import type {Language} from './language';
import type {EditCommand} from './edit-command';
import * as api from '../index';

describe('CranculaApi', () => {
  it('loads and saves the Organ library', () => {
    expectTypeOf<CranculaApi['organs']['load']>().toEqualTypeOf<() => Promise<OrganLibraryLoadResult>>();
    expectTypeOf<CranculaApi['organs']['save']>().toEqualTypeOf<
      (snapshot: OrganLibrarySnapshot) => Promise<OrganLibrarySaveResult>
    >();
  });

  it('loads and saves the Tape library', () => {
    expectTypeOf<CranculaApi['tapes']['load']>().toEqualTypeOf<() => Promise<TapeLibraryLoadResult>>();
    expectTypeOf<CranculaApi['tapes']['save']>().toEqualTypeOf<
      (snapshot: TapeLibrarySnapshot) => Promise<TapeLibrarySaveResult>
    >();
  });

  it('describes every Tape library load outcome', () => {
    expectTypeOf<TapeLibraryLoadResult>().toEqualTypeOf<
      | {readonly status: 'loaded'; readonly snapshot: TapeLibrarySnapshot}
      | {readonly status: 'empty'}
      | {readonly status: 'unreadable'; readonly backupPath: string; readonly reason: string}
    >();
  });

  it('describes every Tape library save outcome', () => {
    expectTypeOf<TapeLibrarySaveResult>().toEqualTypeOf<
      | {readonly status: 'saved'}
      | {readonly status: 'rejected'; readonly reason: string}
      | {readonly status: 'failed'; readonly reason: string}
    >();
  });

  it('saves the Plotter file', () => {
    expectTypeOf<CranculaApi['plotter']['saveSvg']>().toEqualTypeOf<
      (request: SvgSaveRequest) => Promise<SvgSaveResult>
    >();
  });

  it('describes every Plotter file save outcome', () => {
    expectTypeOf<SvgSaveResult>().toEqualTypeOf<
      | {readonly status: 'saved'; readonly filePath: string}
      | {readonly status: 'cancelled'}
      | {readonly status: 'rejected'; readonly reason: string}
      | {readonly status: 'failed'; readonly reason: string}
    >();
  });

  it('saves the Scores file', () => {
    expectTypeOf<CranculaApi['scores']['save']>().toEqualTypeOf<
      (request: ScoresSaveRequest) => Promise<ScoresSaveResult>
    >();
  });

  it('describes every Scores file save outcome', () => {
    expectTypeOf<ScoresSaveResult>().toEqualTypeOf<
      | {readonly status: 'saved'; readonly filePath: string}
      | {readonly status: 'cancelled'}
      | {readonly status: 'rejected'; readonly reason: string}
      | {readonly status: 'failed'; readonly reason: string}
    >();
  });

  it('sets the language of the application menu', () => {
    expectTypeOf<CranculaApi['app']['setLanguage']>().toEqualTypeOf<
      (language: Language) => Promise<SetLanguageResult>
    >();
  });

  it('subscribes to Edit Commands and returns the unsubscribe function', () => {
    expectTypeOf<CranculaApi['edit']['onCommand']>().toEqualTypeOf<
      (listener: (command: EditCommand) => void) => () => void
    >();
  });

  it('describes every set-language outcome', () => {
    expectTypeOf<SetLanguageResult>().toEqualTypeOf<
      {readonly status: 'set'} | {readonly status: 'rejected'; readonly reason: string}
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
