import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { LANGS, type Lang } from './translations';
import { useLanguage } from './LanguageContext';

interface Props {
  /** sx passthrough for placement/sizing */
  size?: 'small' | 'medium';
  contrast?: boolean; // light-on-dark variant (e.g. inside the dark mobile menu)
}

export function LanguageSwitcher({ size = 'small', contrast = false }: Props) {
  const { lang, setLang } = useLanguage();

  return (
    <ToggleButtonGroup
      exclusive
      size={size}
      value={lang}
      onChange={(_, v: Lang | null) => v && setLang(v)}
      aria-label="Language"
      sx={{
        '& .MuiToggleButton-root': {
          px: 1.25,
          py: 0.25,
          fontWeight: 600,
          lineHeight: 1.2,
          border: '1px solid',
          borderColor: contrast ? 'rgba(251,248,241,0.5)' : 'divider',
          // Inactive language on a dark header: dimmed cream text.
          color: contrast ? 'rgba(251,248,241,0.75)' : 'text.primary',
          '&:hover': contrast ? { bgcolor: 'rgba(251,248,241,0.12)', color: '#fbf8f1' } : {},
        },
        // Active language: solid fill that clearly stands out from the background —
        // forest green on light headers, cream with dark text on the dark admin header.
        '& .MuiToggleButton-root.Mui-selected': {
          bgcolor: contrast ? 'background.paper' : 'primary.main',
          color: contrast ? 'text.primary' : 'primary.contrastText',
          borderColor: contrast ? 'background.paper' : undefined,
          '&:hover': { bgcolor: contrast ? '#efe8da' : 'primary.dark' },
        },
      }}
    >
      {LANGS.map((l) => (
        <ToggleButton key={l.code} value={l.code} aria-label={l.label}>
          {l.short}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
