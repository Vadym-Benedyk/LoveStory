import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Container, Grid, Paper, Rating, Stack, Typography } from '@mui/material';
import LandscapeIcon from '@mui/icons-material/Landscape';
import OutdoorGrillIcon from '@mui/icons-material/OutdoorGrill';
import HotTubIcon from '@mui/icons-material/HotTub';
import PhishingIcon from '@mui/icons-material/Phishing';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import PlaceIcon from '@mui/icons-material/Place';
import PetsIcon from '@mui/icons-material/Pets';
import { PhotoGrid } from '../gallery/PhotoGrid';
import { HeroImage } from './HeroImage';
import { PricingSection } from './PricingSection';
import { textStyle } from './textStyle';
import { useHeroTextParallax } from './useHeroTextParallax';
import { useGallery, useReviews, useSiteContent } from '@/shared/api/queries';
import { useLanguage } from '@/i18n/LanguageContext';
import { DEFAULT_HERO_OVERLAY, DEFAULT_HERO_URL, heroOverlayGradient } from '@/shared/hero';
import { Lightbox } from '@/shared/ui/Lightbox';
import styles from './HomePage.module.scss';

// The hero text waits for the photo, but never longer than this: on a slow connection readable
// text is better than an empty hero.
const HERO_TEXT_MAX_WAIT_MS = 3000;

// The home page shows this many thumbnails; the rest are behind "All photos" (and in the viewer).
const HOME_GALLERY_LIMIT = 6;

