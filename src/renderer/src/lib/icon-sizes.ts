/**
 * Standard icon size tokens for consistent visual hierarchy.
 *
 * - xs (12px): Minimal inline icons, tight UI elements
 * - sm (14px): Body text inline icons, compact toolbars
 * - md (16px): Default icon size, primary actions
 * - lg (20px): Feature headers, prominent actions
 */
export const ICON_SIZE = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20
} as const

export type IconSize = (typeof ICON_SIZE)[keyof typeof ICON_SIZE]
