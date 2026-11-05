// Public Terms & Conditions page: /terms. Text lives in termsContent.ts (uk / en).
import { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button, Container, Stack, Typography } from '@mui/material';
import { useLanguage } from '@/i18n/LanguageContext';
import { useSiteContent } from '@/shared/api/queries';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { TERMS, TERMS_KEY, parseTerms } from './termsContent';
import styles from './TermsPage.module.scss';

export function TermsPage() {
  const { lang } = useLanguage();
  const { data } = useSiteContent();
  // Text saved in the admin (Content → Terms) wins; the built-in text is the fallback.
  const saved = data?.copy?.[TERMS_KEY]?.trim();
  const doc = saved ? parseTerms(saved, TERMS[lang]) : TERMS[lang];
  const phone = data?.settings?.phone;
  const email = data?.settings?.email;

  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.title = `${doc.title} — LoveStory`;
  }, [doc.title]);

  return (
    <Container component="article" maxWidth="md" className={styles.page}>
      <Button component={RouterLink} to="/" startIcon={<ArrowBackIcon />} sx={{ mb: 2, ml: -1 }}>
        {doc.back}
      </Button>
      <Typography variant="h1" sx={{ fontSize: { xs: '2.2rem', md: '3rem' } }} gutterBottom>
        {doc.title}
      </Typography>
      <p className={styles.updated}>{doc.updated}</p>
      <Typography sx={{ maxWidth: '65ch' }}>{doc.intro}</Typography>

      <nav className={styles.toc} aria-label={doc.tocTitle}>
        <Typography variant="h6">{doc.tocTitle}</Typography>
        <ol>
          {doc.sections.map((s, i) => (
            <li key={i}>
              <a href={`#terms-${i + 1}`}>{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      {doc.sections.map((s, i) => (
        <section key={i} id={`terms-${i + 1}`} className={styles.section}>
          <Typography variant="h4" component="h2" gutterBottom sx={{ fontSize: { xs: '1.5rem', md: '1.8rem' } }}>
            {i + 1}. {s.title}
          </Typography>
          {s.paragraphs.map((p, j) => (
            <p key={j}>{p}</p>
          ))}
          {s.items && (
            <ul>
              {s.items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <div className={styles.contact}>
        <Typography variant="h5" gutterBottom>
          {doc.contactTitle}
        </Typography>
        <Typography sx={{ mb: 1 }}>{doc.contactBody}</Typography>
        {(phone || email) && (
          <Stack spacing={0.5}>
            {phone && <a href={`tel:${phone}`}>{phone}</a>}
            {email && <a href={`mailto:${email}`}>{email}</a>}
          </Stack>
        )}
      </div>

      <Button component={RouterLink} to="/" variant="outlined" sx={{ mt: 4 }}>
        {doc.back}
      </Button>
    </Container>
  );
}
