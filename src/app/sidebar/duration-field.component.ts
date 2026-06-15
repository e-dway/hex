import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DurationParts, EMPTY_PARTS, fromIso, toIso } from '../shared/duration';

@Component({
  selector: 'app-duration-field',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="duration">
      <span class="duration__group" title="Days">
        <input type="number" inputmode="numeric" min="0" placeholder="0"
               [(ngModel)]="parts.d" (ngModelChange)="emit()" aria-label="Days" />
        <span class="duration__suffix">d</span>
      </span>
      <span class="duration__group" title="Hours">
        <input type="number" inputmode="numeric" min="0" placeholder="0"
               [(ngModel)]="parts.h" (ngModelChange)="emit()" aria-label="Hours" />
        <span class="duration__suffix">h</span>
      </span>
      <span class="duration__group" title="Minutes">
        <input type="number" inputmode="numeric" min="0" placeholder="0"
               [(ngModel)]="parts.m" (ngModelChange)="emit()" aria-label="Minutes" />
        <span class="duration__suffix">m</span>
      </span>
      <code class="duration__iso" title="ISO 8601 duration">{{ iso || 'PT0S' }}</code>
    </div>
  `,
})
export class DurationFieldComponent {
  parts: DurationParts = { ...EMPTY_PARTS };
  iso: string | null = null;

  @Input() set value(v: string | null | undefined) {
    this.parts = fromIso(v);
    this.iso = toIso(this.parts);
  }

  @Output() valueChange = new EventEmitter<string | null>();

  emit() {
    this.iso = toIso(this.parts);
    this.valueChange.emit(this.iso);
  }
}
