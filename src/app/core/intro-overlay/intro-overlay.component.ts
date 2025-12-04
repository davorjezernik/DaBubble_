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
  /**
   * Root overlay element containing the animated intro.
   * Used to toggle the `.animate` class which starts the CSS animations.
   */
  @ViewChild('overlay', { static: true }) overlay!: ElementRef<HTMLElement>;

  /**
   * Cluster wrapper that contains the logo and title. The CSS animations
   * (e.g. `cluster-fly`) are applied to this element and we listen for
   * animation events on it to know when the intro finished.
   */
  @ViewChild('cluster', { static: true }) cluster!: ElementRef<HTMLDivElement>;

  /**
   * The logo image element shown in the intro. We attempt to `decode()` the
   * image so the animation doesn't start before the graphic is ready.
   */
  @ViewChild('logoEl', { static: true }) logoEl!: ElementRef<HTMLImageElement>;

  /**
   * The heading/title element shown next to the logo.
   */
  @ViewChild('titleEl', { static: true }) titleEl!: ElementRef<HTMLHeadingElement>;

  /**
   * Emitted when the intro animation is finished (or reduced-motion applies).
   * Consumers can listen to this event to proceed with showing the app UI.
   */
  @Output() done = new EventEmitter<void>();

  /**
   * Lifecycle hook: Called after the component's view has been initialized.
   * This method:
   * - waits for the logo image to decode and for fonts to be ready,
   * - respects `prefers-reduced-motion` and immediately emits `done` if set,
   * - adds the `.animate` class to start CSS animations,
   * - computes a safety timeout from the computed animation timings,
   * - waits either for the `cluster-fly` animation to end or for the safety timeout,
   * - emits the `done` event when finished.
   */
  async ngAfterViewInit(): Promise<void> {
    // Ensure the logo graphic is decoded before animating to avoid jank.
    try {
      await (this.logoEl.nativeElement as any).decode?.();
    } catch {}

    // Wait for document fonts if available so text measures are stable.
    if ((document as any).fonts?.ready) await (document as any).fonts.ready;

    // Respect reduced motion: immediately finish the intro.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setTimeout(() => this.done.emit(), 0);
      return;
    }

    // Start animations by toggling the animate class.
    this.overlay.nativeElement.classList.add('animate');

    const el = this.cluster.nativeElement;
    const cs = getComputedStyle(el);

    /**
     * Convert a CSS time string (e.g. '200ms' or '0.4s') to milliseconds.
     * Returns 0 for falsy input.
     * @param s CSS time string
     */
    const toMs = (s: string) => {
      if (!s) return 0;
      return s.endsWith('ms') ? parseFloat(s) : parseFloat(s) * 1000;
    };

    const durations = cs.animationDuration.split(',').map(toMs);
    const delays = cs.animationDelay.split(',').map(toMs);
    const counts = cs.animationIterationCount
      .split(',')
      .map((c) => (c.trim() === 'infinite' ? Infinity : parseFloat(c) || 1));

    const totals = durations.map((d, i) => {
      const delay = delays[i] ?? 0;
      const count = counts[i] ?? 1;
      if (!isFinite(count)) return Infinity;
      return delay + d * count;
    });

    let totalMs = Math.max(0, ...totals);
    if (!isFinite(totalMs) || totalMs === 0) totalMs = 1800;
    const safetyMs = Math.min(Math.max(totalMs + 100, 500), 5000);

    /**
     * Create a promise that resolves after `safetyMs` milliseconds unless
     * resolved earlier via the attached helpers on the promise object.
     * We attach `_resolve`, `_timer`, `_settled`, `_setSettled` to the
     * returned promise to allow the caller to settle it from an event.
     * @param safetyMs timeout in ms
     */
    function setupAnimationPromise(safetyMs: number) {
      let settled = false;
      const promise = new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve();
          }
        }, safetyMs);
        (promise as any)._resolve = resolve;
        (promise as any)._timer = timer;
        (promise as any)._settled = () => settled;
        (promise as any)._setSettled = () => (settled = true);
      });
      return promise as any;
    }

    /**
     * Waits for the cluster's `cluster-fly` animation to end or for the safety
     * timeout to elapse. Resolves when either happens.
     * @param el target element
     * @param safetyMs timeout in ms
     */
    function waitForClusterFly(el: HTMLElement, safetyMs: number): Promise<void> {
      const p = setupAnimationPromise(safetyMs);
      const onEnd = (e: AnimationEvent) => {
        if (e.animationName === 'cluster-fly' && !p._settled()) {
          p._setSettled();
          clearTimeout(p._timer);
          p._resolve();
        }
      };
      el.addEventListener('animationend', onEnd, { once: true });
      return p;
    }

    await waitForClusterFly(el, safetyMs);

    // Signal to consumers that the intro sequence finished.
    this.done.emit();
  }
}