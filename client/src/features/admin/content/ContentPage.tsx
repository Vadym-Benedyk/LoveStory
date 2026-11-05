import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Link,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { LANGS, translations, type Lang } from '@/i18n/translations';
import { HERO_COLORS, HERO_FONTS, isHexColor } from '@/features/public/home/heroStyle';
import { useLanguage } from '@/i18n/LanguageContext';
import { useToast } from '@/shared/ui/ToastProvider';
import { TERMS, TERMS_KEY, serializeTerms } from '@/features/public/terms/termsContent';
import { useContent, useContentActions, type ContentBlockRow } from '../api';

// Known, human-labeled fields the site currently reads (see server/prisma/seed.ts
// defaultContent). Anything else stored under a different key still shows up below,
// in the "Other fields" section, so nothing the owner has saved is ever hidden.
const KNOWN_FIELDS: { key: string; labelKey: string; multiline?: boolean; rows?: number; helperKey?: string; style?: 'font' | 'color'; group: string; groupKey: string }[] = [
  { key: 'hero.headline', labelKey: 'admin.content.field.heroHeadline', group: 'hero', groupKey: 'admin.content.group.hero' },
  { key: 'hero.subheadline', labelKey: 'admin.content.field.heroSubheadline', multiline: true, group: 'hero', groupKey: 'admin.content.group.hero' },
  ...(['headline', 'subheadline'] as const).flatMap((k) => [
    { key: `hero.${k}.font`, labelKey: 'admin.content.style.font', style: 'font' as const, group: 'hero', groupKey: 'admin.content.group.hero' },
    { key: `hero.${k}.color`, labelKey: 'admin.content.style.color', style: 'color' as const, group: 'hero', groupKey: 'admin.content.group.hero' },
  ]),
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

// Where each group of fields appears on the public site. `anchor` jumps to the section of the page.
// `hintKey` points to related things that are edited elsewhere in the admin.
const PAGES: {
  id: string;
  titleKey: string;
  path: string;
  sections: { group: string; whereKey: string; anchor?: string; hintKey?: string }[];
}[] = [
  {
    id: 'home',
    titleKey: 'admin.content.page.home',
    path: '/',
    sections: [
      { group: 'hero', whereKey: 'admin.content.where.hero' },
      { group: 'about', whereKey: 'admin.content.where.about', anchor: 'about' },
      { group: 'pricing', whereKey: 'admin.content.where.pricing', anchor: 'pricing', hintKey: 'admin.content.hint.pricing' },
      { group: 'contact', whereKey: 'admin.content.where.contact', anchor: 'contact', hintKey: 'admin.content.hint.contact' },
    ],
  },
  {
    id: 'terms',
    titleKey: 'admin.content.page.terms',
    path: '/terms',
    sections: [{ group: 'terms', whereKey: 'admin.content.where.terms' }],
  },
];

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
  // Text the site shows while the field is empty (built-in translation), used as a placeholder.
  const builtIn = (key: string) => {
    if (key === TERMS_KEY) return undefined;
    const k = key.startsWith('pricing.terms.') ? `${key}.text` : key;
    const v = t(k);
    return v === k ? undefined : v;
  };
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
          byKey.get(f.key) ||
            (f.key === TERMS_KEY
              ? serializeTerms(TERMS[locale])
              : f.key === 'hero.headline' || f.key === 'hero.subheadline'
                ? (translations[locale][f.key] ?? '')
                : ''),
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
          {PAGES.map((page) => (
            <Stack key={page.id} spacing={2}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                <Typography variant="h5">{t(page.titleKey)}</Typography>
                <Button
                  size="small"
                  component="a"
                  href={page.path}
                  target="_blank"
                  rel="noopener"
                  endIcon={<OpenInNewIcon fontSize="small" />}
                >
                  {t('admin.content.openPage')}
                </Button>
              </Stack>

              {page.sections.map((sec) => {
                const group = sec.group;
                const groupKey = KNOWN_FIELDS.find((f) => f.group === group)!.groupKey;
                const collapsible = COLLAPSIBLE.has(group);
                const expanded = !collapsible || !!open[group];
                const fields = (
                  <Stack spacing={2} mt={2}>
                    {KNOWN_FIELDS.filter((f) => f.group === group && !f.style).map((f) => (
                      <Stack key={f.key} spacing={1}>
                        <TextField
                          label={t(f.labelKey)}
                          value={values[f.key] ?? ''}
                          onChange={(e) => setKnown(f.key, e.target.value)}
                          multiline={f.multiline}
                          minRows={f.multiline ? (f.rows ?? 3) : undefined}
                          helperText={f.helperKey ? t(f.helperKey) : undefined}
                          placeholder={builtIn(f.key)}
                          fullWidth
                        />
                        {KNOWN_FIELDS.some((x) => x.key === `${f.key}.font`) && (
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                            <TextField
                              select
                              size="small"
                              label={t('admin.content.style.font')}
                              value={values[`${f.key}.font`] ?? ''}
                              onChange={(e) => setKnown(`${f.key}.font`, e.target.value)}
                              sx={{ minWidth: 220 }}
                              slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
                            >
                              <MenuItem value="">{t('admin.content.style.default')}</MenuItem>
                              {HERO_FONTS.map((o) => (
                                <MenuItem key={o.key} value={o.key} sx={{ fontFamily: o.css }}>
                                  {o.label}
                                </MenuItem>
                              ))}
                            </TextField>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                              <Typography variant="body2" color="text.secondary">
                                {t('admin.content.style.color')}
                              </Typography>
                              {HERO_COLORS.map((c) => (
                                <Tooltip key={c.value} title={c.label}>
                                  <Box
                                    component="button"
                                    type="button"
                                    aria-label={c.label}
                                    onClick={() => setKnown(`${f.key}.color`, c.value)}
                                    sx={{
                                      width: 26,
                                      height: 26,
                                      borderRadius: '50%',
                                      bgcolor: c.value,
                                      cursor: 'pointer',
                                      border: '2px solid',
                                      borderColor:
                                        (values[`${f.key}.color`] ?? '').toLowerCase() === c.value
                                          ? 'primary.main'
                                          : 'divider',
                                    }}
                                  />
                                </Tooltip>
                              ))}
                              <input
                                type="color"
                                aria-label={t('admin.content.style.color')}
                                value={isHexColor(values[`${f.key}.color`] ?? '') ? values[`${f.key}.color`] : '#fbf8f1'}
                                onChange={(e) => setKnown(`${f.key}.color`, e.target.value)}
                                style={{ width: 34, height: 30, padding: 0, border: 0, background: 'none', cursor: 'pointer' }}
                              />
                              <Button
                                size="small"
                                disabled={!values[`${f.key}.font`] && !values[`${f.key}.color`]}
                                onClick={() => {
                                  setKnown(`${f.key}.font`, '');
                                  setKnown(`${f.key}.color`, '');
                                }}
                              >
                                {t('admin.content.style.reset')}
                              </Button>
                            </Stack>
                          </Stack>
                        )}
                      </Stack>
                    ))}
                  </Stack>
                );
                const head = (
                  <>
                    <Typography variant="h6">{t(groupKey)}</Typography>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap mt={0.5}>
                      <Chip size="small" variant="outlined" label={t(sec.whereKey)} />
                      {sec.anchor && (
                        <Link href={`${page.path}#${sec.anchor}`} target="_blank" rel="noopener" variant="body2">
                          {t('admin.content.openSection')}
                        </Link>
                      )}
                    </Stack>
                    {sec.hintKey && (
                      <Typography variant="body2" color="text.secondary" mt={1}>
                        {t(sec.hintKey)}
                      </Typography>
                    )}
                  </>
                );
                return (
                  <Paper key={group} elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
                    {collapsible ? (
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="flex-start"
                        onClick={() => setOpen((o) => ({ ...o, [group]: !expanded }))}
                        sx={{ cursor: 'pointer' }}
                      >
                        <div>{head}</div>
                        <IconButton
                          aria-expanded={expanded}
                          aria-label={t(groupKey)}
                          sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
                        >
                          <ExpandMoreIcon />
                        </IconButton>
                      </Stack>
                    ) : (
                      head
                    )}
                    {collapsible ? <Collapse in={expanded}>{fields}</Collapse> : fields}
                  </Paper>
                );
              })}
            </Stack>
          ))}

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
