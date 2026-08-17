// Form validation functions

// Philippine mobile numbers: 11 digits, starting with 09 (e.g. 09171234567).
export const PH_PHONE_REGEX = /^09\d{9}$/;

// Use as the field's onChange handler so it can't even accept letters/symbols
// or grow past a valid PH mobile number while the user is typing — strips
// anything that isn't a digit and caps the length at 11.
export const sanitizePhoneInput = (value) => (value || '').replace(/\D/g, '').slice(0, 11);

// Returns an error message if invalid, or '' if the value is a valid PH
// mobile number (or blank, when required is false).
export const validatePhPhone = (value, { required = true } = {}) => {
  const digits = (value || '').trim();
  if (!digits) return required ? 'Contact number is required.' : '';
  if (!PH_PHONE_REGEX.test(digits)) {
    return 'Enter an 11-digit PH mobile number starting with 09 (e.g. 09171234567).';
  }
  return '';
};

const validation = { PH_PHONE_REGEX, sanitizePhoneInput, validatePhPhone };
export default validation;
