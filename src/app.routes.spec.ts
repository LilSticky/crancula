import {NotFoundPage} from './app/features/not-found/not-found.page';
import {routes} from './app.routes';

describe('app routes', () => {
  it('redirects the empty path to the Organ list', () => {
    const start = routes.find((route) => route.path === '');

    expect(start?.redirectTo).toBe('organs');
    expect(start?.pathMatch).toBe('full');
  });

  it('has no home route', () => {
    expect(routes.some((route) => route.path === 'home')).toBe(false);
    expect(routes.some((route) => route.redirectTo === 'home')).toBe(false);
  });

  it('sends unknown paths to the not found page', () => {
    const fallback = routes.find((route) => route.path === '**');

    expect(fallback?.component).toBe(NotFoundPage);
  });
});
