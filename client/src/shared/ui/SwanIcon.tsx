import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon';

/**
 * Custom monochrome swan icon (MUI has none). Inherits color/size like any MUI icon,
 * so it sits consistently next to the other amenity icons.
 */
export function SwanIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props}>
      {/* body, resting on water, with a bump where the neck attaches */}
      <path d="M4 14.4c0-2.3 3.1-3.9 7.2-3.9 1.4 0 2.7.2 3.8.6.9.3 1.6.9 1.6 1.9 0 .9-.6 1.4-1.7 1.8 2.5.4 4.1 1.6 4.1 3.6 0 2.8-3.6 4.6-8 4.6s-7-2.4-7-4.6z" />
      {/* curved neck */}
      <path
        d="M13.6 12.6C12.4 11 11.8 9.6 11.8 8c0-2.3 1.8-4.2 4-4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      {/* head */}
      <circle cx="15.9" cy="3.9" r="1.5" />
      {/* beak */}
      <path d="M17.4 3.6l2.5-.3-2.3 1.5z" />
    </SvgIcon>
  );
}
