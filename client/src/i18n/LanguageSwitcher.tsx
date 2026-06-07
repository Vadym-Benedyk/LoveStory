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
          borderColor: contrast ? 'rgba(255,255,255,0.4)' : 'divider',
          color: contrast ? '#fbf8f1' : 'text.primary',
        },
        '& .Mui-selected': {
          bgcolor: contrast ? 'rgba(255,255,255,0.18)' : 'primary.main',
          color: contrast ? '#fff' : 'primary.contrastText',
          '&:hover': { bgcolor: contrast ? 'rgba(255,255,255,0.28)' : 'primary.dark' },
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
