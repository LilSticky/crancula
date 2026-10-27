import type {CranculaRoutes} from '../../../model/crancula-routes';
import {TapeImportComponent} from './tape-import/tape-import.component';
import {SideBySideComponent} from './side-by-side/side-by-side.component';
import {TapeListComponent} from './tape-list/tape-list.component';
import {TapeViewComponent} from './tape-view/tape-view.component';

export const tapeRoutes: CranculaRoutes = [
  {
    path: 'tapes',
    component: TapeListComponent,
    title: 'Tapes',
    data: {path: '/tapes', showIn: {rail: true, icon: 'receipt_long'}, translate: {title: 'TAPE.NAV'}},
  },
  {
    path: 'tapes/new',
    component: TapeImportComponent,
    title: 'New Tape',
    data: {path: '/tapes/new', showIn: {rail: false}, translate: {title: 'TAPE.IMPORT.TITLE'}},
  },
  {
    path: 'tapes/side-by-side',
    component: SideBySideComponent,
    title: 'Cut side by side',
    data: {path: '/tapes/side-by-side', showIn: {rail: false}, translate: {title: 'TAPE.SIDE_BY_SIDE.TITLE'}},
  },
  {path: 'tapes/:id', component: TapeViewComponent},
];
