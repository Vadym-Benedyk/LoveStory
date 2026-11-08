import { useRef } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/counter.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';
import { useLanguage } from '@/i18n/LanguageContext';
import type { LightboxImage } from './Lightbox';

interface Props {
  images: LightboxImage[];
  index: number | null; // null = closed
  onClose: () => void;
  onChange: (index: number) => void;
}

// Full-screen photo viewer on yet-another-react-lightbox: swipe / drag and arrow keys to move,
// pinch, double-tap or wheel to zoom, fullscreen, a thumbnail strip and a counter.
// Don't import this file directly: Lightbox.tsx loads it on demand, as a separate chunk.
export default function PhotoViewer({ images, index, onClose, onChange }: Props) {
  const { t } = useLanguage();
  // While closing, `index` becomes null; keep the last one so the slide doesn't jump during the fade-out.
  const lastIndex = useRef(0);
  if (index !== null) lastIndex.current = index;

  return (
    <Lightbox
      open={index !== null}
      close={onClose}
      index={lastIndex.current}
      slides={images.map((image) => ({ src: image.url, alt: image.alt, thumbnail: image.thumbnailUrl ?? undefined }))}
      on={{ view: ({ index: current }) => onChange(current) }}
      plugins={[Fullscreen, Thumbnails, Zoom, Counter]}
      // Lets the thumbnail strip be hidden, which matters on a phone where it takes room from the photo.
      thumbnails={{ showToggle: true }}
      styles={{ container: { backgroundColor: 'rgba(20, 18, 15, 0.97)' } }}
      labels={{
        Previous: t('lightbox.previous'),
        Next: t('lightbox.next'),
        Close: t('lightbox.close'),
        Carousel: t('lightbox.carousel'),
        Lightbox: t('lightbox.lightbox'),
        'Photo gallery': t('lightbox.gallery'),
        'Enter Fullscreen': t('lightbox.enterFullscreen'),
        'Exit Fullscreen': t('lightbox.exitFullscreen'),
        'Zoom in': t('lightbox.zoomIn'),
        'Zoom out': t('lightbox.zoomOut'),
        'Show thumbnails': t('lightbox.showThumbnails'),
        'Hide thumbnails': t('lightbox.hideThumbnails'),
      }}
    />
  );
}
