import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { formatMoney } from '@/shared/types';
import { useLanguage } from '@/i18n/LanguageContext';
import {
  usePricing,
  usePricingActions,
  type AddonUnit,
  type PriceRule,
  type PriceRuleKind,
  type PricingAddon,
} from '../api';

const KINDS: PriceRuleKind[] = ['BASE', 'WEEKEND', 'SEASONAL'];
const UNITS: AddonUnit[] = ['PER_STAY', 'PER_NIGHT', 'PER_PERSON'];
// Index matches JS Date#getDay() (0 = Sunday … 6 = Saturday), which is what daysOfWeek stores.
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

interface RuleForm {
  name: string;
  kind: PriceRuleKind;
  rate: string;
  daysOfWeek: number[];
  appliesFrom: Dayjs | null;
  appliesTo: Dayjs | null;
  minNights: string;
  priority: string;
  isActive: boolean;
}

const emptyRuleForm: RuleForm = {
  name: '',
  kind: 'SEASONAL',
  rate: '',
  daysOfWeek: [],
  appliesFrom: null,
  appliesTo: null,
  minNights: '',
  priority: '0',
  isActive: true,
};

interface AddonForm {
  name: string;
  description: string;
  price: string;
  unit: AddonUnit;
  isActive: boolean;
}

const emptyAddonForm: AddonForm = {
  name: '',
  description: '',
  price: '',
  unit: 'PER_STAY',
  isActive: true,
};

