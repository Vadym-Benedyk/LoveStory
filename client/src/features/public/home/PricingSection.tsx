// Public "Prices" section: tariffs table, what's included, paid extras and the stay terms.
// Everything comes from the DB (admin → Prices / Content), in the current site language.
import {
  Box,
  Button,
  Container,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { useFormatDate } from '@/i18n/DateLocaleProvider';
import { usePricing, useSiteContent, type PublicRule } from '@/shared/api/queries';
import { usePrice } from '@/shared/usePrice';
import { includedIcon, localizedName } from '@/shared/ui/includedIcons';
import styles from './HomePage.module.scss';

// Index = JS Date#getDay() (0 = Sunday), what PriceRule.daysOfWeek stores.
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const TERMS = ['payment', 'times', 'deposit', 'guests', 'pets', 'parties'] as const;
const UNIT_KEY = { PER_STAY: 'perStay', PER_NIGHT: 'perNight', PER_PERSON: 'perPerson' } as const;

export function PricingSection() {
  const { t, lang } = useLanguage();
  const price = usePrice();
  const fmtDate = useFormatDate();
  const { data: pricing } = usePricing();
  const { data: content } = useSiteContent();

  // Base rate first, then weekend, then seasonal (the API orders by priority, which is for pricing).
  const KIND_ORDER = { BASE: 0, WEEKEND: 1, SEASONAL: 2 } as const;
  const rules = [...(pricing?.rules ?? [])].sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.appliesFrom ?? '').localeCompare(b.appliesFrom ?? ''),
  );
  const addons = pricing?.addons ?? [];
  const included = pricing?.included ?? [];
  const hasOverrides = rules.some((r) => r.kind !== 'BASE');

  const when = (r: PublicRule): string => {
    if (r.kind === 'WEEKEND') {
      const days = r.daysOfWeek.split(',').filter(Boolean).map(Number);
      return days.length ? days.map((d) => t(`admin.pricing.day.${DAY_KEYS[d]}`)).join(', ') : '—';
    }
    if (r.kind === 'SEASONAL') {
      return r.appliesFrom && r.appliesTo ? `${fmtDate(r.appliesFrom)} – ${fmtDate(r.appliesTo)}` : '—';
    }
    return t(hasOverrides ? 'pricing.when.other' : 'pricing.when.every');
  };

  // Terms: texts are editable in the admin (Content → Prices & terms); the i18n text is the fallback.
  const term = (key: (typeof TERMS)[number]) => content?.copy[`pricing.terms.${key}`] || t(`pricing.terms.${key}.text`);

  return (
    <Container component="section" id="pricing" className={styles.section}>
      <Typography variant="h2" gutterBottom>
        {t('pricing.title')}
      </Typography>
      <Typography className={styles.lead}>{t('pricing.body')}</Typography>

      {/* Tariffs */}
      {rules.length > 0 && (
        <Box mt={4}>
          <Typography variant="h5" gutterBottom>
            {t('pricing.tariffs')}
          </Typography>
          <TableContainer component={Paper} elevation={0} className={styles.priceTable}>
            <Table size="medium">
              <TableHead>
                <TableRow>
                  <TableCell>{t('pricing.col.tariff')}</TableCell>
                  <TableCell>{t('pricing.col.when')}</TableCell>
                  <TableCell align="right">{t('pricing.col.priceNight')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell sx={{ fontWeight: 600 }}>
                      {localizedName(r, lang)}
                      {r.minNights && r.minNights > 1 && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t('pricing.minNights', { n: r.minNights })}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{when(r)}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {price.format(r.nightlyRateMinor)}
                      {/* "/ night" is implied by the column title on phones — saves width */}
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: { xs: 'none', sm: 'inline' } }}
                      >
                        {' '}
                        / {t('pricing.night')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Included */}
      {included.length > 0 && (
        <Box mt={5}>
          <Typography variant="h5" gutterBottom>
            {t('pricing.included')}
          </Typography>
          <Typography className={styles.lead} sx={{ mb: 2 }}>
            {t('pricing.includedLead')}
          </Typography>
          <Grid container spacing={2}>
            {included.map((i) => (
              <Grid key={i.id} item xs={12} sm={6} md={4}>
                <Stack direction="row" spacing={1.5} alignItems="center" className={styles.includedItem}>
                  <span className={styles.includedIcon}>{includedIcon(i.icon)}</span>
                  <Typography>{localizedName(i, lang)}</Typography>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Paid extras */}
      {addons.length > 0 && (
        <Box mt={5}>
          <Typography variant="h5" gutterBottom>
            {t('pricing.extras')}
          </Typography>
          <TableContainer component={Paper} elevation={0} className={styles.priceTable}>
            <Table size="medium">
              <TableHead>
                <TableRow>
                  <TableCell>{t('pricing.col.service')}</TableCell>
                  <TableCell align="right">{t('pricing.col.price')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {addons.map((a) => {
                  const desc = lang === 'en' ? a.descriptionEn || a.description : a.description || a.descriptionEn;
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600 }}>{localizedName(a, lang)}</Typography>
                        {desc && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {desc}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {a.priceMinor === 0 ? (
                          t('pricing.free')
                        ) : (
                          <>
                            {price.format(a.priceMinor)}
                            <Typography component="span" variant="caption" color="text.secondary">
                              {' '}
                              {t(`pricing.unit.${UNIT_KEY[a.unit]}`)}
                            </Typography>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Terms */}
      <Box mt={5}>
        <Typography variant="h5" gutterBottom>
          {t('pricing.terms')}
        </Typography>
        <Paper elevation={0} className={styles.terms}>
          {TERMS.map((key) => (
            <div key={key} className={styles.termRow}>
              <Typography className={styles.termLabel}>{t(`pricing.terms.${key}`)}</Typography>
              <Typography>{term(key)}</Typography>
            </div>
          ))}
        </Paper>
      </Box>

      <Button variant="contained" size="large" component={RouterLink} to="/booking" sx={{ mt: 4 }}>
        {t('cta.seeDatesPrices')}
      </Button>
    </Container>
  );
}
