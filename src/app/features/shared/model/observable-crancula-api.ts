import {defer, map, Observable} from 'rxjs';
import {CranculaApi} from "@api/index";

export type ObservableCranculaApi = {
  [K in keyof CranculaApi]: CranculaApi[K] extends (args: infer A) => Promise<infer R>
    ? (args?: A) => Observable<R>
    : never;
};

export function observableCranculaApi(api$: Observable<CranculaApi>): Observable<ObservableCranculaApi> {
  return api$.pipe(
    map((value: CranculaApi): ObservableCranculaApi => {
      const result = {} as ObservableCranculaApi
      if (value) {
        Object.entries(value).forEach(([key, call]: [string, (args: any) => Promise<any>]): void => {
          const call$ = (args: typeof call.arguments): Observable<any> => defer((): Promise<any> => call(args));
          Object.defineProperty(result, key, call$)
        })
      }
      return result
    })
  )
}
