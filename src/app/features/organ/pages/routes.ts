import {CranculaRoutes} from "../../../../model/crancula-routes";
import {OrgansPage} from "./organ/list/organs.page";
import {OrganPage} from "./organ/id/organ.page";

export const ORGAN_BASE_PATH = 'organ'
export const organRoutes: CranculaRoutes = [
  {
    path: ORGAN_BASE_PATH,
    children: [
      {
        path: '',
        component: OrgansPage,
        pathMatch: "full",
        title: "Organs",
        data: {
          path: '/organ',
          showIn: {
            navbar: true
          },
          translate: {
            title: 'PAGES.ORGANS.TITLE'
          }
        },
      },
      {
        path: ':id',
        component: OrganPage,
        title: "Organ"
      }
    ]
  }];
