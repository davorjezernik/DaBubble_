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
  @ViewChild('overlay', { static: true }) overlay!: ElementRef<HTMLElement>;
  @ViewChild('cluster', { static: true }) cluster!: ElementRef<HTMLDivElement>;
  @ViewChild('logoEl', { static: true }) logoEl!: ElementRef<HTMLImageElement>;
  @ViewChild('titleEl', { static: true }) titleEl!: ElementRef<HTMLHeadingElement>;
  @Output() done = new EventEmitter<void>();

  async ngAfterViewInit() {
  // Warten bis Bild & Fonts fertig sind
  try { await (this.logoEl.nativeElement as any).decode?.(); } catch {}
  if ((document as any).fonts?.ready) await (document as any).fonts.ready;

  // Reduced motion -> überspringen
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    setTimeout(() => this.done.emit(), 0);
    return;
  }

  // CSS-Animation starten
  this.overlay.nativeElement.classList.add('animate');

  const el = this.cluster.nativeElement;

  // Dauer + Delay + Iterationen ermitteln
  const cs = getComputedStyle(el);
  const toMs = (s: string) => {
    // "0s" | "0.8s" | "120ms" -> number ms
    if (!s) return 0;
    return s.endsWith('ms') ? parseFloat(s) : parseFloat(s) * 1000;
  };

  // Bei mehrfachen Animationen liefert CSS kommagetrennte Listen – nimm die längste
  const durations = cs.animationDuration.split(',').map(toMs);
  const delays    = cs.animationDelay.split(',').map(toMs);
  const counts    = cs.animationIterationCount.split(',').map(c => c.trim() === 'infinite' ? Infinity : parseFloat(c) || 1);

  const totals = durations.map((d, i) => {
    const delay = delays[i] ?? 0;
    const count = counts[i] ?? 1;
    if (!isFinite(count)) return Infinity;
    return delay + d * count;
  });

  let totalMs = Math.max(0, ...totals);
  // Sicherheitsaufschlag + Fallback bei Infinity/0
  if (!isFinite(totalMs) || totalMs === 0) totalMs = 1800;
  const safetyMs = Math.min(Math.max(totalMs + 100, 500), 5000); // 0.5s–5s

  // Promise, das beim ersten passenden animationend ODER beim Timeout erfüllt
  await new Promise<void>((resolve) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve();
    }, safetyMs);

    const onEnd = (e: AnimationEvent) => {
      // Nur reagieren, wenn die gewünschte Keyframe-Animation endet.
      // Wenn du ALLE akzeptieren willst, entferne die Namensprüfung.
      if ((e as any).animationName === 'cluster-fly') {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      }
    };

    // einmalig reagieren
    el.addEventListener('animationend', onEnd as any, { once: true });
  });

  this.done.emit();
}
}
