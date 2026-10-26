import type {CranculaRoutes} from '../../../model/crancula-routes';
import {leaveUnsavedGuard} from '../shared/leave-unsaved/leave-unsaved.guard';
import {PlotterEditorComponent} from './plotter-editor/plotter-editor.component';
import {PlotterListComponent} from './plotter-list/plotter-list.component';

export const plotterRoutes: CranculaRoutes = [
  {
    path: 'plotters',
    component: PlotterListComponent,
    title: 'Plotters',
    data: {path: '/plotters', showIn: {rail: true, icon: 'content_cut'}, translate: {title: 'PLOTTER.NAV'}},
  },
  {path: 'plotters/new', component: PlotterEditorComponent, canDeactivate: [leaveUnsavedGuard]},
  {path: 'plotters/:id', component: PlotterEditorComponent, canDeactivate: [leaveUnsavedGuard]},
];
