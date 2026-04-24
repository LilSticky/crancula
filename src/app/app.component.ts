import {Component} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {NavbarComponent} from "./features/navbar/navbar.component";

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'app-root',
  template: `
    <cranc-navbar/>
    <div class="page-container">
      <router-outlet/>
    </div>
  `,
  styles: `

    .page-container {
      width: 80%;
      margin: auto;
    }

    :host {
    }
  `,
  standalone: true,
  imports: [RouterOutlet, NavbarComponent]
})
export class AppComponent {

  constructor() {
  }
}
