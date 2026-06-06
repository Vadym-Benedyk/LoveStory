import { Box } from '@mui/material';

interface BurgerIconProps {
  open: boolean;
  /** bar length in px */
  size?: number;
  /** stroke thickness in px */
  thickness?: number;
  color?: string;
}

/**
 * Animated hamburger ⇄ X icon.
 * Three bars that morph: top/bottom rotate to form an X, middle fades out.
 * Honors prefers-reduced-motion (snaps instead of animating).
 */
export function BurgerIcon({
  open,
  size = 22,
  thickness = 2,
  color = 'currentColor',
}: BurgerIconProps) {
  const gap = Math.round(size / 3); // vertical offset of outer bars
  const height = gap * 2 + thickness;

  const bar = {
    position: 'absolute',
    left: 0,
    width: size,
    height: thickness,
    borderRadius: thickness,
    backgroundColor: color,
    transition: 'transform .3s ease, opacity .2s ease, top .3s ease',
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  } as const;

  return (
    <Box
      aria-hidden
      sx={{
        position: 'relative',
        width: size,
        height,
        display: 'inline-block',
      }}
    >
      {/* top */}
      <Box
        sx={{
          ...bar,
          top: open ? gap : 0,
          transform: open ? 'rotate(45deg)' : 'none',
        }}
      />
      {/* middle */}
      <Box
        sx={{
          ...bar,
          top: gap,
          opacity: open ? 0 : 1,
          transform: open ? 'translateX(-6px)' : 'none',
        }}
      />
      {/* bottom */}
      <Box
        sx={{
          ...bar,
          top: open ? gap : gap * 2,
          transform: open ? 'rotate(-45deg)' : 'none',
        }}
      />
    </Box>
  );
}
