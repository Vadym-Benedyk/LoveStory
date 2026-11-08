import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button, CircularProgress, Container, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useGallery } from '@/shared/api/queries';
import { useLanguage } from '@/i18n/LanguageContext';
import { Lightbox } from '@/shared/ui/Lightbox';
import { PhotoGrid } from './PhotoGrid';
import styles from './AllPhotosPage.module.scss';

// "All photos": every gallery photo as a grid; the home page only shows the first few.
export function AllPhotosPage() {
  const { t } = useLanguage();
  const { data: gallery, isPending } = useGallery();
  const photos = gallery?.photos ?? [];
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // Arriving from the middle of the home page: start at the top of this page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <Container component="section" className={styles.page}>
      {/* Back to the gallery section of the home page, not just its top. */}
      <Button component={RouterLink} to="/#gallery" color="inherit" startIcon={<ArrowBackIcon />} className={styles.back}>
        {t('gallery.back')}
      </Button>
      <Typography variant="h2" gutterBottom>
        {t('gallery.title')}
      </Typography>

      {isPending ? (
        <CircularProgress />
      ) : photos.length === 0 ? (
        <Typography color="text.secondary">{t('gallery.noPhotos')}</Typography>
      ) : (
        <PhotoGrid photos={photos} onOpen={setViewerIndex} />
      )}

      <Lightbox
        images={photos.map((p) => ({ url: p.url, alt: p.altText, thumbnailUrl: p.thumbnailUrl }))}
        index={viewerIndex}
        onClose={() => setViewerIndex(null)}
        onChange={setViewerIndex}
      />
    </Container>
  );
}
