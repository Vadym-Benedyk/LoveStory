import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import UploadIcon from '@mui/icons-material/Upload';
import { useLanguage } from '@/i18n/LanguageContext';
import { useToast } from '@/shared/ui/ToastProvider';
import { useMedia, useMediaActions, type MediaCategory, type MediaItem } from '../api';

const CATEGORIES: MediaCategory[] = ['HOUSE', 'RIVER', 'BBQ', 'TUB', 'NATURE', 'OTHER'];
const categoryKey = (c: MediaCategory) => `admin.gallery.category.${c.toLowerCase()}`;

export function GalleryPage() {
  const { t } = useLanguage();
  const toast = useToast();
  const { data, isLoading } = useMedia();
  const { upload, update, remove, reorder } = useMediaActions();

  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadCategory, setUploadCategory] = useState<MediaCategory>('OTHER');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);

  const items = data ?? [];

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setStorageUnavailable(false);
    setProgress({ done: 0, total: files.length });
    for (const file of files) {
      try {
        await upload.mutateAsync({ file, category: uploadCategory });
      } catch (err: any) {
        if (err?.response?.status === 503) {
          setStorageUnavailable(true);
        } else {
          toast.error(t('admin.gallery.uploadError', { name: file.name }));
        }
      }
      setProgress((p) => (p ? { done: p.done + 1, total: p.total } : p));
    }
    setProgress(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];
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
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={2}
        mb={3}
      >
        <Typography variant="h4">{t('admin.gallery.title')}</Typography>
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
            accept="image/*"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
        </Stack>
      </Stack>

      {storageUnavailable && <Alert severity="warning" sx={{ mb: 2 }}>{t('admin.gallery.storageNotConfigured')}</Alert>}

      {isLoading ? (
        <Typography>{t('admin.common.loading')}</Typography>
      ) : items.length === 0 ? (
        <Typography color="text.secondary">{t('admin.gallery.empty')}</Typography>
      ) : (
        <Grid container spacing={2}>
          {items.map((item, index) => (
            <Grid key={item.id} item xs={12} sm={6} md={4} lg={3}>
              <Paper elevation={0} sx={{ borderRadius: 3, overflow: 'hidden', opacity: item.isActive ? 1 : 0.55 }}>
                <Box
                  sx={{
                    aspectRatio: '4 / 3',
                    bgcolor: 'action.hover',
                    backgroundImage: `url(${item.url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative',
                  }}
                >
                  <Tooltip title={t('admin.gallery.hero')}>
                    <IconButton
                      size="small"
                      onClick={() => update.mutate({ id: item.id, patch: { isHero: !item.isHero } })}
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        bgcolor: 'rgba(0,0,0,0.45)',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
                      }}
                    >
                      {item.isHero ? (
                        <StarIcon fontSize="small" sx={{ color: '#f5c518' }} />
                      ) : (
                        <StarBorderIcon fontSize="small" sx={{ color: '#fff' }} />
                      )}
                    </IconButton>
                  </Tooltip>
                </Box>

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
                            disabled={index === items.length - 1}
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
