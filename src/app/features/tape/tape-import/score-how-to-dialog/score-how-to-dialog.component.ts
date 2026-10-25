import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {MatButton} from '@angular/material/button';
import {MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle} from '@angular/material/dialog';
import {TranslatePipe} from '@ngx-translate/core';

/** Shows the way from a printed or PDF Score to a MusicXML file; closes with its Close button. */
@Component({
  selector: 'cranc-score-how-to-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButton, MatDialogActions, MatDialogContent, MatDialogTitle, TranslatePipe],
  templateUrl: './score-how-to-dialog.component.html',
})
export class ScoreHowToDialogComponent {
  protected readonly dialogRef = inject<MatDialogRef<ScoreHowToDialogComponent>>(MatDialogRef);

  protected close(): void {
    this.dialogRef.close();
  }
}
