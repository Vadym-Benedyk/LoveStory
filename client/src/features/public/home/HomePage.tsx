import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Container, Grid, Paper, Rating, Stack, Typography } from '@mui/material';
import LandscapeIcon from '@mui/icons-material/Landscape';
import OutdoorGrillIcon from '@mui/icons-material/OutdoorGrill';
import HotTubIcon from '@mui/icons-material/HotTub';
import PhishingIcon from '@mui/icons-material/Phishing';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import PlaceIcon from '@mui/icons-material/Place';
import { useReviews, useSiteContent } from '@/shared/api/queries';
import styles from './HomePage.module.scss';

const amenities = [
  { icon: <PhishingIcon />, title: 'River fishing', body: 'Cast a line steps from your door at first light.' },
  { icon: <OutdoorGrillIcon />, title: 'Open-fire BBQ', body: 'A dedicated grill area for cooking over flame.' },
  { icon: <HotTubIcon />, title: 'Heated outdoor tub', body: 'Soak under the open sky after sunset.' },
  { icon: <LandscapeIcon />, title: 'Total privacy', body: 'An isolated 60 m² house, all to yourself.' },
];

export function HomePage() {
  const { data } = useSiteContent();
  const { data: reviews } = useReviews();
  const copy = data?.copy ?? {};

  return (
    <>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroOverlay} />
        <Container className={styles.heroInner}>
          <Typography variant="h1" className={styles.heroTitle}>
            {copy['hero.headline'] ?? 'Your private riverside escape'}
          </Typography>
          <Typography className={styles.heroSub}>
            {copy['hero.subheadline'] ??
              'A cozy 60 m² retreat on a quiet river — fishing, fire-cooking, and a heated tub under the open sky.'}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button size="large" variant="contained" component={RouterLink} to="/booking">
              Check availability
            </Button>
            <Button size="large" variant="outlined" color="inherit" href="#gallery">
              View the house
            </Button>
          </Stack>
        </Container>
      </section>

      {/* About */}
      <Container component="section" id="about" className={styles.section}>
        <Typography variant="h2" gutterBottom>
          {copy['about.title'] ?? 'A house by the water, all to yourself'}
        </Typography>
        <Typography className={styles.lead}>
          {copy['about.body'] ??
            'Tucked away on an isolated stretch of riverbank, this 60 m² guest house is built for slowing down.'}
        </Typography>
      </Container>

      {/* Gallery placeholder (wired to /gallery in T4.4) */}
      <Container component="section" id="gallery" className={styles.section}>
        <Typography variant="h2" gutterBottom>
          The retreat
        </Typography>
        <Grid container spacing={2}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Grid key={i} item xs={6} md={4}>
              <div className={styles.galleryTile} aria-hidden />
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Amenities */}
      <Box component="section" id="amenities" className={styles.sectionAlt}>
        <Container>
          <Typography variant="h2" gutterBottom>
            What makes it special
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

      {/* Pricing teaser */}
      <Container component="section" id="pricing" className={styles.section}>
        <Typography variant="h2" gutterBottom>
          Simple, honest pricing
        </Typography>
        <Typography className={styles.lead}>
          Whole-house nightly rate with weekend and seasonal options. See exact prices and
          available dates on the booking page.
        </Typography>
        <Button variant="contained" component={RouterLink} to="/booking" sx={{ mt: 2 }}>
          See dates &amp; prices
        </Button>
      </Container>

      {/* Reviews */}
      {reviews && reviews.reviews.length > 0 && (
        <Box component="section" className={styles.sectionAlt}>
          <Container>
            <Stack direction="row" alignItems="center" spacing={2} mb={2}>
              <Typography variant="h2">Guest stories</Typography>
              {reviews.summary.average != null && (
                <Rating value={reviews.summary.average} precision={0.5} readOnly />
              )}
            </Stack>
            <Grid container spacing={3}>
              {reviews.reviews.slice(0, 3).map((r) => (
                <Grid key={r.id} item xs={12} md={4}>
                  <Paper className={styles.reviewCard} elevation={0}>
                    <Rating value={r.rating} readOnly size="small" />
                    <Typography variant="subtitle1">{r.title}</Typography>
                    <Typography variant="body2">{r.body}</Typography>
                    <Typography variant="caption">
                      {r.authorName} · {r.stayMonth}
                    </Typography>
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
          Finding us
        </Typography>
        <Typography className={styles.lead}>
          {data?.settings?.address || 'A quiet, isolated spot with direct river access.'}
        </Typography>
        {data?.settings?.mapEmbed ? (
          <Box className={styles.map} dangerouslySetInnerHTML={{ __html: data.settings.mapEmbed }} />
        ) : (
          <div className={styles.mapPlaceholder}>Map embed configured by the owner in settings.</div>
        )}
      </Container>

      {/* Contact */}
      <Box component="section" id="contact" className={styles.sectionAlt}>
        <Container>
          <Typography variant="h2" gutterBottom>
            {copy['contact.title'] ?? 'Get in touch'}
          </Typography>
          <Typography className={styles.lead}>
            {copy['contact.note'] ??
              'Bookings are confirmed personally by phone. Reach out any time — we’d love to host you.'}
          </Typography>
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
                  <Typography variant="h6">Call us</Typography>
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
                  <Typography variant="h6">Email</Typography>
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
                  <Typography variant="h6">Find us</Typography>
                  <Typography variant="body2">{data.settings.address}</Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
          <Button size="large" variant="contained" component={RouterLink} to="/booking" sx={{ mt: 4 }}>
            Check availability
          </Button>
        </Container>
      </Box>
    </>
  );
}
