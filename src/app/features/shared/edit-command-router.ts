import {Injectable, NgZone, inject} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import type {EditCommand} from '@api/index';
import {CRANCULA_API} from '../../core/crancula-api.token';

/** Receives an Edit Command that the open view should carry out. */
export type EditCommandHandler = (command: EditCommand) => void;

/** Input types that take typed text; Undo and Redo belong to the text in them. */
const TEXT_INPUT_TYPES: ReadonlySet<string> = new Set(['text', 'search', 'url', 'tel', 'email', 'password', 'number']);

/** Contenteditable elements; jsdom lacks `isContentEditable`, so the attribute is read instead. */
const CONTENT_EDITABLE = '[contenteditable]:not([contenteditable="false"])';

/** Whether the element takes typed text, so that Undo and Redo belong to the text rather than the open view. */
function isTextField(element: Element | null): boolean {
  if (element instanceof HTMLTextAreaElement) return !element.readOnly;
  if (element instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(element.type) && !element.readOnly;
  return element?.matches(CONTENT_EDITABLE) ?? false;
}

/**
 * Routes the Edit Commands of the application menu (ADR 4) to the view that is open. Each command goes to the
 * registered handler, or to the text history when the user is typing or a dialog is open.
 */
@Injectable({providedIn: 'root'})
export class EditCommandRouter {
  private readonly api = inject(CRANCULA_API);
  private readonly dialog = inject(MatDialog);
  private readonly zone = inject(NgZone);
  private handler: EditCommandHandler | undefined;

  constructor() {
    // The IPC callback arrives outside the Angular zone; running the dispatch inside it keeps change detection current.
    this.api.edit.onCommand((command) => this.zone.run(() => this.route(command)));
  }

  /** Makes the handler the target of Edit Commands; the returned function takes it back. */
  register(handler: EditCommandHandler): () => void {
    this.handler = handler;
    return () => {
      if (this.handler === handler) this.handler = undefined;
    };
  }

  private route(command: EditCommand): void {
    if (this.handler === undefined || this.isEditingText() || this.dialog.openDialogs.length > 0) {
      // execCommand is deprecated but still runs Chromium's editor undo; webContents.undo()/redo() in main is the replacement.
      document.execCommand(command);
      return;
    }
    this.handler(command);
  }

  private isEditingText(): boolean {
    return isTextField(document.activeElement);
  }
}
