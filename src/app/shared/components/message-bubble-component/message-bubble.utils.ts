/**
 * Utility functions and constants for MessageBubbleComponent
 * Extracted pure functions to improve testability and reusability
 */

// ============= Constants =============

export const DELETED_PLACEHOLDER = 'Diese Nachricht wurde gelöscht.';
export const MAX_UNIQUE_REACTIONS = 20;
export const DEFAULT_COLLAPSE_THRESHOLD = 7;
export const NARROW_COLLAPSE_THRESHOLD = 6;
export const VERY_NARROW_COLLAPSE_THRESHOLD = 4;

// ============= Viewport Detection =============

/**
 * Check if viewport width is narrow (≤ 450px)
 */
export function isNarrowViewport(width: number): boolean {
  return width <= 450;
}

/**
 * Check if viewport width is very narrow (≤ 400px)
 */
export function isVeryNarrowViewport(width: number): boolean {
  return width <= 400;
}

/**
 * Check if viewport width is mobile (≤ 768px)
 */
export function isMobileViewport(width: number): boolean {
  return width <= 768;
}

// ============= Timestamp Normalization =============

/**
 * Normalize various timestamp formats to a Date object
 * Handles:
 * - Date instances
 * - Firestore Timestamp (with toDate method)
 * - ISO strings
 * - Epoch numbers
 * 
 * @param value - Unknown timestamp value
 * @returns Normalized Date or null if invalid
 */
export function normalizeTimestamp(value: unknown): Date | null {
  const v: any = value;
  if (!v) return null;
  
  // Already a Date
  if (v instanceof Date) return v;
  
  // Firestore Timestamp with toDate method
  if (typeof v?.toDate === 'function') {
    try {
      return v.toDate();
    } catch {
      return null;
    }
  }
  
  // ISO string or epoch number
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  
  return null;
}
