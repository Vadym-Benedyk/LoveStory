// Ukrainian phone mask for MUI <TextField> (InputProps.inputComponent): "+380 (XX) XXX-XX-XX".
// Emits the unmasked digits ("380501112233") through a regular onChange event.
import { forwardRef } from 'react';
import { IMaskInput } from 'react-imask';

// `0` is IMask's "any digit" placeholder, so the 0 of the fixed 380 code must be escaped.
export const UA_PHONE_MASK = '+{38\\0} (00) 000-00-00';

interface Props {
  name?: string;
  onChange: (event: { target: { name?: string; value: string } }) => void;
}

// People type/paste numbers in many shapes: "050 111 22 33", "+380501112233", "380…".
// The "+380" part is fixed in the mask, so drop a leading national "0" or a repeated country
// code before the digits are placed — otherwise "0501112233" would become "+380 (05) 011-12-23".
function prepare(chars: string, masked: { unmaskedValue: string }) {
  let digits = chars.replace(/\D/g, '');
  const atStart = masked.unmaskedValue.replace(/^380/, '') === '';
  if (atStart) {
    if (digits.startsWith('380')) digits = digits.slice(3);
    else if (digits.startsWith('80') && digits.length >= 11) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = digits.slice(1);
  }
  return digits;
}

export const PhoneMaskInput = forwardRef<HTMLInputElement, Props>(function PhoneMaskInput(
  { onChange, name, ...other },
  ref,
) {
  return (
    <IMaskInput
      {...other}
      name={name}
      mask={UA_PHONE_MASK}
      prepare={prepare}
      unmask
      lazy={false} // show "+380 (__) ___-__-__" so the expected format is obvious
      inputRef={ref}
      onAccept={(value: string) => onChange({ target: { name, value } })}
    />
  );
});

// Unmasked value is complete: "380" + 9 digits.
export const isCompleteUaPhone = (digits: string) => /^380\d{9}$/.test(digits);
