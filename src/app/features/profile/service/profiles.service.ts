import {Injectable} from '@angular/core';
import {catchError, defer, Observable, throwError} from "rxjs";
import {Profile} from "@api/model/profile";
import {observableCranculaApi} from "../../shared/model/observable-crancula-api";


@Injectable({
  providedIn: 'root',
})
export class ProfilesService {
  private api$ = observableCranculaApi();

  readProfiles(): Observable<Profile[]> {
    return defer(() => this.api$.readProfiles())
      .pipe(catchError(err => {
        console.error(err);
        return throwError(() => new Error("Failed to readProfiles"))
      }))
  }

  createProfiles(profiles: Profile[]): Observable<number> {
    return defer(() => this.api$.createProfiles(profiles))
      .pipe(catchError(err => {
        console.error(err);
        return throwError(() => new Error("Failed to createProfiles"))
      }))
  }

  updateProfiles(profiles: Profile[]): Observable<number> {
    return defer(() => this.api$.updateProfiles(profiles))
      .pipe(catchError(err => {
        console.error(err);
        return throwError(() => new Error("Failed to updateProfiles"))
      }))
  }

  deleteProfiles(ids: string[]): Observable<number> {
    return defer(() => this.api$.deleteProfiles(ids))
      .pipe(catchError(err => {
        console.error(err);
        return throwError(() => new Error("Failed to deleteProfiles"))
      }))
  }

  readProfile(id: string): Observable<Profile> {
    return defer(() => this.api$.readProfile(id))
      .pipe(catchError(err => {
        console.error(err);
        return throwError(() => new Error("Failed to readProfile"))
      }))
  }

  createProfile(profile: Profile): Observable<boolean> {
    return defer(() => this.api$.createProfile(profile))
      .pipe(catchError(err => {
        console.error(err);
        return throwError(() => new Error("Failed to createProfile"))
      }))
  }

  updateProfile(profile: Profile): Observable<boolean> {
    return defer(() => this.api$.updateProfile(profile))
      .pipe(catchError(err => {
        console.error(err);
        return throwError(() => new Error("Failed to updateProfile"))
      }))
  }

  deleteProfile(id: string): Observable<boolean> {
    return defer(() => this.api$.deleteProfile(id))
      .pipe(catchError(err => {
        console.error(err);
        return throwError(() => new Error("Failed to updateProfile"))
      }))
  }

}
