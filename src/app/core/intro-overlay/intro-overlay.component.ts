import {
  Component,
  ElementRef,
  ViewChild,
  Output,
  EventEmitter,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-intro-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './intro-overlay.component.html',
  styleUrls: ['./intro-overlay.component.scss'],
})
export class IntroOverlayComponent implements AfterViewInit {
  @ViewChild('cluster', { static: true }) cluster!: ElementRef<HTMLDivElement>;
  @ViewChild('logoEl', { static: true }) logoEl!: ElementRef<HTMLImageElement>;
  @ViewChild('titleEl', { static: true }) titleEl!: ElementRef<HTMLHeadingElement>;
  @Output() done = new EventEmitter<void>();

  async ngAfterViewInit() {
    // Logo macht Platz anfang //
    await this.logoEl.nativeElement.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-60px)' }],
      { duration: 800, easing: 'ease-out', delay: 1000, fill: 'forwards' }
    ).finished;
    // Logo macht Platz ende //

    // Text von links rein //
    await this.titleEl.nativeElement.animate(
      [
        { opacity: 0, transform: 'translateX(-80px)' },
        { opacity: 1, transform: 'translateX(-12px)' },
      ],
      { duration: 800, easing: 'cubic-bezier(.22,.9,.26,1)', fill: 'forwards' }
    ).finished;
    // Text von links rein ende//

    // Parallel: Fly + Farbwechsel + Overlay-Fade anfang//
    const clusterFly = this.cluster.nativeElement.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1)' },
        {
          transform: `translate(calc(-50% - (50vw - 215px)),
                               calc(-50% - (50vh - 125px))) scale(0.4)`,
        },
      ],
      { duration: 800, easing: 'ease-in', fill: 'forwards' }
    );

    const colorFade = this.titleEl.nativeElement.animate([{ color: '#fff' }, { color: '#000' }], {
      duration: 500,
      easing: 'ease-in',
      fill: 'forwards',
    });

    const bg = (this.cluster.nativeElement.closest('.overlay') as HTMLElement).querySelector(
      '.overlay-bg'
    )!;
    const bgFade = bg.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 500,
      easing: 'ease',
      fill: 'forwards',
    });

    await Promise.all([clusterFly.finished, colorFade.finished, bgFade.finished]);
    // Parallel: Fly + Farbwechsel + Overlay-Fade ende//

    this.done.emit();
    // Cluster ins Backdrop mounten ende//
  }
}
