import type {CranculaRoutes} from '../../../model/crancula-routes';
import {TapeImportComponent} from './tape-import/tape-import.component';
import {TapeListComponent} from './tape-list/tape-list.component';
import {TapeViewComponent} from './tape-view/tape-view.component';

export const tapeRoutes: CranculaRoutes = [
  {
    path: 'tapes',
    component: TapeListComponent,
    title: 'Tapes',
    data: {path: '/tapes', showIn: {navbar: true}, translate: {title: 'TAPE.NAV'}},
  },
  {
    path: 'tapes/new',
    component: TapeImportComponent,
    title: 'New Tape',
    data: {path: '/tapes/new', showIn: {navbar: false}, translate: {title: 'TAPE.IMPORT.TITLE'}},
  },
  {path: 'tapes/:id', component: TapeViewComponent},
];
