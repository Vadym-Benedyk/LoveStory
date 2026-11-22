// A password <TextField> with an eye button that shows what was typed, so a long password can be checked
// before it is sent. Hidden again on every mount; the button never takes the focus away from the field.
import { useState } from 'react';
import { IconButton, InputAdornment, TextField, type TextFieldProps } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useLanguage } from '@/i18n/LanguageContext';

export function PasswordField(props: Omit<TextFieldProps, 'type'>) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const label = visible ? t('admin.password.hide') : t('admin.password.show');

  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      slotProps={{
        ...props.slotProps,
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                edge="end"
                aria-label={label}
                title={label}
                aria-pressed={visible}
                onClick={() => setVisible((v) => !v)}
                // Keep the caret in the field: a mousedown on the button would blur it.
                onMouseDown={(e) => e.preventDefault()}
              >
                {visible ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
