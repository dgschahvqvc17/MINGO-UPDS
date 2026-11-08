import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-card',
  template: `
    <div
      class="app-card"
      [class.app-card--hover]="hoverable"
      [class.app-card--elevated]="elevated"
      [class.app-card--glass]="glass"
    >
      <ng-content></ng-content>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class CardComponent {
  @Input() hoverable = false;
  @Input() elevated = false;
  @Input() glass = false;
}
