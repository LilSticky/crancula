import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {form} from '@angular/forms/signals';
import {type PlotterDraft} from '@api/index';
import {isPlotterFieldError, type PlotterFieldError, plotterFormSchema} from './plotter-form';

function plotterForm(draft: PlotterDraft) {
  return TestBed.runInInjectionContext(() => form(signal(draft), plotterFormSchema));
}

function plotterErrors(errors: readonly unknown[]): PlotterFieldError[] {
  return errors.filter(isPlotterFieldError);
}

/** A sheet Plotter as the editor holds it: 300 mm long, 120 mm wide, 20 mm Overlap. */
const sheetDraft: PlotterDraft = {name: 'Cutting mat', workingWidth: 120, roll: false, workingLength: 300, overlap: 20};

describe('plotterFormSchema', () => {
  it('reports no error for a valid sheet Plotter', () => {
    const root = plotterForm(sheetDraft);

    expect(root().valid()).toBe(true);
    expect(root().errorSummary()).toEqual([]);
  });

  it('reports no error for a roll Plotter that has no working length and no Overlap', () => {
    const root = plotterForm({name: 'Vinyl cutter', workingWidth: 120, roll: true, workingLength: null, overlap: null});

    expect(root().valid()).toBe(true);
  });

  it('puts a violation on the field its path names', () => {
    const root = plotterForm({...sheetDraft, name: ' '});

    expect(plotterErrors(root.name().errors()).map(({kind}) => kind)).toEqual(['name-required']);
    expect(root().valid()).toBe(false);
  });

  it('asks for a working length that a sheet Plotter lacks', () => {
    const root = plotterForm({...sheetDraft, workingLength: null});

    expect(plotterErrors(root.workingLength().errors()).map(({kind}) => kind)).toEqual(['value-required']);
  });

  it('puts an Overlap as long as the working length on the Overlap field, with the working length', () => {
    const root = plotterForm({...sheetDraft, overlap: 300});

    const [error] = plotterErrors(root.overlap().errors());

    expect(error?.kind).toBe('overlap-not-below-working-length');
    expect(error?.violation.params).toEqual({workingLength: 300});
    expect(root.workingLength().errors()).toEqual([]);
  });
});
