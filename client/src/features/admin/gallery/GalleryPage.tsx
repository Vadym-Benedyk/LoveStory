import { useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Slider,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import UndoIcon from '@mui/icons-material/Undo';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import UploadIcon from '@mui/icons-material/Upload';
import SaveIcon from '@mui/icons-material/Save';
import { useLanguage } from '@/i18n/LanguageContext';
import { useToast } from '@/shared/ui/ToastProvider';
import {
  DEFAULT_HERO_OVERLAY,
  DEFAULT_HERO_URL,
  HERO_OVERLAY_STANDARD,
  heroOverlayGradient,
} from '@/shared/hero';
import { useHeroOverlay, useMedia, useSaveGallery, type MediaCategory } from '../api';
import { useGalleryDraft, type StageFailure } from './useGalleryDraft';

const CATEGORIES: MediaCategory[] = ['HOUSE', 'RIVER', 'BBQ', 'TUB', 'NATURE', 'OTHER'];
const categoryKey = (c: MediaCategory) => `admin.gallery.category.${c.toLowerCase()}`;
// What the file picker offers. The server takes JPEG/PNG/WebP/AVIF (it checks the actual bytes);
// HEIC/HEIF is converted to WebP/JPEG in the browser first (see api.ts). The extensions matter:
// browsers don't agree on the MIME type of .heic, and desktop pickers filter by it.
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,.heic,.heif';

export function GalleryPage() {
  const { t } = useLanguage();
  const toast = useToast();
  const { data, isLoading } = useMedia();
  const { data: savedOverlay, isLoading: overlayLoading } = useHeroOverlay();
  const saveGallery = useSaveGallery();
  // Every change is kept in this draft; nothing reaches the server until "Save".
  const draft = useGalleryDraft(data ?? [], savedOverlay ?? DEFAULT_HERO_OVERLAY);
  const { hero } = draft;

  const fileInput = useRef<HTMLInputElement>(null);
  const heroInput = useRef<HTMLInputElement>(null);
  const [uploadCategory, setUploadCategory] = useState<MediaCategory>('OTHER');
  const [preparing, setPreparing] = useState(false); // converting picked files (HEIC)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null); // saving
  const [storageUnavailable, setStorageUnavailable] = useState(false);

  const saving = progress !== null;
  const dirty = draft.dirtyCount > 0;
  // The server requires an alt text, so Save waits until none is empty (photos to be deleted don't count).
  const invalid = draft.photos.some((p) => !p.markedForDeletion && p.altText.trim() === '');

  // Warn before closing or reloading the tab with unsaved changes...
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // ...and before leaving this page inside the app (menu, logout, browser Back/Forward). Leaving
  // drops the draft, so the visitor chooses between staying and leaving without saving.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname,
  );

  const reportStageFailures = (failures: StageFailure[]) =>
    failures.forEach((f) =>
      toast.error(t(f.reason === 'heic' ? 'admin.gallery.heicError' : 'admin.gallery.tooLarge', { name: f.file.name })),
    );

  // Picked files only join the draft (previewed, not uploaded). asHero: a single file for the splash.
  const handlePick = async (fileList: FileList | null, asHero = false) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, asHero ? 1 : undefined);
    setPreparing(true);
    if (asHero) {
      const failure = await draft.stageHero(files[0]!);
      reportStageFailures(failure ? [failure] : []);
    } else {
      reportStageFailures(await draft.stagePhotos(files, uploadCategory));
    }
    setPreparing(false);
    if (fileInput.current) fileInput.current.value = '';
    if (heroInput.current) heroInput.current.value = '';
  };

  const handleSave = async () => {
    const plan = draft.buildPlan();
    // Deleting is the one thing that can't be undone, so confirm it (the splash replaced by a new one is deleted too).
    const removals =
      plan.deleteIds.length +
      (plan.hero.kind === 'remove' || (plan.hero.kind === 'replace' && hero.hasServerHero) ? 1 : 0);
    if (removals > 0 && !window.confirm(t('admin.gallery.saveDeleteConfirm', { n: removals }))) return;

    setStorageUnavailable(false);
    setProgress({ done: 0, total: 1 });
    try {
      const report = await saveGallery.mutateAsync({
        plan,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      draft.applyReport(report);

      for (const f of report.failures) {
        const status = (f.error as { response?: { status?: number } })?.response?.status;
        if ((f.kind === 'upload' || f.kind === 'hero') && f.name) {
          if (status === 503) setStorageUnavailable(true);
          else if (status === 413) toast.error(t('admin.gallery.tooLarge', { name: f.name }));
          else if (status === 415) toast.error(t('admin.gallery.unsupportedType', { name: f.name }));
          else toast.error(t('admin.gallery.uploadError', { name: f.name }));
        } else if (f.kind === 'patch' && f.name) {
          toast.error(t('admin.gallery.followUpError', { name: f.name }));
        }
      }
      if (report.failures.length === 0) toast.success(t('admin.gallery.saved'));
      else toast.warning(t('admin.gallery.savePartial', { n: report.failures.length }));
    } catch {
      toast.error(t('admin.gallery.saveError'));
    } finally {
      setProgress(null);
    }
  };

  const photos = draft.photos;

  return (
    <>
      {/* Title and the Save / Discard buttons; sticks under the fixed admin header while scrolling. */}
      <Box
        sx={{
          position: 'sticky',
          top: { xs: 56, sm: 64 },
          zIndex: 5,
          bgcolor: 'background.default',
          py: 1.5,
          mb: 2,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <Typography variant="h4">{t('admin.gallery.title')}</Typography>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {dirty && !saving && (
            <Typography variant="body2" color="text.secondary">
              {t('admin.gallery.unsaved', { n: draft.dirtyCount })}
            </Typography>
          )}
          <Button color="inherit" disabled={!dirty || saving} onClick={draft.discard}>
            {t('admin.gallery.discard')}
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={!dirty || saving || preparing || invalid}
            onClick={handleSave}
          >
            {saving ? t('admin.gallery.saving', progress) : t('admin.gallery.save')}
          </Button>
        </Stack>
      </Box>

      <Dialog open={blocker.state === 'blocked'} onClose={() => blocker.reset?.()}>
        <DialogTitle>{t('admin.gallery.leaveTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('admin.gallery.leaveText', { n: draft.dirtyCount })}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => blocker.proceed?.()}>
            {t('admin.gallery.leaveGo')}
          </Button>
          <Button variant="contained" autoFocus onClick={() => blocker.reset?.()}>
            {t('admin.gallery.leaveStay')}
          </Button>
        </DialogActions>
      </Dialog>

      {storageUnavailable && <Alert severity="warning" sx={{ mb: 2 }}>{t('admin.gallery.storageNotConfigured')}</Alert>}

      {/* Nothing can be changed while the save is running. */}
      <Box sx={{ opacity: saving ? 0.6 : 1, pointerEvents: saving ? 'none' : 'auto' }}>
        {/* Home-page splash (the big photo at the top of the public page) */}
        <Paper elevation={0} sx={{ borderRadius: 3, p: 2, mb: 4 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ sm: 'center' }}>
            <Box
              sx={{
                width: { xs: '100%', sm: 300 },
                flexShrink: 0,
                aspectRatio: '16 / 9',
                borderRadius: 2,
                bgcolor: 'action.hover',
                // Same darkening as on the site, so the preview shows what guests will see.
                backgroundImage: `${heroOverlayGradient(draft.overlay)}, url(${hero.url ?? DEFAULT_HERO_URL})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'grid',
                placeItems: 'end start',
                p: 1,
              }}
            >
              {hero.state === 'new' && <Chip size="small" color="warning" label={t('admin.gallery.pendingNew')} />}
              {hero.state === 'removed' && <Chip size="small" color="error" label={t('admin.gallery.pendingDelete')} />}
              {hero.state === 'saved' && !hero.url && (
                <Typography
                  variant="caption"
                  sx={{ color: '#fff', bgcolor: 'rgba(0,0,0,0.45)', px: 1, borderRadius: 1 }}
                >
                  {t('admin.gallery.heroDefault')}
                </Typography>
              )}
            </Box>
            <Stack spacing={1.5}>
              <Typography variant="h6">{t('admin.gallery.heroTitle')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('admin.gallery.heroHint')}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  variant="outlined"
                  startIcon={<UploadIcon />}
                  disabled={preparing}
                  onClick={() => heroInput.current?.click()}
                >
                  {hero.url ? t('admin.gallery.heroReplace') : t('admin.gallery.heroUpload')}
                </Button>
                {(hero.state === 'new' || (hero.state === 'saved' && hero.hasServerHero)) && (
                  <Button color="inherit" onClick={draft.removeHero}>
                    {t('admin.gallery.heroRemove')}
                  </Button>
                )}
                {hero.state !== 'saved' && (
                  <Button color="inherit" startIcon={<UndoIcon />} onClick={draft.revertHero}>
                    {t('admin.gallery.heroRevert')}
                  </Button>
                )}
              </Stack>
              <Box sx={{ maxWidth: 360, width: '100%' }}>
                <Typography variant="body2" id="hero-overlay-label">
                  {t('admin.gallery.overlayLabel', { value: draft.overlay })}
                </Typography>
                <Slider
                  aria-labelledby="hero-overlay-label"
                  min={0}
                  max={100}
                  step={5}
                  // Marks the standard look; 100 goes darker than it.
                  marks={[{ value: HERO_OVERLAY_STANDARD, label: `${HERO_OVERLAY_STANDARD}%` }]}
                  value={draft.overlay}
                  valueLabelDisplay="auto"
                  disabled={overlayLoading}
                  onChange={(_, v) => draft.setOverlay(v as number)}
                />
                <Typography variant="caption" color="text.secondary">
                  {t('admin.gallery.overlayHint', { standard: HERO_OVERLAY_STANDARD })}
                </Typography>
              </Box>
              <input
                ref={heroInput}
                type="file"
                accept={IMAGE_ACCEPT}
                hidden
                onChange={(e) => handlePick(e.target.files, true)}
              />
            </Stack>
          </Stack>
        </Paper>

        {/* Gallery photos */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ sm: 'center' }}
          spacing={2}
          mb={3}
        >
          <Typography variant="h6">{t('admin.gallery.photosTitle')}</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
            <TextField
              select
              size="small"
              label={t('admin.gallery.uploadCategory')}
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value as MediaCategory)}
              sx={{ minWidth: 180 }}
            >
              {CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>
                  {t(categoryKey(c))}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              disabled={preparing}
              onClick={() => fileInput.current?.click()}
            >
              {preparing ? t('admin.gallery.preparing') : t('admin.gallery.upload')}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept={IMAGE_ACCEPT}
              multiple
              hidden
              onChange={(e) => handlePick(e.target.files)}
            />
          </Stack>
        </Stack>

        {isLoading ? (
          <Typography>{t('admin.common.loading')}</Typography>
        ) : photos.length === 0 ? (
          <Typography color="text.secondary">{t('admin.gallery.empty')}</Typography>
        ) : (
          <Grid container spacing={2}>
            {photos.map((photo, index) => (
              <Grid key={photo.key} item xs={12} sm={6} md={4} lg={3}>
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: 3,
                    overflow: 'hidden',
                    opacity: photo.markedForDeletion ? 0.4 : photo.isActive ? 1 : 0.55,
                  }}
                >
                  <Box
                    sx={{
                      aspectRatio: '4 / 3',
                      bgcolor: 'action.hover',
                      backgroundImage: `url(${photo.thumbUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      position: 'relative',
                    }}
                  >
                    {photo.isNew && (
                      <Chip
                        size="small"
                        color="warning"
                        label={t('admin.gallery.pendingNew')}
                        sx={{ position: 'absolute', top: 8, left: 8 }}
                      />
                    )}
                    {photo.markedForDeletion && (
                      <Chip
                        size="small"
                        color="error"
                        label={t('admin.gallery.pendingDelete')}
                        sx={{ position: 'absolute', top: 8, left: 8 }}
                      />
                    )}
                  </Box>

                  <Stack spacing={1} sx={{ p: 1.5 }}>
                    <TextField
                      select
                      size="small"
                      label={t('admin.gallery.category')}
                      value={photo.category}
                      disabled={photo.markedForDeletion}
                      onChange={(e) => draft.setField(photo.key, 'category', e.target.value as MediaCategory)}
                    >
                      {CATEGORIES.map((c) => (
                        <MenuItem key={c} value={c}>
                          {t(categoryKey(c))}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      size="small"
                      label={t('admin.gallery.altText')}
                      value={photo.altText}
                      disabled={photo.markedForDeletion}
                      onChange={(e) => draft.setField(photo.key, 'altText', e.target.value)}
                      error={!photo.markedForDeletion && photo.altText.trim() === ''}
                      helperText={
                        !photo.markedForDeletion && photo.altText.trim() === ''
                          ? t('admin.gallery.altRequired')
                          : undefined
                      }
                    />
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Switch
                          size="small"
                          checked={photo.isActive}
                          disabled={photo.markedForDeletion}
                          onChange={(e) => draft.setField(photo.key, 'isActive', e.target.checked)}
                        />
                        <Typography variant="caption">{t('admin.gallery.active')}</Typography>
                      </Stack>
                      <Stack direction="row">
                        <Tooltip title={t('admin.gallery.moveUp')}>
                          <span>
                            <IconButton size="small" disabled={index === 0} onClick={() => draft.move(photo.key, -1)}>
                              <ArrowUpwardIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={t('admin.gallery.moveDown')}>
                          <span>
                            <IconButton
                              size="small"
                              disabled={index === photos.length - 1}
                              onClick={() => draft.move(photo.key, 1)}
                            >
                              <ArrowDownwardIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip
                          title={
                            photo.markedForDeletion
                              ? t('admin.gallery.undoDelete')
                              : photo.isNew
                                ? t('admin.gallery.removeNew')
                                : t('admin.gallery.delete')
                          }
                        >
                          <IconButton size="small" onClick={() => draft.toggleDelete(photo.key)}>
                            {photo.markedForDeletion ? (
                              <UndoIcon fontSize="small" />
                            ) : (
                              <DeleteOutlineIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </>
  );
}
