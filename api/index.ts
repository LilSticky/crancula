// noinspection ES6PreferShortImport

import {ProfilesApi, profilesRoutes} from "../api/profiles/routes";
import {ProfileApi, profileRoutes} from "../api/profile/routes";

export const apiRoutes = {
  ...profilesRoutes,
  ...profileRoutes
};

export type CranculaApi = ProfilesApi & ProfileApi;
