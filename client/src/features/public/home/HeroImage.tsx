import { useEffect, useRef, useState } from 'react';
import { HERO_PORTRAIT_MEDIA } from '@/shared/hero';
import styles from './HomePage.module.scss';

// Full-bleed hero photo. It starts transparent over the hero's dark background colour and fades
// in once the file has actually loaded, instead of popping in (or swapping another picture).
// Mount it with `key={src}` so a different photo gets its own fade. `onLoaded` lets the hero reveal
// its text (in the light-on-photo look) at the same moment; `onFailed` lets it show the text anyway
// when the file can't be loaded.
// `portraitSrc` (the 9:16 crop of the splash) is what a phone held upright loads instead of `src`: it shows
// exactly the middle strip of the photo that `object-fit: cover` leaves on such a screen.
export function HeroImage({
  src,
  portraitSrc,
  onLoaded,
  onFailed,
}: {
  src: string;
  portraitSrc?: string | null;
  onLoaded?: () => void;
  onFailed?: () => void;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  const markLoaded = () => {
    setLoaded(true);
    onLoaded?.();
  };

  // A cached image can be complete before React attaches onLoad, so check for that too.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth > 0) markLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <picture>
      {portraitSrc && <source media={HERO_PORTRAIT_MEDIA} srcSet={portraitSrc} />}
      <img
        ref={ref}
        src={src}
        alt="" // decorative: the headline over it carries the meaning
        decoding="async"
        // The largest thing on the page: fetch it before the other images. (React 18 only passes the
        // attribute through in lower case.)
        {...{ fetchpriority: 'high' }}
        onLoad={markLoaded}
        onError={onFailed}
        className={`${styles.heroImage} ${loaded ? styles.heroImageLoaded : ''}`}
      />
    </picture>
  );
}
