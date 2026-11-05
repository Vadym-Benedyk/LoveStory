import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Collapse,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { LANGS, type Lang } from '@/i18n/translations';
import { useLanguage } from '@/i18n/LanguageContext';
import { useToast } from '@/shared/ui/ToastProvider';
import { TERMS, TERMS_KEY, serializeTerms } from '@/features/public/terms/termsContent';
import { useContent, useContentActions, type ContentBlockRow } from '../api';

// Known, human-labeled fields the site currently reads (see server/prisma/seed.ts
// defaultContent). Anything else stored under a different key still shows up below,
// in the "Other fields" section, so nothing the owner has saved is ever hidden.
const KNOWN_FIELDS: { key: string; labelKey: string; multiline?: boolean; rows?: number; helperKey?: string; group: string; groupKey: string }[] = [
  { key: 'hero.headline', labelKey: 'admin.content.field.heroHeadline', group: 'hero', groupKey: 'admin.content.group.hero' },
  { key: 'hero.subheadline', labelKey: 'admin.content.field.heroSubheadline', multiline: true, group: 'hero', groupKey: 'admin.content.group.hero' },
  { key: 'about.title', labelKey: 'admin.content.field.aboutTitle', group: 'about', groupKey: 'admin.content.group.about' },
  { key: 'about.body', labelKey: 'admin.content.field.aboutBody', multiline: true, group: 'about', groupKey: 'admin.content.group.about' },
  { key: 'contact.note', labelKey: 'admin.content.field.contactNote', multiline: true, group: 'contact', groupKey: 'admin.content.group.contact' },
  { key: TERMS_KEY, labelKey: 'admin.content.field.termsBody', helperKey: 'admin.content.field.termsHelp', multiline: true, rows: 24, group: 'terms', groupKey: 'admin.content.group.terms' },
  // Prices section: stay terms shown under the price tables
  ...(['payment', 'times', 'deposit', 'guests', 'pets', 'parties'] as const).map((k) => ({
    key: `pricing.terms.${k}`,
    labelKey: `pricing.terms.${k}`,
    multiline: true,
    group: 'pricing',
    groupKey: 'admin.content.group.pricing',
  })),
];
const KNOWN_KEYS = new Set(KNOWN_FIELDS.map((f) => f.key));
// Long groups start collapsed so the page stays short.
const COLLAPSIBLE = new Set(['terms']);
const GROUPS = [...new Set(KNOWN_FIELDS.map((f) => f.group))];

type CustomRow = { id: string; key: string; value: string; existing: boolean };
let customRowSeq = 0;
const newCustomRow = (key = '', value = '', existing = false): CustomRow => ({
  id: `row-${++customRowSeq}`,
  key,
  value,
  existing,
});

