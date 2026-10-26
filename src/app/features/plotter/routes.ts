import type {CranculaRoutes} from '../../../model/crancula-routes';
import {PlotterListComponent} from './plotter-list/plotter-list.component';

export const plotterRoutes: CranculaRoutes = [
  {
    path: 'plotters',
    component: PlotterListComponent,
    title: 'Plotters',
    data: {path: '/plotters', showIn: {rail: true, icon: 'content_cut'}, translate: {title: 'PLOTTER.NAV'}},
  },
];
