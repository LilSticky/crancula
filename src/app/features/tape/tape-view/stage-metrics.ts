import {effect, signal, type ElementRef, type Signal} from '@angular/core';

/** The width to render Columns for: the scroll area, but never narrower than the screen (it is 0 before layout). */
function windowWidth(element: HTMLElement): number {
  return Math.max(element.clientWidth, window.innerWidth);
}

/**
 * The size and scroll position of the stage (the scrolling area around the Tape), as signals.
 * Call in an injection context: it watches the size of the scroll element with a ResizeObserver.
 */
export function stageMetrics(scrollElement: Signal<ElementRef<HTMLElement> | undefined>) {
  const stageWidth = signal(0);
  const stageClientWidth = signal(0);
  const stageScrollWidth = signal(0);
  const scrollLeft = signal(0);
  const clientWidth = signal(0);

  const readStage = (element: HTMLElement): void => {
    stageClientWidth.set(element.clientWidth);
    stageScrollWidth.set(element.scrollWidth);
  };

  effect((onCleanup) => {
    const element = scrollElement()?.nativeElement;
    if (element === undefined) return;
    clientWidth.set(windowWidth(element));
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) stageWidth.set(width);
    });
    observer.observe(element);
    onCleanup(() => observer.disconnect());
  });

  return {
    stageWidth: stageWidth.asReadonly(),
    stageClientWidth: stageClientWidth.asReadonly(),
    stageScrollWidth: stageScrollWidth.asReadonly(),
    scrollLeft: scrollLeft.asReadonly(),
    clientWidth: clientWidth.asReadonly(),
    readStage,
    onScroll(element: HTMLElement): void {
      scrollLeft.set(element.scrollLeft);
      clientWidth.set(windowWidth(element));
      readStage(element);
    },
  };
}
