import {patchState, signalStoreFeature, withComputed, withMethods, withState} from "@ngrx/signals";
import {computed} from "@angular/core";
import {setLoading} from "@shared/store-features/slices/loading/updates/setLoading";

// https://ngrx.io/guide/signals/signal-store/custom-store-features#known-typescript-issues
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function withLoading<_>() {
  return signalStoreFeature(
    withState(() => ({
      _isLoading: false,
    })),
    withComputed(({_isLoading}) => ({
      isLoading: computed((): boolean => {
        return _isLoading();
      })
    })),
    withMethods((store) => ({
      /**
       * sets {@link _isLoading} in the {@link store}
       * @param loading
       */
      setLoading(loading: boolean): void {
        patchState(store, setLoading(loading))
      },
    }))
  )
}