export function PricingPage() {
  const { t } = useLanguage();
  const { data, isLoading } = usePricing();
  const { createRule, updateRule, removeRule, createAddon, updateAddon, removeAddon } =
    usePricingActions();

  const currency = data?.rules[0]?.currency ?? data?.addons[0]?.currency ?? 'USD';

  const [ruleDialogId, setRuleDialogId] = useState<string | null | undefined>(undefined);
  const [ruleForm, setRuleForm] = useState<RuleForm>(emptyRuleForm);
  const [addonDialogId, setAddonDialogId] = useState<string | null | undefined>(undefined);
  const [addonForm, setAddonForm] = useState<AddonForm>(emptyAddonForm);

  const openNewRule = () => {
    setRuleForm(emptyRuleForm);
    setRuleDialogId(null);
  };
  const openEditRule = (r: PriceRule) => {
    setRuleForm({
      name: r.name,
      kind: r.kind,
      rate: String(r.nightlyRateMinor / 100),
      daysOfWeek: r.daysOfWeek ? r.daysOfWeek.split(',').filter(Boolean).map(Number) : [],
      appliesFrom: r.appliesFrom ? dayjs(r.appliesFrom) : null,
      appliesTo: r.appliesTo ? dayjs(r.appliesTo) : null,
      minNights: r.minNights != null ? String(r.minNights) : '',
      priority: String(r.priority),
      isActive: r.isActive,
    });
    setRuleDialogId(r.id);
  };
  const closeRuleDialog = () => setRuleDialogId(undefined);

  const saveRule = () => {
    const payload: Partial<PriceRule> = {
      name: ruleForm.name.trim(),
      kind: ruleForm.kind,
      nightlyRateMinor: Math.round(parseFloat(ruleForm.rate || '0') * 100),
      daysOfWeek: ruleForm.kind === 'WEEKEND' ? ruleForm.daysOfWeek.slice().sort().join(',') : '',
      appliesFrom:
        ruleForm.kind === 'SEASONAL' && ruleForm.appliesFrom
          ? ruleForm.appliesFrom.format('YYYY-MM-DD')
          : null,
      appliesTo:
        ruleForm.kind === 'SEASONAL' && ruleForm.appliesTo
          ? ruleForm.appliesTo.format('YYYY-MM-DD')
          : null,
      minNights: ruleForm.minNights ? Number(ruleForm.minNights) : null,
      priority: Number(ruleForm.priority || '0'),
      isActive: ruleForm.isActive,
    };
    if (ruleDialogId) {
      updateRule.mutate({ id: ruleDialogId, patch: payload }, { onSuccess: closeRuleDialog });
    } else {
      createRule.mutate(payload, { onSuccess: closeRuleDialog });
    }
  };

  const openNewAddon = () => {
    setAddonForm(emptyAddonForm);
    setAddonDialogId(null);
  };
  const openEditAddon = (a: PricingAddon) => {
    setAddonForm({
      name: a.name,
      description: a.description ?? '',
      price: String(a.priceMinor / 100),
      unit: a.unit,
      isActive: a.isActive,
    });
    setAddonDialogId(a.id);
  };
  const closeAddonDialog = () => setAddonDialogId(undefined);

  const saveAddon = () => {
    const payload: Partial<PricingAddon> = {
      name: addonForm.name.trim(),
      description: addonForm.description.trim() || null,
      priceMinor: Math.round(parseFloat(addonForm.price || '0') * 100),
      unit: addonForm.unit,
      isActive: addonForm.isActive,
    };
    if (addonDialogId) {
      updateAddon.mutate({ id: addonDialogId, patch: payload }, { onSuccess: closeAddonDialog });
    } else {
      createAddon.mutate(payload, { onSuccess: closeAddonDialog });
    }
  };

  const ruleDetails = (r: PriceRule) => {
    if (r.kind === 'WEEKEND') {
      const days = r.daysOfWeek ? r.daysOfWeek.split(',').filter(Boolean).map(Number) : [];
      return days.length
        ? days.map((d) => t(`admin.pricing.day.${DAY_KEYS[d]}`)).join(', ')
        : '—';
    }
    if (r.kind === 'SEASONAL') {
      return r.appliesFrom && r.appliesTo
        ? `${r.appliesFrom.slice(0, 10)} → ${r.appliesTo.slice(0, 10)}`
        : '—';
    }
    return '—';
  };

  return (
    <>
      <Typography variant="h4" gutterBottom>
        {t('admin.pricing.title')}
      </Typography>

      {isLoading ? (
        <Typography>{t('admin.common.loading')}</Typography>
      ) : (
        <Stack spacing={4}>
          {/* Rates */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Typography variant="h6">{t('admin.pricing.rulesTitle')}</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={openNewRule}>
                {t('admin.pricing.addRule')}
              </Button>
            </Stack>
            {(data?.rules.length ?? 0) === 0 ? (
              <Typography color="text.secondary">{t('admin.pricing.empty')}</Typography>
            ) : (
              <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('admin.pricing.col.name')}</TableCell>
                      <TableCell>{t('admin.pricing.col.kind')}</TableCell>
                      <TableCell>{t('admin.pricing.col.rate')}</TableCell>
                      <TableCell>{t('admin.pricing.col.details')}</TableCell>
                      <TableCell>{t('admin.pricing.col.priority')}</TableCell>
                      <TableCell>{t('admin.pricing.col.status')}</TableCell>
                      <TableCell align="right">{t('admin.pricing.col.actions')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data?.rules.map((r) => (
                      <TableRow key={r.id} hover>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{t(`admin.pricing.kind.${r.kind.toLowerCase()}`)}</TableCell>
                        <TableCell>{formatMoney(r.nightlyRateMinor, r.currency)}</TableCell>
                        <TableCell>{ruleDetails(r)}</TableCell>
                        <TableCell>{r.priority}</TableCell>
                        <TableCell>
                          <Switch
                            size="small"
                            checked={r.isActive}
                            onChange={(e) =>
                              updateRule.mutate({ id: r.id, patch: { isActive: e.target.checked } })
                            }
                          />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => openEditRule(r)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => {
                              if (window.confirm(t('admin.pricing.deleteRuleConfirm'))) {
                                removeRule.mutate(r.id);
                              }
                            }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>

          {/* Add-ons */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Typography variant="h6">{t('admin.pricing.addonsTitle')}</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={openNewAddon}>
                {t('admin.pricing.addAddon')}
              </Button>
            </Stack>
            {(data?.addons.length ?? 0) === 0 ? (
              <Typography color="text.secondary">{t('admin.pricing.addonsEmpty')}</Typography>
            ) : (
              <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('admin.pricing.col.name')}</TableCell>
                      <TableCell>{t('admin.pricing.price')}</TableCell>
                      <TableCell>{t('admin.pricing.unit')}</TableCell>
                      <TableCell>{t('admin.pricing.col.status')}</TableCell>
                      <TableCell align="right">{t('admin.pricing.col.actions')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data?.addons.map((a) => (
                      <TableRow key={a.id} hover>
                        <TableCell>{a.name}</TableCell>
                        <TableCell>{formatMoney(a.priceMinor, a.currency)}</TableCell>
                        <TableCell>{t(`admin.pricing.unit.${toCamel(a.unit)}`)}</TableCell>
                        <TableCell>
                          <Switch
                            size="small"
                            checked={a.isActive}
                            onChange={(e) =>
                              updateAddon.mutate({ id: a.id, patch: { isActive: e.target.checked } })
                            }
                          />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => openEditAddon(a)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => {
                              if (window.confirm(t('admin.pricing.deleteAddonConfirm'))) {
                                removeAddon.mutate(a.id);
                              }
                            }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Stack>
      )}

      {/* Rule dialog */}
      <Dialog open={ruleDialogId !== undefined} onClose={closeRuleDialog} fullWidth maxWidth="xs">
        <DialogTitle>{ruleDialogId ? t('admin.pricing.editRule') : t('admin.pricing.addRule')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label={t('admin.pricing.name')}
              value={ruleForm.name}
              onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
              autoFocus
            />
            <TextField
              select
              label={t('admin.pricing.kind')}
              value={ruleForm.kind}
              onChange={(e) => setRuleForm((f) => ({ ...f, kind: e.target.value as PriceRuleKind }))}
            >
              {KINDS.map((k) => (
                <MenuItem key={k} value={k}>
                  {t(`admin.pricing.kind.${k.toLowerCase()}`)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={`${t('admin.pricing.rate')} (${currency})`}
              type="number"
              value={ruleForm.rate}
              onChange={(e) => setRuleForm((f) => ({ ...f, rate: e.target.value }))}
              inputProps={{ min: 0, step: '0.01' }}
            />

            {ruleForm.kind === 'WEEKEND' && (
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  {t('admin.pricing.days')}
                </Typography>
                <ToggleButtonGroup
                  size="small"
                  value={ruleForm.daysOfWeek}
                  onChange={(_, days: number[]) => setRuleForm((f) => ({ ...f, daysOfWeek: days }))}
                >
                  {DAY_KEYS.map((key, i) => (
                    <ToggleButton key={key} value={i}>
                      {t(`admin.pricing.day.${key}`)}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
            )}

            {ruleForm.kind === 'SEASONAL' && (
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <Stack direction="row" spacing={2}>
                  <DatePicker
                    label={t('admin.pricing.from')}
                    value={ruleForm.appliesFrom}
                    onChange={(v) => setRuleForm((f) => ({ ...f, appliesFrom: v }))}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                  <DatePicker
                    label={t('admin.pricing.to')}
                    value={ruleForm.appliesTo}
                    minDate={ruleForm.appliesFrom ?? undefined}
                    onChange={(v) => setRuleForm((f) => ({ ...f, appliesTo: v }))}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </Stack>
              </LocalizationProvider>
            )}

            <TextField
              label={t('admin.pricing.minNights')}
              type="number"
              value={ruleForm.minNights}
              onChange={(e) => setRuleForm((f) => ({ ...f, minNights: e.target.value }))}
              inputProps={{ min: 1 }}
            />
            <TextField
              label={t('admin.pricing.priority')}
              helperText={t('admin.pricing.priorityHint')}
              type="number"
              value={ruleForm.priority}
              onChange={(e) => setRuleForm((f) => ({ ...f, priority: e.target.value }))}
            />
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch
                checked={ruleForm.isActive}
                onChange={(e) => setRuleForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              <Typography variant="body2">{t('admin.pricing.active')}</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRuleDialog}>{t('admin.pricing.cancel')}</Button>
          <Button
            variant="contained"
            disabled={!ruleForm.name.trim() || createRule.isPending || updateRule.isPending}
            onClick={saveRule}
          >
            {t('admin.pricing.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add-on dialog */}
      <Dialog open={addonDialogId !== undefined} onClose={closeAddonDialog} fullWidth maxWidth="xs">
        <DialogTitle>{addonDialogId ? t('admin.pricing.editAddon') : t('admin.pricing.addAddon')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label={t('admin.pricing.name')}
              value={addonForm.name}
              onChange={(e) => setAddonForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
              autoFocus
            />
            <TextField
              label={t('admin.pricing.description')}
              value={addonForm.description}
              onChange={(e) => setAddonForm((f) => ({ ...f, description: e.target.value }))}
              multiline
              minRows={2}
            />
            <TextField
              label={`${t('admin.pricing.price')} (${currency})`}
              type="number"
              value={addonForm.price}
              onChange={(e) => setAddonForm((f) => ({ ...f, price: e.target.value }))}
              inputProps={{ min: 0, step: '0.01' }}
            />
            <TextField
              select
              label={t('admin.pricing.unit')}
              value={addonForm.unit}
              onChange={(e) => setAddonForm((f) => ({ ...f, unit: e.target.value as AddonUnit }))}
            >
              {UNITS.map((u) => (
                <MenuItem key={u} value={u}>
                  {t(`admin.pricing.unit.${toCamel(u)}`)}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch
                checked={addonForm.isActive}
                onChange={(e) => setAddonForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              <Typography variant="body2">{t('admin.pricing.active')}</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAddonDialog}>{t('admin.pricing.cancel')}</Button>
          <Button
            variant="contained"
            disabled={!addonForm.name.trim() || createAddon.isPending || updateAddon.isPending}
            onClick={saveAddon}
          >
            {t('admin.pricing.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// 'PER_STAY' -> 'perStay', matching the i18n key suffixes.
function toCamel(unit: string): string {
  return unit
    .toLowerCase()
    .replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
