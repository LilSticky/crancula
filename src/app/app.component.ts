import {BreakpointObserver} from '@angular/cdk/layout';
import {Component, effect, inject, untracked} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {MatSidenav, MatSidenavContainer, MatSidenavContent} from '@angular/material/sidenav';
import {MatSnackBar} from '@angular/material/snack-bar';
import {RouterOutlet} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {firstValueFrom, map} from 'rxjs';
import {OrganLibrary} from './features/organ/organ-library.store';
import {TapeLibrary} from './features/tape/tape-library.store';
import {RailComponent} from './features/rail/rail.component';

/** Below this width the rail shrinks to icons (DESIGN-GUIDE: Layout and navigation). */
const COMPACT_QUERY = '(max-width: 1179.98px)';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'app-root',
  template: `
    <mat-sidenav-container>
      <mat-sidenav mode="side" opened disableClose [class.cr-compact]="compact()">
        <cranc-rail [compact]="compact()"/>
      </mat-sidenav>
      <mat-sidenav-content class="page" [class.cr-compact]="compact()">
        <router-outlet/>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    :host { position: fixed; inset: 0; }
    mat-sidenav-container { height: 100%; }
    .page { box-sizing: border-box; padding: 32px; }
    .page.cr-compact { padding: 24px; }
  `,
  imports: [RouterOutlet, RailComponent, MatSidenav, MatSidenavContainer, MatSidenavContent],
})
export class AppComponent {
  private readonly library = inject(OrganLibrary);
  private readonly tapes = inject(TapeLibrary);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly breakpoints = inject(BreakpointObserver);

  protected readonly compact = toSignal(this.breakpoints.observe(COMPACT_QUERY).pipe(map((state) => state.matches)), {
    initialValue: this.breakpoints.isMatched(COMPACT_QUERY),
  });

  constructor() {
    // Storage problems are reported to the user (spec FR-014, FR-015). Notifying is untracked: translating
    // reads signals of the translate service, which must not re-run the effect and report a problem twice.
    effect(() => {
      const problem = this.library.loadProblem();
      if (problem) untracked(() => void this.notify('ORGAN.STORAGE.LOAD_PROBLEM', {backupPath: problem.backupPath}));
    });
    effect(() => {
      const problem = this.library.saveProblem();
      if (problem) untracked(() => void this.notify('ORGAN.STORAGE.SAVE_PROBLEM', {reason: problem.reason}));
    });
    effect(() => {
      const problem = this.tapes.loadProblem();
      if (problem) untracked(() => void this.notify('TAPE.STORAGE.LOAD_PROBLEM', {backupPath: problem.backupPath}));
    });
    effect(() => {
      const problem = this.tapes.saveProblem();
      if (problem) untracked(() => void this.notify('TAPE.STORAGE.SAVE_PROBLEM', {reason: problem.reason}));
    });
  }

  private async notify(key: string, params: Record<string, string>): Promise<void> {
    const [message, dismiss] = await Promise.all([
      firstValueFrom(this.translate.get(key, params)) as Promise<string>,
      firstValueFrom(this.translate.get('ORGAN.STORAGE.DISMISS')) as Promise<string>,
    ]);
    this.snackBar.open(message, dismiss);
  }
}
