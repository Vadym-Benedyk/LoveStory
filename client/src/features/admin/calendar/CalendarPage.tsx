import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { PickersDay, type PickersDayProps } from '@mui/x-date-pickers/PickersDay';
import dayjs, { type Dayjs } from 'dayjs';
import { statusColors } from '@/theme/theme';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAdminCalendar, useBlockActions } from '../api';

const fmt = (d: Dayjs) => d.format('YYYY-MM-DD');

// Expand half-open [start, end) ranges into a Set of YYYY-MM-DD day keys.
function daysOf(ranges: { start: string; end: string }[]): Set<string> {
  const set = new Set<string>();
  for (const r of ranges) {
    let cur = dayjs(r.start);
    const end = dayjs(r.end);
    while (cur.isBefore(end)) {
      set.add(cur.format('YYYY-MM-DD'));
      cur = cur.add(1, 'day');
    }
  }
  return set;
}

export function CalendarPage() {
  const { t } = useLanguage();
  const rangeStart = dayjs().startOf('month');
  const rangeEnd = dayjs().add(6, 'month').endOf('month');
  const { data, isLoading } = useAdminCalendar(fmt(rangeStart), fmt(rangeEnd));
  const { create, remove } = useBlockActions();

  const [start, setStart] = useState<Dayjs | null>(null);
  const [end, setEnd] = useState<Dayjs | null>(null);
  const [reason, setReason] = useState('');

  const { confirmedDays, pendingDays, blockedDays } = useMemo(() => {
    const toRange = (arr?: { checkIn: string; checkOut: string }[]) =>
      (arr ?? []).map((b) => ({ start: b.checkIn, end: b.checkOut }));
    return {
      confirmedDays: daysOf(toRange(data?.confirmed)),
      pendingDays: daysOf(toRange(data?.pending)),
      blockedDays: daysOf((data?.blocks ?? []).map((b) => ({ start: b.startDate, end: b.endDate }))),
    };
  }, [data]);

  // Day cell painted by state. Confirmed & manual blocks read as "unavailable".
  function Day(props: PickersDayProps<Dayjs>) {
    const key = props.day.format('YYYY-MM-DD');
    let bg: string | undefined;
    let color: string | undefined;
    if (confirmedDays.has(key) || blockedDays.has(key)) {
      bg = statusColors.confirmed;
      color = '#fff';
    } else if (pendingDays.has(key)) {
      bg = statusColors.pending;
      color = '#fff';
    }
    return (
      <PickersDay
        {...props}
        sx={bg ? { bgcolor: bg, color, '&:hover': { bgcolor: bg } } : undefined}
      />
    );
  }

  const canBlock = start && end && end.isAfter(start);

  const submitBlock = () => {
    if (!canBlock) return;
    create.mutate(
      { startDate: fmt(start!), endDate: fmt(end!), reason: reason || undefined },
      {
        onSuccess: () => {
          setStart(null);
          setEnd(null);
          setReason('');
        },
      },
    );
  };

  return (
    <>
      <Typography variant="h4" gutterBottom>
        {t('admin.calendar.title')}
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 3 }}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DateCalendar readOnly slots={{ day: Day }} />
            </LocalizationProvider>
            <Stack direction="row" spacing={2} sx={{ px: 2, pb: 1, flexWrap: 'wrap', fontSize: 14 }}>
              <LegendDot color={statusColors.confirmed} label={t('admin.calendar.legendConfirmed')} />
              <LegendDot color={statusColors.pending} label={t('admin.calendar.legendPending')} />
            </Stack>
            {isLoading && <Typography sx={{ px: 2 }}>{t('admin.common.loading')}</Typography>}
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('admin.calendar.blockDatesTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('admin.calendar.blockDatesHint')}
            </Typography>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <Stack spacing={2}>
                <DatePicker
                  label={t('admin.calendar.from')}
                  value={start}
                  disablePast
                  onChange={setStart}
                  slotProps={{ textField: { fullWidth: true } }}
                />
                <DatePicker
                  label={t('admin.calendar.to')}
                  value={end}
                  minDate={start ?? undefined}
                  onChange={setEnd}
                  slotProps={{ textField: { fullWidth: true } }}
                />
                <TextField
                  label={t('admin.calendar.reason')}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                {create.isError && <Alert severity="error">{t('admin.calendar.blockError')}</Alert>}
                <Button
                  variant="contained"
                  disabled={!canBlock || create.isPending}
                  onClick={submitBlock}
                >
                  {create.isPending ? t('admin.calendar.blocking') : t('admin.calendar.blockButton')}
                </Button>
              </Stack>
            </LocalizationProvider>
          </Paper>

          <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('admin.calendar.activeBlocksTitle')}
            </Typography>
            {(data?.blocks?.length ?? 0) === 0 && (
              <Typography variant="body2" color="text.secondary">
                {t('admin.calendar.noBlocks')}
              </Typography>
            )}
            <Stack spacing={1}>
              {data?.blocks?.map((b) => (
                <Stack
                  key={b.id}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ bgcolor: 'background.default', px: 1.5, py: 1, borderRadius: 2 }}
                >
                  <Box>
                    <Typography variant="body2">
                      {b.startDate.slice(0, 10)} → {b.endDate.slice(0, 10)}
                    </Typography>
                    {b.reason && (
                      <Typography variant="caption" color="text.secondary">
                        {b.reason}
                      </Typography>
                    )}
                  </Box>
                  <IconButton
                    size="small"
                    aria-label={t('admin.calendar.removeBlock')}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(b.id)}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Chip
      size="small"
      label={label}
      sx={{ bgcolor: color, color: '#fff' }}
    />
  );
}
