import {expect, test} from '@playwright/test';
import {launchApp} from './support/launch-app';
import {defineStreetOrgan} from './support/organ-editor';
import {resizeWindowOrSkip} from './support/window-size';

interface NoteField {
  readonly value: string;
  readonly contentWidth: number;
  readonly textWidth: number;
  readonly width: number;
}

/** Chromium draws the number spinner inside the input's content box; the digits must fit beside it. */
const SPINNER_ALLOWANCE = 15;

test.describe('Every MIDI note in the Pipe rack is fully readable', () => {
  for (const size of [{width: 1280, height: 800}, {width: 1024, height: 700}]) {
    test(`${size.width} x ${size.height}: each pipe-note input fits its value and all have the same width`, async () => {
      const launched = await launchApp();
      const {app, window} = launched;
      await resizeWindowOrSkip(launched, size.width, size.height, true);
      await defineStreetOrgan(window);
      await window.getByTestId('pipe-note').nth(30).fill('127');

      const fields: NoteField[] = await window.getByTestId('pipe-note').evaluateAll((inputs, spinner) => {
        const context = document.createElement('canvas').getContext('2d');
        if (!context) throw new Error('no canvas context');
        return inputs.map((input) => {
          if (!(input instanceof HTMLInputElement)) throw new Error('pipe-note is not an input');
          const style = getComputedStyle(input);
          context.font = style.font;
          const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
          return {
            value: input.value,
            contentWidth: input.clientWidth - padding - spinner,
            textWidth: context.measureText(input.value).width,
            width: input.getBoundingClientRect().width,
          };
        });
      }, SPINNER_ALLOWANCE);

      expect(fields.length).toBe(31);
      for (const field of fields) {
        expect(field.contentWidth, `note ${field.value}: content ${field.contentWidth}px < text ${field.textWidth}px`).toBeGreaterThanOrEqual(field.textWidth);
      }
      const widths = new Set(fields.map((field) => Math.round(field.width)));
      expect(Array.from(widths), 'pipe-note input widths differ').toHaveLength(1);
      await app.close();
    });
  }
});
