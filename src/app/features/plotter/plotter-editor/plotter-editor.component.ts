import {ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal, untracked} from '@angular/core';
import {type FieldTree, form, FormField} from '@angular/forms/signals';
import {ErrorStateMatcher} from '@angular/material/core';
import {MatButton} from '@angular/material/button';
import {MatCard} from '@angular/material/card';
import {MatError, MatFormField, MatHint, MatInput, MatLabel, MatSuffix} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {MatOption, MatSelect} from '@angular/material/select';
import {MatSlideToggle} from '@angular/material/slide-toggle';
import {Router} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {draftOf, emptyPlotterDraft, newPlotterId, type PlotterDraft, type PlotterViolation, validatePlotter} from '@api/index';
import {DecimalInputDirective} from '../../shared/decimal-input.directive';
import {PageHeadComponent} from '../../shared/components/page-head/page-head.component';
import type {LeaveProblem, UnsavedChanges, UnsavedChangesCheck} from '../../shared/leave-unsaved/leave-unsaved.guard';
import {PlotterLibrary} from '../plotter-library.store';
import {PLOTTER_FIELD_LABEL_KEYS, plotterFormSchema, shownMessages, ShownViolationMatcher, violationText} from './plotter-form';

/** The Plotter editor: describes a new Plotter, or edits the stored one whose id the route gives. */
@Component({
  selector: 'cranc-plotter-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, MatButton, MatCard, MatError, MatFormField, MatHint, MatIcon, MatInput, MatLabel, MatOption, MatSelect,
    MatSlideToggle, MatSuffix, FormField, DecimalInputDirective, PageHeadComponent],
  templateUrl: './plotter-editor.component.html',
  providers: [{provide: ErrorStateMatcher, useClass: ShownViolationMatcher}],
  styles: `
    mat-card {
      padding: 20px;
    }

    /* The Organ editor's field grid: two columns, the roll switch and the name across both. */
    .fields {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 16px;
      row-gap: 20px;
      margin-top: 16px;
    }

    @media (max-width: 1180px) {
      .fields {
        grid-template-columns: minmax(0, 1fr);
        row-gap: 12px;
      }
    }

    .full-width {
      grid-column: 1 / -1;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      padding-top: 8px;
    }
  `,
})
export class PlotterEditorComponent implements UnsavedChangesCheck {
  /** Route parameter; absent for a new Plotter. */
  readonly id = input<string>();

  private readonly library = inject(PlotterLibrary);
  private readonly router = inject(Router);

  /** The Plotter as it was when opened: the stored one, or a new one with its id already assigned. */
  private readonly opened = computed<PlotterDraft>(() => {
    const id = this.id();
    const stored = id ? untracked(() => this.library.entityMap()[id]) : undefined;
    return stored ? draftOf(stored) : {...emptyPlotterDraft(), id: newPlotterId()};
  });

  /** The Plotter as entered; may be invalid. */
  private readonly draft = linkedSignal<PlotterDraft>(() => this.opened());

  /** The last saved version of the draft: what "unchanged" is measured against. */
  private readonly saved = linkedSignal<PlotterDraft>(() => this.opened());

  private readonly changed = computed(() => JSON.stringify(this.draft()) !== JSON.stringify(this.saved()));

  /** The inputs bind to this form; its one rule is `validatePlotter`, reported at the fields. */
  protected readonly plotter: FieldTree<PlotterDraft> = form(this.draft, plotterFormSchema);

  protected readonly saving = signal(false);

  /** Save is unavailable while the Plotter is invalid or a save is running. */
  protected readonly saveDisabled = computed(() => this.saving() || !this.plotter().valid());

  protected readonly shownMessages = shownMessages;

  /** What leaving would lose (spec FR-012a), or `null` when there is no unsaved change. */
  unsavedChanges(): UnsavedChanges | null {
    if (!this.changed()) return null;
    const result = validatePlotter(this.draft());
    return {problems: result.ok ? [] : result.error.map(toProblem)};
  }

  /** Leaves the editor for the Plotter list without storing the Plotter. */
  protected cancel(): void {
    void this.router.navigate(['/plotters']);
  }

  /** Stores the valid Plotter and returns to the Plotter list. */
  protected async save(): Promise<void> {
    const sent = this.draft();
    const result = validatePlotter(sent);
    if (!result.ok || this.saving()) return;
    this.saving.set(true);
    try {
      // A failed write leaves the Plotter unsaved: stay here. The app reports the save problem (as for Organs).
      if (!(await this.library.put(result.value))) return;
      this.saved.set(sent);
      await this.router.navigate(['/plotters']);
    } finally {
      this.saving.set(false);
    }
  }
}

function toProblem(violation: PlotterViolation): LeaveProblem {
  return {field: {key: PLOTTER_FIELD_LABEL_KEYS[violation.path], params: {}}, message: violationText(violation)};
}
