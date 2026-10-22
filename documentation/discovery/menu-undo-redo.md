# Menu Undo and Redo act on the Tape (#122)

Today *Edit → Undo/Redo* use Electron's `undo`/`redo` roles, which run Chromium's text undo. Clicking
them with the mouse in the Tape view does nothing to the Tape.

## Design

- **Menu (main process)**: the Undo and Redo items lose their roles. They get ids `undo`/`redo`, the
  labels as before, an accelerator (`CmdOrCtrl+Z`; Redo `Shift+CmdOrCtrl+Z` on macOS, `Ctrl+Y` elsewhere)
  and a `click` that sends the Edit Command to the focused window's `webContents` on channel
  `edit:command` with payload `'undo' | 'redo'`.
- **Keyboard stays where it is**: on Windows and Linux the accelerator is shown but
  `registerAccelerator: false`, so keys still reach the renderer as today (text fields and the Tape view's
  own shortcuts). On macOS the accelerator is registered (the Edit menu is the macOS route for these keys),
  so keys arrive through the same IPC path.
- **Preload (ADR 4)**: `crancula.edit.onCommand(listener: (command: EditCommand) => void): () => void`.
  It listens only on `edit:command`, drops any payload that is not `'undo'` or `'redo'`, and returns an
  unsubscribe function. `EditCommand` lives in `api/app/`.
- **Renderer routing** (root service in `src/app/features/shared/`): on an Edit Command, if the focused
  element is editable text (`input`, `textarea`, `contenteditable`) or no Tape handler is registered, it
  runs the text command (`document.execCommand(command)`); otherwise it calls the registered handler.
  The Tape view registers its undo/redo while it is open and unregisters on destroy.
  - Text fields are textareas, inputs of a text-like type (text, search, url, tel, email, password, number)
    that are not read-only, and `contenteditable` elements other than `contenteditable="false"`.
  - While a dialog is open, the Tape behind it is never undone; the text command runs instead.
  - The router is created at app start (`provideAppInitializer`), so text fields anywhere get menu Undo.
  - `document.execCommand` is deprecated but runs Chromium's editor undo; `webContents.undo()/redo()` in
    main is the replacement if it goes away.
- **macOS**: not tried on a Mac yet. Cmd+Z there goes through the registered accelerator and this IPC path.

## Tests

- Unit: menu items (ids, accelerators per platform, `registerAccelerator`, click sends on `edit:command`);
  preload payload filter; routing service (editable focus → text command, handler → Tape, none → text).
- Component: the Tape view undoes/redoes on an Edit Command.
- E2E: open a Tape, move a Hole, click the menu item via `Menu.getApplicationMenu().getMenuItemById('undo').click()`,
  the Hole is back; Redo moves it again.
