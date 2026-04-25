import {CranculaRoutes} from "../../../../model/crancula-routes";
import {OrgansPage} from "./organ/list/organs.page";
import {OrganPage} from "./organ/id/organ.page";

export const ORGAN_BASE_PATH = 'organ'
export const organRoutes: CranculaRoutes = [
  {
    path: ORGAN_BASE_PATH,
    children: [
      {
        path: 'list',
        component: OrgansPage,
        pathMatch: "full",
        title: "Organs",
        data: {
          path: '/organ/list',
          showIn: {
            navbar: true
          },
          translate: {
            title: 'PAGES.ORGANS.TITLE'
          }
        }
      },
      {
        path: 'new',
        component: OrganPage,
        pathMatch: "full",
        title: "New Organ"
      },
      {
        path: ':id',
        component: OrganPage,
        pathMatch: "full",
        title: "Organ"
      }
    ]
  }];
