// Phone numbers are stored normalized as "+<digits>" (E.164-like) so the admin "call" links and
// notifications always work, whatever formatting the guest typed ("+38 (050) 111-22-33",
// "0501112233", ...). The site's form masks Ukrainian numbers; the API also accepts
// international ones.

// Returns "+<digits>" or null when it can't be a phone number.
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  // Ukrainian national format "0XX XXX XX XX" → add the 38 country code.
  if (/^0\d{9}$/.test(digits)) digits = `38${digits}`;
  // E.164 allows up to 15 digits; 10 is a sane minimum for a callable number with country code.
  if (digits.length < 10 || digits.length > 15) return null;
  // A Ukrainian number (+380) always has exactly 9 digits after the code.
  if (digits.startsWith('380') && digits.length !== 12) return null;
  return `+${digits}`;
}
