import { ApplicationRef, Injectable } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { interval, concat } from 'rxjs';
import { first } from 'rxjs/operators';
import { environment } from '@biosimulations/shared/environments';
@Injectable({
  providedIn: 'root',
})
export class UpdateService {
  public constructor(private updates: SwUpdate, private appRef: ApplicationRef) {
    if (environment.production) {
      // Alert the user to reload if there is a major error
      updates.unrecoverable.subscribe((event) => {
        alert(`An error occurred that we cannot recover from:\n${event.reason}\n\n` + 'Please reload the page.');
      });

      // Allow the app to stabilize first, before starting polling for updates with `interval()`.
      const appIsStable$ = appRef.isStable.pipe(first((isStable) => isStable === true));
      const everyHour$ = interval(60 * 60 * 1000);
      const everyHourOnceAppIsStable$ = concat(appIsStable$, everyHour$);
      everyHourOnceAppIsStable$.subscribe(() => updates.checkForUpdate());

      // When updates are available, update automatically
      // TODO determine if we want to alert/ask user about this
      this.updates.available.subscribe((event) => {
        this.updates
          .activateUpdate()
          .then(() => document.location.reload())
          .catch((_err) => document.location.reload());
      });
    }
  }
}
