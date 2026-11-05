import { useState } from 'react';
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
import { PricingSection } from './PricingSection';
import { heroTextStyle } from './heroStyle';
import { useGallery, useReviews, useSiteContent } from '@/shared/api/queries';
import { useLanguage } from '@/i18n/LanguageContext';
import { Lightbox } from '@/shared/ui/Lightbox';
import styles from './HomePage.module.scss';

export function HomePage() {
  const { data } = useSiteContent();
  const { data: reviews } = useReviews();
  const { data: gallery } = useGallery();
  const { t } = useLanguage();
  // Text edited in the admin (Content) wins; the built-in translation is the fallback.
  const copy = (key: string) => data?.copy?.[key] || t(key);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const photos = gallery ?? [];
  const heroPhoto = photos.find((p) => p.isHero);

  const amenities = [
    { icon: <PhishingIcon />, title: t('amenity.fishing.title'), body: t('amenity.fishing.body') },
    { icon: <OutdoorGrillIcon />, title: t('amenity.bbq.title'), body: t('amenity.bbq.body') },
    { icon: <HotTubIcon />, title: t('amenity.tub.title'), body: t('amenity.tub.body') },
    { icon: <LandscapeIcon />, title: t('amenity.privacy.title'), body: t('amenity.privacy.body') },
    { icon: <PetsIcon />, title: t('amenity.wildlife.title'), body: t('amenity.wildlife.body') },
  ];

  return (
    <>
      {/* Hero */}
      <section
        className={styles.hero}
        style={
          heroPhoto
            ? {
                backgroundImage: `linear-gradient(rgba(43, 38, 32, 0.35), rgba(43, 38, 32, 0.55)), url(${heroPhoto.url})`,
              }
            : undefined
        }
      >
        <div className={styles.heroOverlay} />
        <Container className={styles.heroInner}>
          <Typography
            variant="h1"
            className={styles.heroTitle}
            style={heroTextStyle(data?.copy?.['hero.headline.font'], data?.copy?.['hero.headline.color'])}
          >
            {copy('hero.headline')}
          </Typography>
          <Typography
            className={styles.heroSub}
            style={heroTextStyle(data?.copy?.['hero.subheadline.font'], data?.copy?.['hero.subheadline.color'])}
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

      {/* About */}
      <Container component="section" id="about" className={styles.section}>
        <Typography variant="h2" gutterBottom>
          {copy('about.title')}
        </Typography>
        <Typography className={styles.lead}>{copy('about.body')}</Typography>
      </Container>

      {/* Gallery */}
      <Container component="section" id="gallery" className={styles.section}>
        <Typography variant="h2" gutterBottom>
          {t('gallery.title')}
        </Typography>
        <Grid container spacing={2}>
          {photos.length > 0
            ? photos.map((photo, i) => (
                <Grid key={photo.id} item xs={6} md={4}>
                  <button
                    type="button"
                    className={styles.galleryTile}
                    style={{ backgroundImage: `url(${photo.url})` }}
                    onClick={() => setLightboxIndex(i)}
                    aria-label={photo.altText}
                  />
                </Grid>
              ))
            : Array.from({ length: 6 }).map((_, i) => (
                <Grid key={i} item xs={6} md={4}>
                  <div className={styles.galleryTile} aria-hidden />
                </Grid>
              ))}
        </Grid>
      </Container>

      <Lightbox
        images={photos.map((p) => ({ url: p.url, alt: p.altText }))}
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
                  href={`tel:${data.settings.phone}`}
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
          <Button size="large" variant="contained" component={RouterLink} to="/booking" sx={{ mt: 4 }}>
            {t('cta.checkAvailability')}
          </Button>
        </Container>
      </Box>
    </>
  );
}
