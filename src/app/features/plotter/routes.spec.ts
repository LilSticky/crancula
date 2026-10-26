import {leaveUnsavedGuard} from '../shared/leave-unsaved/leave-unsaved.guard';
import {plotterRoutes} from './routes';

describe('plotterRoutes', () => {
  it.each(['plotters/new', 'plotters/:id'])('asks before leaving %s with unsaved changes', (path) => {
    const route = plotterRoutes.find((candidate) => candidate.path === path);

    expect(route?.canDeactivate).toEqual([leaveUnsavedGuard]);
  });
});
