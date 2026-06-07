import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon';

/** TikTok glyph (MUI has no TikTok icon). Monochrome, inherits currentColor. */
export function TikTokIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props}>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.3v13.04a2.4 2.4 0 0 1-2.4 2.4 2.4 2.4 0 0 1 0-4.81c.25 0 .5.04.73.11V10.4a5.86 5.86 0 0 0-.73-.05A5.74 5.74 0 0 0 4.1 16.1a5.74 5.74 0 0 0 9.83 4.05 5.7 5.7 0 0 0 1.65-4.05V9.01a7.55 7.55 0 0 0 4.42 1.42V7.13a4.27 4.27 0 0 1-3.4-1.31z" />
    </SvgIcon>
  );
}
