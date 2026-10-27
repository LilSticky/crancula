import {tapeRoutes} from './routes';
import {SideBySideComponent} from './side-by-side/side-by-side.component';

describe('tapeRoutes', () => {
  const sideBySide = () => tapeRoutes.find((route) => route.path === 'tapes/side-by-side');

  it('declares the side-by-side page before the Tape view, so its path is not read as a Tape id', () => {
    const paths = tapeRoutes.map((route) => route.path);

    expect(paths).toContain('tapes/side-by-side');
    expect(paths.indexOf('tapes/side-by-side')).toBeLessThan(paths.indexOf('tapes/:id'));
  });

  it('shows the side-by-side page on its route', () => {
    expect(sideBySide()?.component).toBe(SideBySideComponent);
  });

  it('titles the side-by-side page with TAPE.SIDE_BY_SIDE.TITLE', () => {
    expect(sideBySide()?.data?.translate).toEqual({title: 'TAPE.SIDE_BY_SIDE.TITLE'});
  });

  it('keeps the side-by-side page out of the rail', () => {
    expect(sideBySide()?.data?.showIn.rail).toBe(false);
  });
});
