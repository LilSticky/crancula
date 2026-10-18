import {NgTemplateOutlet} from '@angular/common';
import {ChangeDetectionStrategy, Component, computed, input, signal} from '@angular/core';
import {MatIcon} from '@angular/material/icon';
import {TranslatePipe} from '@ngx-translate/core';
import {type Fit, type FitNotes, noteName} from '@api/index';

/** How the selected Parts meet the Pipes: the counts of the Fit and, on request, the Fit Notes behind them. */
@Component({
  selector: 'cranc-tape-fit-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, MatIcon, NgTemplateOutlet],
  templateUrl: './tape-fit-card.component.html',
  styleUrl: './tape-fit-card.component.scss',
})
export class TapeFitCardComponent {
  readonly fit = input.required<Fit | null>();
  /** Ordered by Column, then Part. */
  readonly fitNotes = input.required<FitNotes>();
  /** The label of each Part, by index. */
  readonly partLabels = input.required<readonly string[]>();
  /** The Fit Note lists show only for a Transposition the form accepts. */
  readonly notesShown = input.required<boolean>();
  /** A new value (another Song or choice of Parts) closes both lists. */
  readonly disclosureKey = input<object>();

  protected readonly noteName = noteName;

  private readonly movedOpenedFor = signal<object | null | undefined>(null);
  private readonly unplayableOpenedFor = signal<object | null | undefined>(null);

  protected readonly movedOpen = computed(
    () => (this.fit()?.movedByOctaves ?? 0) > 0 && this.movedOpenedFor() === this.disclosureKey(),
  );
  protected readonly unplayableOpen = computed(
    () => (this.fit()?.unplayable ?? 0) > 0 && this.unplayableOpenedFor() === this.disclosureKey(),
  );

  protected toggleMoved(): void {
    this.movedOpenedFor.set(this.movedOpen() ? null : this.disclosureKey());
  }

  protected toggleUnplayable(): void {
    this.unplayableOpenedFor.set(this.unplayableOpen() ? null : this.disclosureKey());
  }
}