export function HomePage() {
  const { data, isPending: contentPending } = useSiteContent();
  const { data: reviews } = useReviews();
  const { data: gallery, isPending: galleryPending } = useGallery();
  const { t } = useLanguage();
  // Text edited in the admin (Content) wins; the built-in translation is the fallback.
  const copy = (key: string) => data?.copy?.[key] || t(key);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const photos = gallery?.photos ?? []; // the splash is separate and not part of the gallery
  // Don't pick a picture until the server has answered, so the default never flashes before the
  // real splash photo. (The hero's light background shows meanwhile; if the request fails, default.)
  const heroSrc = galleryPending ? null : (gallery?.hero?.url ?? DEFAULT_HERO_URL);
  const heroOverlay = gallery?.heroOverlay ?? DEFAULT_HERO_OVERLAY;
  // The photo has loaded (and is fading in): the hero switches to the light-on-photo look, with the
  // darkening and any text colour set in the admin. Compared by src, so a different photo starts
  // "not ready" again without any reset logic.
  const [readySrc, setReadySrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const heroReady = heroSrc !== null && readySrc === heroSrc;
  const photoSettled = heroReady || (heroSrc !== null && failedSrc === heroSrc);

  // The hero text appears once, when both the photo and the site texts are in. Showing it earlier
  // meant the built-in wording first and then the one edited in the admin, which wraps differently
  // and, the block being vertically centred, shifted the whole hero ("the headline jumps").
  // If the photo is slow or fails, the text still shows after HERO_TEXT_MAX_WAIT_MS (dark, on the
  // light background). Once shown it stays (switching language doesn't hide it again).
  const [waitedLongEnough, setWaitedLongEnough] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setWaitedLongEnough(true), HERO_TEXT_MAX_WAIT_MS);
    return () => window.clearTimeout(id);
  }, []);
  const textReady = !contentPending && (photoSettled || waitedLongEnough);
  const [textShown, setTextShown] = useState(false);
  useEffect(() => {
    if (textReady) setTextShown(true);
  }, [textReady]);
  const showHeroText = textShown || textReady;
  // The text scrolls up faster than the page, over the photo pinned behind it.
  const heroTextRef = useRef<HTMLDivElement>(null);
  useHeroTextParallax(heroTextRef);

  const amenities = [
    { icon: <PhishingIcon />, title: t('amenity.fishing.title'), body: t('amenity.fishing.body') },
    { icon: <OutdoorGrillIcon />, title: t('amenity.bbq.title'), body: t('amenity.bbq.body') },
    { icon: <HotTubIcon />, title: t('amenity.tub.title'), body: t('amenity.tub.body') },
    { icon: <LandscapeIcon />, title: t('amenity.privacy.title'), body: t('amenity.privacy.body') },
    { icon: <PetsIcon />, title: t('amenity.wildlife.title'), body: t('amenity.wildlife.body') },
  ];

  return (
    <>
      {/* Hero: the photo (with its darkening) is pinned behind the page while the text scrolls up
          faster than the page (parallax; see .heroWrap in the stylesheet, useHeroTextParallax) */}
      <div className={`${styles.heroWrap} ${heroReady ? styles.heroReady : ''}`}>
        <div className={styles.heroBg}>
          {heroSrc && (
            <HeroImage
              key={heroSrc}
              src={heroSrc}
              onLoaded={() => setReadySrc(heroSrc)}
              onFailed={() => setFailedSrc(heroSrc)}
            />
          )}
          <div className={styles.heroOverlay} style={{ background: heroOverlayGradient(heroOverlay) }} />
        </div>
        <section className={styles.hero}>
          <Container
            ref={heroTextRef}
            className={`${styles.heroInner} ${showHeroText ? styles.heroInnerShown : ''}`}
          >
            {/* A custom text colour applies only once the photo is in: it is meant for text on the
                photo and could vanish on the light background used if the photo is slow or fails. */}
            <Typography
              variant="h1"
              className={styles.heroTitle}
              style={textStyle(
                data?.copy?.['hero.headline.font'],
                heroReady ? data?.copy?.['hero.headline.color'] : undefined,
              )}
            >
              {copy('hero.headline')}
            </Typography>
            <Typography
              className={styles.heroSub}
              style={textStyle(
                data?.copy?.['hero.subheadline.font'],
                heroReady ? data?.copy?.['hero.subheadline.color'] : undefined,
              )}
            >
              {copy('hero.subheadline')}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
              <Button size="large" variant="contained" component={RouterLink} to="/booking">
                {t('cta.checkAvailability')}
              </Button>
              <Button size="large" variant="outlined" color="inherit" href="#gallery">
                {t('cta.viewHouse')}
              </Button>
            </Stack>
          </Container>
        </section>
      </div>

      {/* Everything below the hero slides over it as you scroll, hiding it (parallax; see .pageBody) */}
      <div className={styles.pageBody}>
        {/* About */}
        <Container component="section" id="about" className={styles.section}>
          <Typography variant="h2" gutterBottom>
            {copy('about.title')}
          </Typography>
          <Typography className={styles.lead} style={{ whiteSpace: 'pre-line' }}>
            {copy('about.body')}
          </Typography>
        </Container>

        {/* Gallery */}
        <Container component="section" id="gallery" className={styles.section}>
          <Typography variant="h2" gutterBottom>
            {t('gallery.title')}
          </Typography>
          <PhotoGrid photos={photos} limit={HOME_GALLERY_LIMIT} placeholders={6} onOpen={setLightboxIndex} />
          {photos.length > HOME_GALLERY_LIMIT && (
            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Button variant="outlined" size="large" component={RouterLink} to="/gallery">
                {t('gallery.all', { n: photos.length })}
              </Button>
            </Box>
          )}
        </Container>

        <Lightbox
          images={photos.map((p) => ({ url: p.url, alt: p.altText, thumbnailUrl: p.thumbnailUrl }))}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onChange={setLightboxIndex}
        />

        {/* Amenities */}
        <Box component="section" id="amenities" className={styles.sectionAlt}>
          <Container>
            <Typography variant="h2" gutterBottom>
              {t('amenities.title')}
            </Typography>
            <Grid container spacing={3}>
              {amenities.map((a) => (
                <Grid key={a.title} item xs={12} sm={6} md={3}>
                  <Paper className={styles.amenityCard} elevation={0}>
                    <span className={styles.amenityIcon}>{a.icon}</span>
                    <Typography variant="h6">{a.title}</Typography>
                    <Typography variant="body2">{a.body}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* Prices: tariffs, what's included, paid extras, terms (all from the DB) */}
        <PricingSection />

        {/* Reviews */}
        {reviews && reviews.reviews.length > 0 && (
          <Box component="section" className={styles.sectionAlt}>
            <Container>
              <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                <Typography variant="h2">{t('reviews.title')}</Typography>
                {reviews.summary.average != null && (
                  <Rating value={reviews.summary.average} precision={0.5} readOnly />
                )}
              </Stack>
              <Grid container spacing={3}>
                {reviews.reviews.slice(0, 3).map((r) => (
                  <Grid key={r.id} item xs={12} md={4}>
                    <Paper className={styles.reviewCard} elevation={0}>
                      <Rating value={r.rating} readOnly size="small" />
                      {r.title && <Typography variant="subtitle1">{r.title}</Typography>}
                      <Typography variant="body2">{r.body}</Typography>
                      <Typography variant="caption">
                        {[r.authorName, r.stayMonth].filter(Boolean).join(' · ')}
                      </Typography>
                      {r.ownerReply && (
                        <div className={styles.ownerReply}>
                          <Typography variant="caption" fontWeight={600} display="block">
                            {t('reviews.ownerReply')}
                          </Typography>
                          <Typography variant="body2">{r.ownerReply}</Typography>
                        </div>
                      )}
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Container>
          </Box>
        )}

        {/* Location */}
        <Container component="section" id="location" className={styles.section}>
          <Typography variant="h2" gutterBottom>
            {t('location.title')}
          </Typography>
          <Typography className={styles.lead}>
            {data?.settings?.address || t('location.fallback')}
          </Typography>
          {data?.settings?.mapEmbedUrl ? (
            // The server only ever returns a validated Google Maps embed URL — no raw HTML.
            <iframe
              className={styles.map}
              src={data.settings.mapEmbedUrl}
              title={t('location.title')}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          ) : (
            <div className={styles.mapPlaceholder}>{t('location.mapPlaceholder')}</div>
          )}
        </Container>

        {/* Contact */}
        <Box component="section" id="contact" className={styles.sectionAlt}>
          <Container>
            <Typography variant="h2" gutterBottom>
              {t('contact.title')}
            </Typography>
            <Typography className={styles.lead}>{copy('contact.note')}</Typography>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              {data?.settings?.phone && (
                <Grid item xs={12} sm={6} md={4}>
                  <Paper
                    className={styles.contactCard}
                    elevation={0}
                    component="a"
                    href={`tel:${data.settings.phone.replace(/[^\d+]/g, '')}`}
                  >
                    <span className={styles.amenityIcon}>
                      <PhoneIcon />
                    </span>
                    <Typography variant="h6">{t('contact.call')}</Typography>
                    <Typography variant="body2">{data.settings.phone}</Typography>
                  </Paper>
                </Grid>
              )}
              {data?.settings?.email && (
                <Grid item xs={12} sm={6} md={4}>
                  <Paper
                    className={styles.contactCard}
                    elevation={0}
                    component="a"
                    href={`mailto:${data.settings.email}`}
                  >
                    <span className={styles.amenityIcon}>
                      <EmailIcon />
                    </span>
                    <Typography variant="h6">{t('contact.email')}</Typography>
                    <Typography variant="body2">{data.settings.email}</Typography>
                  </Paper>
                </Grid>
              )}
              {data?.settings?.address && (
                <Grid item xs={12} sm={6} md={4}>
                  <Paper className={styles.contactCard} elevation={0}>
                    <span className={styles.amenityIcon}>
                      <PlaceIcon />
                    </span>
                    <Typography variant="h6">{t('contact.find')}</Typography>
                    <Typography variant="body2">{data.settings.address}</Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </Container>
        </Box>
      </div>
    </>
  );
}
