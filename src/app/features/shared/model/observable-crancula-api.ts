import {defer, Observable} from 'rxjs';
import {CranculaApi} from "@api/index";

export type ObservableCranculaApi = {
  [K in keyof CranculaApi]: CranculaApi[K] extends (args: infer A) => Promise<infer R>
    ? (args?: A) => Observable<R>
    : never;
};

export function observableCranculaApi(api: CranculaApi = window.api): ObservableCranculaApi {
  return Object.entries(api)
    .reduce((previous: ObservableCranculaApi, [key, callback]: [string, (args: any) => Promise<any>]) =>
        ({
          ...previous,
          [key]: (args: typeof callback.arguments) => defer(() => callback(args))
        } as ObservableCranculaApi),
      {} as ObservableCranculaApi
    )
}
