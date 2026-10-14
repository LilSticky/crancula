import {Component, effect, inject, untracked} from '@angular/core';
import {MatSnackBar} from '@angular/material/snack-bar';
import {RouterOutlet} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {firstValueFrom} from 'rxjs';
import {OrganLibrary} from './features/organ/organ-library.store';
import {TapeLibrary} from './features/tape/tape-library.store';
import {NavbarComponent} from './features/navbar/navbar.component';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'app-root',
  template: `
    <cranc-navbar/>
    <div class="page-container">
      <router-outlet/>
    </div>
  `,
  styles: `
    .page-container {
      width: 80%;
      margin: auto;
    }
  `,
  imports: [RouterOutlet, NavbarComponent],
})
export class AppComponent {
  private readonly library = inject(OrganLibrary);
  private readonly tapes = inject(TapeLibrary);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

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
