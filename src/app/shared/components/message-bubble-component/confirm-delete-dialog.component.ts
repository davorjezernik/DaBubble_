import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  standalone: true,
  selector: 'app-confirm-delete-dialog',
  imports: [CommonModule],
  template: `
    <div class="delete-dialog" role="dialog" aria-modal="true" aria-label="Nachricht löschen bestätigen">
      <p class="delete-dialog__text">Nachricht wirklich löschen?</p>
      <div class="delete-dialog__actions">
        <button type="button" class="btn btn--secondary" (click)="close(false)">Abbrechen</button>
        <button type="button" class="btn btn--primary" (click)="close(true)">Löschen</button>
      </div>
    </div>
  `,
  styleUrls: ['./confirm-delete-dialog.component.scss']
})
export class ConfirmDeleteDialogComponent {
  constructor(private ref: MatDialogRef<ConfirmDeleteDialogComponent>) {}
  close(result: boolean){ this.ref.close(result); }
}