export function ContentPage() {
  const { t } = useLanguage();
  const toast = useToast();
  const [locale, setLocale] = useState<Lang>('uk');
  const { data, isLoading } = useContent(locale);
  const { save, remove } = useContentActions();

  const [values, setValues] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<CustomRow[]>([]);
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // Reseed the working draft whenever the locale changes or fresh data arrives.
  useEffect(() => {
    if (!data) return;
    const byKey = new Map(data.blocks.map((b: ContentBlockRow) => [b.key, b.value]));
    setValues(
      Object.fromEntries(
        KNOWN_FIELDS.map((f) => [
          f.key,
          // Terms start from the built-in text so the owner edits it instead of writing from scratch.
          byKey.get(f.key) || (f.key === TERMS_KEY ? serializeTerms(TERMS[locale]) : ''),
        ]),
      ),
    );
    setCustom(
      data.blocks
        .filter((b) => !KNOWN_KEYS.has(b.key))
        .map((b) => newCustomRow(b.key, b.value, true)),
    );
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, locale]);

  const handleLocale = (_: unknown, next: Lang | null) => {
    if (next) setLocale(next);
  };

  const setKnown = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setDirty(true);
  };

  const setCustomField = (id: string, patch: Partial<CustomRow>) => {
    setCustom((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const addCustomRow = () => setCustom((rows) => [...rows, newCustomRow()]);

  const removeCustomRow = (row: CustomRow) => {
    setCustom((rows) => rows.filter((r) => r.id !== row.id));
    setDirty(true);
    if (row.existing && row.key) remove.mutate({ key: row.key, locale });
  };

  const handleSave = () => {
    const blocks = [
      ...Object.entries(values).map(([key, value]) => ({ key, value })),
      ...custom.filter((r) => r.key.trim()).map((r) => ({ key: r.key.trim(), value: r.value })),
    ];
    save.mutate(
      { locale, blocks },
      {
        onSuccess: () => {
          setDirty(false);
          toast.success(t('admin.content.saved'));
        },
        onError: () => toast.error(t('admin.content.saveError')),
      },
    );
  };

  return (
    <>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={2}
        mb={3}
      >
        <Typography variant="h4">{t('admin.content.title')}</Typography>
        <ToggleButtonGroup exclusive size="small" value={locale} onChange={handleLocale}>
          {LANGS.map((l) => (
            <ToggleButton key={l.code} value={l.code}>
              {l.short}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      <Alert severity="info" sx={{ mb: 3 }}>
        {t('admin.content.infoBanner', {
          lang: LANGS.find((l) => l.code === locale)?.label ?? locale,
        })}
      </Alert>

      {isLoading ? (
        <Typography>{t('admin.common.loading')}</Typography>
      ) : (
        <Stack spacing={3}>
          {GROUPS.map((group) => {
            const groupKey = KNOWN_FIELDS.find((f) => f.group === group)!.groupKey;
            const collapsible = COLLAPSIBLE.has(group);
            const expanded = !collapsible || !!open[group];
            const fields = (
              <Stack spacing={2} mt={2}>
                {KNOWN_FIELDS.filter((f) => f.group === group).map((f) => (
                  <TextField
                    key={f.key}
                    label={t(f.labelKey)}
                    value={values[f.key] ?? ''}
                    onChange={(e) => setKnown(f.key, e.target.value)}
                    multiline={f.multiline}
                    minRows={f.multiline ? (f.rows ?? 3) : undefined}
                    helperText={f.helperKey ? t(f.helperKey) : undefined}
                    fullWidth
                  />
                ))}
              </Stack>
            );
            return (
              <Paper key={group} elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
                {collapsible ? (
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    onClick={() => setOpen((o) => ({ ...o, [group]: !expanded }))}
                    sx={{ cursor: 'pointer' }}
                  >
                    <Typography variant="h6">{t(groupKey)}</Typography>
                    <IconButton
                      aria-expanded={expanded}
                      aria-label={t(groupKey)}
                      sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
                    >
                      <ExpandMoreIcon />
                    </IconButton>
                  </Stack>
                ) : (
                  <Typography variant="h6" gutterBottom>
                    {t(groupKey)}
                  </Typography>
                )}
                {collapsible ? <Collapse in={expanded}>{fields}</Collapse> : fields}
              </Paper>
            );
          })}

          <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">{t('admin.content.otherFields')}</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={addCustomRow}>
                {t('admin.content.addField')}
              </Button>
            </Stack>
            {custom.length === 0 ? (
              <Typography color="text.secondary" mt={1}>
                {t('admin.content.noCustom')}
              </Typography>
            ) : (
              <Stack spacing={2} mt={2}>
                {custom.map((row) => (
                  <Stack key={row.id} direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField
                      label={t('admin.content.key')}
                      value={row.key}
                      onChange={(e) => setCustomField(row.id, { key: e.target.value })}
                      sx={{ width: { sm: 220 } }}
                      placeholder="e.g. amenities.wildlife"
                    />
                    <TextField
                      label={t('admin.content.value')}
                      value={row.value}
                      onChange={(e) => setCustomField(row.id, { value: e.target.value })}
                      multiline
                      minRows={1}
                      fullWidth
                    />
                    <IconButton
                      aria-label={t('admin.content.removeField')}
                      onClick={() => removeCustomRow(row)}
                      sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            )}
          </Paper>

          <Divider />

          <Stack direction="row" spacing={2} alignItems="center">
            <Button
              variant="contained"
              size="large"
              disabled={!dirty || save.isPending}
              onClick={handleSave}
            >
              {save.isPending ? t('admin.content.saving') : t('admin.content.save')}
            </Button>
          </Stack>
        </Stack>
      )}
    </>
  );
}
