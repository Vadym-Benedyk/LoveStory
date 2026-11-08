import { Grid } from '@mui/material';
import { preloadPhotoViewer } from '@/shared/ui/Lightbox';
import type { GalleryMedia } from '@/shared/types';
import styles from './PhotoGrid.module.scss';

interface Props {
  photos: GalleryMedia[];
  // Show only the first `limit` photos; the last shown tile then says "+N" for the rest.
  limit?: number;
  // How many soft placeholder tiles to show while there are no photos yet.
  placeholders?: number;
  // `index` counts within ALL photos, not just the shown ones: the viewer covers every photo.
  onOpen: (index: number) => void;
}

// Grid of photo tiles, shared by the home page (a few thumbnails) and the "All photos" page.
export function PhotoGrid({ photos, limit, placeholders = 0, onOpen }: Props) {
  const shown = limit ? photos.slice(0, limit) : photos;
  const hidden = photos.length - shown.length;

  return (
    <Grid container spacing={2}>
      {shown.map((photo, i) => (
        <Grid key={photo.id} item xs={6} md={4}>
          <button
            type="button"
            className={`${styles.tile} ${styles.photo}`}
            onClick={() => onOpen(i)}
            // Fetch the viewer's code now, so it opens without a delay on the first click.
            onPointerEnter={preloadPhotoViewer}
            onFocus={preloadPhotoViewer}
            onTouchStart={preloadPhotoViewer}
          >
            {/* The light thumbnail (photos from before thumbnails existed fall back to the full image).
                Only the first screen of tiles loads at once; the rest waits until scrolled near. */}
            <img src={photo.thumbnailUrl ?? photo.url} alt={photo.altText} loading="lazy" decoding="async" />
            {hidden > 0 && i === shown.length - 1 && <span className={styles.more}>+{hidden}</span>}
          </button>
        </Grid>
      ))}
      {photos.length === 0 &&
        Array.from({ length: placeholders }).map((_, i) => (
          <Grid key={i} item xs={6} md={4}>
            <div className={styles.tile} aria-hidden />
          </Grid>
        ))}
    </Grid>
  );
}
