import { lazy, Suspense, useRef } from 'react';

export interface LightboxImage {
  url: string; // the full photo, shown in the viewer
  alt: string;
  thumbnailUrl?: string | null; // a light preview for the thumbnail strip (older photos have none)
}

interface Props {
  images: LightboxImage[];
  index: number | null; // null = closed
  onClose: () => void;
  onChange: (index: number) => void;
}

// The viewer (swipe, zoom, fullscreen, thumbnails: ~20 KB gzipped) is a separate chunk, so visitors who
// never open a photo never download it. Call preloadPhotoViewer() on hover / touch to warm it up.
const loadViewer = () => import('./PhotoViewer');
const PhotoViewer = lazy(loadViewer);
export const preloadPhotoViewer = () => {
  void loadViewer();
};

// Once opened it stays mounted (closed), so the close animation can play.
export function Lightbox(props: Props) {
  const opened = useRef(false);
  if (props.index !== null) opened.current = true;
  if (!opened.current) return null;
  return (
    <Suspense fallback={null}>
      <PhotoViewer {...props} />
    </Suspense>
  );
}
