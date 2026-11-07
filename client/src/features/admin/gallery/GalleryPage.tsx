import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
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
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import UploadIcon from '@mui/icons-material/Upload';
import { useLanguage } from '@/i18n/LanguageContext';
import { useToast } from '@/shared/ui/ToastProvider';
import {
  DEFAULT_HERO_OVERLAY,
  DEFAULT_HERO_URL,
  HERO_OVERLAY_STANDARD,
  heroOverlayGradient,
} from '@/shared/hero';
import {
  HEIC_CONVERT_FAILED,
  useHeroOverlay,
  useMedia,
  useMediaActions,
  useSaveHeroOverlay,
  type MediaCategory,
  type MediaItem,
} from '../api';

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
  const { upload, update, remove, reorder } = useMediaActions();
  const { data: savedOverlay, isLoading: overlayLoading } = useHeroOverlay();
  const saveOverlay = useSaveHeroOverlay();
  // While the slider is being dragged the preview follows it; the value is saved on release.
  const [overlayDraft, setOverlayDraft] = useState<number | null>(null);
  const overlay = overlayDraft ?? savedOverlay ?? DEFAULT_HERO_OVERLAY;

  const fileInput = useRef<HTMLInputElement>(null);
  const heroInput = useRef<HTMLInputElement>(null);
  const [uploadCategory, setUploadCategory] = useState<MediaCategory>('OTHER');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);

  const items = data ?? [];
  // The home-page splash is its own slot, kept apart from the gallery photos below.
  const hero = items.find((i) => i.isHero);
  const photos = items.filter((i) => !i.isHero);

  // asHero: upload a single photo as the home-page splash (it replaces the current one, which is
  // deleted). Splash photos have no category; gallery uploads use the category picker.
  const handleFiles = async (fileList: FileList | null, asHero = false) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, asHero ? 1 : undefined);
    setStorageUnavailable(false);
    setProgress({ done: 0, total: files.length });
    for (const file of files) {
      try {
        await upload.mutateAsync({ file, category: asHero ? 'OTHER' : uploadCategory, isHero: asHero });
      } catch (err: any) {
        const status = err?.response?.status;
        if (err?.code === HEIC_CONVERT_FAILED) toast.error(t('admin.gallery.heicError', { name: file.name }));
        else if (status === 503) setStorageUnavailable(true);
        else if (status === 413) toast.error(t('admin.gallery.tooLarge', { name: file.name }));
        else if (status === 415) toast.error(t('admin.gallery.unsupportedType', { name: file.name }));
        else toast.error(t('admin.gallery.uploadError', { name: file.name }));
      }
      setProgress((p) => (p ? { done: p.done + 1, total: p.total } : p));
    }
    setProgress(null);
    if (fileInput.current) fileInput.current.value = '';
    if (heroInput.current) heroInput.current.value = '';
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= photos.length) return;
    const a = photos[index];
    const b = photos[target];
    if (!a || !b) return;
    reorder.mutate([
      { id: a.id, sortOrder: b.sortOrder },
      { id: b.id, sortOrder: a.sortOrder },
    ]);
  };

  const handleDelete = (item: MediaItem) => {
    if (window.confirm(t('admin.gallery.deleteConfirm'))) remove.mutate(item.id);
  };

  return (
    <>
      <Typography variant="h4" mb={3}>
        {t('admin.gallery.title')}
      </Typography>

      {storageUnavailable && <Alert severity="warning" sx={{ mb: 2 }}>{t('admin.gallery.storageNotConfigured')}</Alert>}

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
              backgroundImage: `${heroOverlayGradient(overlay)}, url(${hero?.url ?? DEFAULT_HERO_URL})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'grid',
              placeItems: 'end start',
              p: 1,
            }}
          >
            {!hero && (
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
                disabled={!!progress}
                onClick={() => heroInput.current?.click()}
              >
                {hero ? t('admin.gallery.heroReplace') : t('admin.gallery.heroUpload')}
              </Button>
              {hero && (
                <Button color="inherit" disabled={remove.isPending} onClick={() => handleDelete(hero)}>
                  {t('admin.gallery.heroRemove')}
                </Button>
              )}
            </Stack>
            <Box sx={{ maxWidth: 360, width: '100%' }}>
              <Typography variant="body2" id="hero-overlay-label">
                {t('admin.gallery.overlayLabel', { value: overlay })}
              </Typography>
              <Slider
                aria-labelledby="hero-overlay-label"
                min={0}
                max={100}
                step={5}
                // Marks the standard look; 100 goes darker than it.
                marks={[{ value: HERO_OVERLAY_STANDARD, label: `${HERO_OVERLAY_STANDARD}%` }]}
                value={overlay}
                valueLabelDisplay="auto"
                disabled={overlayLoading}
                onChange={(_, v) => setOverlayDraft(v as number)}
                onChangeCommitted={(_, v) =>
                  saveOverlay.mutate(v as number, {
                    onError: () => toast.error(t('admin.gallery.overlayError')),
                    onSettled: () => setOverlayDraft(null),
                  })
                }
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
              onChange={(e) => handleFiles(e.target.files, true)}
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
            variant="contained"
            startIcon={<UploadIcon />}
            disabled={!!progress}
            onClick={() => fileInput.current?.click()}
          >
            {progress ? t('admin.gallery.uploading', progress) : t('admin.gallery.upload')}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
        </Stack>
      </Stack>

      {isLoading ? (
        <Typography>{t('admin.common.loading')}</Typography>
      ) : photos.length === 0 ? (
        <Typography color="text.secondary">{t('admin.gallery.empty')}</Typography>
      ) : (
        <Grid container spacing={2}>
          {photos.map((item, index) => (
            <Grid key={item.id} item xs={12} sm={6} md={4} lg={3}>
              <Paper elevation={0} sx={{ borderRadius: 3, overflow: 'hidden', opacity: item.isActive ? 1 : 0.55 }}>
                <Box
                  sx={{
                    aspectRatio: '4 / 3',
                    bgcolor: 'action.hover',
                    backgroundImage: `url(${item.url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />

                <Stack spacing={1} sx={{ p: 1.5 }}>
                  <TextField
                    select
                    size="small"
                    label={t('admin.gallery.category')}
                    value={item.category}
                    onChange={(e) =>
                      update.mutate({ id: item.id, patch: { category: e.target.value as MediaCategory } })
                    }
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
                    defaultValue={item.altText}
                    onBlur={(e) => {
                      if (e.target.value !== item.altText) {
                        update.mutate({ id: item.id, patch: { altText: e.target.value } });
                      }
                    }}
                  />
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Switch
                        size="small"
                        checked={item.isActive}
                        onChange={(e) => update.mutate({ id: item.id, patch: { isActive: e.target.checked } })}
                      />
                      <Typography variant="caption">{t('admin.gallery.active')}</Typography>
                    </Stack>
                    <Stack direction="row">
                      <Tooltip title={t('admin.gallery.moveUp')}>
                        <span>
                          <IconButton size="small" disabled={index === 0} onClick={() => move(index, -1)}>
                            <ArrowUpwardIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={t('admin.gallery.moveDown')}>
                        <span>
                          <IconButton
                            size="small"
                            disabled={index === photos.length - 1}
                            onClick={() => move(index, 1)}
                          >
                            <ArrowDownwardIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={t('admin.gallery.delete')}>
                        <IconButton size="small" onClick={() => handleDelete(item)}>
                          <DeleteOutlineIcon fontSize="small" />
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
    </>
  );
}
