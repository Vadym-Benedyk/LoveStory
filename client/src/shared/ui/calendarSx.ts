import type { SxProps, Theme } from '@mui/material/styles';

// Shared sizing for MUI <DateCalendar> (public booking page + admin calendar).
// MUI's calendar is a fixed 320×336px. Phones: let it shrink (day side-margins dropped) so it
// never forces horizontal scroll. Tablet/desktop: bigger day cells (52 / 56px) so it fills its
// card. A week row = cell + 4px (MUI's week margin), 6 rows max.
export const roomyCalendarSx: SxProps<Theme> = {
  width: '100%',
  maxWidth: { xs: 320, sm: 400, md: 440 },
  height: 'auto',
  maxHeight: 'none',
  '& .MuiPickersDay-root, & .MuiDayCalendar-weekDayLabel': {
    mx: { xs: 0, sm: '2px' },
    width: { xs: 36, sm: 52, md: 56 },
  },
  '& .MuiPickersDay-root': {
    height: { xs: 36, sm: 52, md: 56 },
    fontSize: { xs: '0.75rem', sm: '0.95rem', md: '1rem' },
  },
  '& .MuiDayCalendar-weekDayLabel': { fontSize: { sm: '0.85rem' } },
  '& .MuiDayCalendar-slideTransition': { minHeight: { xs: 240, sm: 336, md: 360 } },
  '& .MuiPickersCalendarHeader-label': { fontSize: { sm: '1.05rem', md: '1.15rem' } },
};
