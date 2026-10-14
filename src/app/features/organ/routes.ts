import type {CranculaRoutes} from '../../../model/crancula-routes';
import {leaveInvalidGuard} from './leave-invalid.guard';
import {OrganEditorComponent} from './organ-editor/organ-editor.component';
import {OrganListComponent} from './organ-list/organ-list.component';

export const organRoutes: CranculaRoutes = [
  {
    path: 'organs',
    component: OrganListComponent,
    title: 'Organs',
    data: {path: '/organs', showIn: {navbar: true}, translate: {title: 'ORGAN.NAV'}},
  },
  {path: 'organs/new', component: OrganEditorComponent, canDeactivate: [leaveInvalidGuard]},
  {path: 'organs/:id', component: OrganEditorComponent, canDeactivate: [leaveInvalidGuard]},
];
