import type {CranculaRoutes} from '../../../model/crancula-routes';
import {TapeImportComponent} from './tape-import/tape-import.component';
import {TapeViewComponent} from './tape-view/tape-view.component';

export const tapeRoutes: CranculaRoutes = [
  {
    path: 'tapes/new',
    component: TapeImportComponent,
    title: 'New Tape',
    data: {path: '/tapes/new', showIn: {navbar: true}, translate: {title: 'TAPE.NAV'}},
  },
  {path: 'tapes/:id', component: TapeViewComponent},
];
