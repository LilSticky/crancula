import {Injectable} from '@angular/core';
import {catchError, Observable, of, switchMap, throwError} from "rxjs";
import {Profile} from "@api/model/profile";
import {observableCranculaApi} from "@shared/model/observable-crancula-api";


@Injectable({
  providedIn: 'root',
})
export class ProfilesService {
  private api$ = observableCranculaApi(of(window.api))

  readProfiles(): Observable<Profile[]> {
    return this.api$.pipe(
      switchMap(api => api.readProfiles()),
      catchError(err => {
        console.error(err);
        return throwError(() => new Error("Failed to readProfiles"))
      })
    )
  }

  createProfiles(profiles: Profile[]): Observable<number> {
    return this.api$.pipe(
      switchMap(api => api.createProfiles(profiles)),
      catchError(err => {
        console.error(err);
        return throwError(() => new Error("Failed to createProfiles"))
      }))
  }

  updateProfiles(profiles: Profile[]): Observable<number> {
    return this.api$.pipe(
      switchMap(api => api.updateProfiles(profiles)),
      catchError(err => {
        console.error(err);
        return throwError(() => new Error("Failed to updateProfiles"))
      }))
  }

  deleteProfiles(ids: string[]): Observable<number> {
    return this.api$.pipe(
      switchMap(api => api.deleteProfiles(ids)),
      catchError(err => {
        console.error(err);
        return throwError(() => new Error("Failed to deleteProfiles"))
      }))
  }

  readProfile(id: string): Observable<Profile> {
    return this.api$.pipe(
      switchMap(api => api.readProfile(id)),
      catchError(err => {
        console.error(err);
        return throwError(() => new Error("Failed to readProfile"))
      }))
  }

  createProfile(profile: Profile): Observable<boolean> {
    return this.api$.pipe(
      switchMap(api => api.createProfile(profile)),
      catchError(err => {
        console.error(err);
        return throwError(() => new Error("Failed to createProfile"))
      }))
  }

  updateProfile(profile: Profile): Observable<boolean> {
    return this.api$.pipe(
      switchMap(api => api.updateProfile(profile)),
      catchError(err => {
        console.error(err);
        return throwError(() => new Error("Failed to updateProfile"))
      }))
  }

  deleteProfile(id: string): Observable<boolean> {
    return this.api$.pipe(
      switchMap(api => api.deleteProfile(id)),
      catchError(err => {
        console.error(err);
        return throwError(() => new Error("Failed to updateProfile"))
      }))
  }

}
