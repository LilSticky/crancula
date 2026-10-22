import {Injectable, inject} from '@angular/core';
import type {EditCommand} from '@api/index';
import {CRANCULA_API} from '../../core/crancula-api.token';

/** Takes the Edit Commands the application menu sends and gives each to the handler of the open view, or to the text history. */
export type EditCommandHandler = (command: EditCommand) => void;

/** Where the focus means the user is typing text, so Undo and Redo belong to the text. */
const EDITABLE_FOCUS = 'input, textarea, [contenteditable]';

/** Routes the Edit Commands of the application menu (ADR 4) to the view that is open. */
@Injectable({providedIn: 'root'})
export class EditCommandRouter {
  private readonly api = inject(CRANCULA_API);
  private handler: EditCommandHandler | undefined;

  constructor() {
    this.api.edit.onCommand((command) => this.route(command));
  }

  /** Makes the handler the target of Edit Commands; the returned function takes it back. */
  register(handler: EditCommandHandler): () => void {
    this.handler = handler;
    return () => {
      if (this.handler === handler) this.handler = undefined;
    };
  }

  private route(command: EditCommand): void {
    if (this.handler === undefined || this.isEditingText()) {
      document.execCommand(command);
      return;
    }
    this.handler(command);
  }

  private isEditingText(): boolean {
    return document.activeElement?.matches(EDITABLE_FOCUS) ?? false;
  }
}
