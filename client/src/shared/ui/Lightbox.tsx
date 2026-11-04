import { useEffect } from 'react';
import { Box, Dialog, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

export interface LightboxImage {
  url: string;
  alt: string;
}

interface Props {
  images: LightboxImage[];
  index: number | null;
  onClose: () => void;
  onChange: (index: number) => void;
}

export function Lightbox({ images, index, onClose, onChange }: Props) {
  const open = index !== null;
  const current = index !== null ? images[index] : undefined;

  const prev = () => index !== null && onChange((index - 1 + images.length) % images.length);
  const next = () => index !== null && onChange((index + 1) % images.length);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index]);

  if (!current) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      slotProps={{ paper: { sx: { bgcolor: 'rgba(20,18,15,0.97)', boxShadow: 'none' } } }}
    >
      <Box sx={{ position: 'relative', display: 'grid', placeItems: 'center', minHeight: '70vh', p: 1 }}>
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: 'absolute', top: 8, right: 8, color: '#fff', zIndex: 1 }}
        >
          <CloseIcon />
        </IconButton>
        {images.length > 1 && (
          <IconButton
            aria-label="Previous image"
            onClick={prev}
            sx={{ position: 'absolute', left: 8, color: '#fff', zIndex: 1 }}
          >
            <ArrowBackIosNewIcon />
          </IconButton>
        )}
        <Box
          component="img"
          src={current.url}
          alt={current.alt}
          sx={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 1 }}
        />
        {images.length > 1 && (
          <IconButton
            aria-label="Next image"
            onClick={next}
            sx={{ position: 'absolute', right: 8, color: '#fff', zIndex: 1 }}
          >
            <ArrowForwardIosIcon />
          </IconButton>
        )}
      </Box>
    </Dialog>
  );
}
