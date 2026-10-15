import type {CranculaRoutes} from '../../../model/crancula-routes';
import {leaveUnsavedGuard} from './leave-unsaved.guard';
import {OrganEditorComponent} from './organ-editor/organ-editor.component';
import {OrganListComponent} from './organ-list/organ-list.component';

export const organRoutes: CranculaRoutes = [
  {
    path: 'organs',
    component: OrganListComponent,
    title: 'Organs',
    data: {path: '/organs', showIn: {rail: true, icon: 'piano'}, translate: {title: 'ORGAN.NAV'}},
  },
  {path: 'organs/new', component: OrganEditorComponent, canDeactivate: [leaveUnsavedGuard]},
  {path: 'organs/:id', component: OrganEditorComponent, canDeactivate: [leaveUnsavedGuard]},
];
