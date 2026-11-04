import { Chip } from '@mui/material';
import { useLanguage } from '@/i18n/LanguageContext';
import { useSiteContent } from '@/shared/api/queries';

// Guests may pick more people than the house sleeps (the booking form offers 1–6). The
// request is accepted; this chip makes sure the owner notices and discusses it on the call.
export function OverCapacityChip({ guests }: { guests: number }) {
  const { t } = useLanguage();
  const { data } = useSiteContent();
  const capacity = data?.settings?.capacity;
  if (!capacity || guests <= capacity) return null;
  return (
    <Chip
      size="small"
      color="warning"
      label={t('admin.guests.overCapacity', { capacity })}
      sx={{ ml: 1, verticalAlign: 'middle' }}
    />
  );
}
