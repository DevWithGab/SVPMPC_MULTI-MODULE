// Form validation functions

// Philippine mobile numbers: 11 digits, starting with 09 (e.g. 09171234567).
export const PH_PHONE_REGEX = /^09\d{9}$/;

/* Gamitin bilang onChange handler ng field para hindi na tuloy tumanggap
ng letters/symbols o lumagpas sa valid PH mobile number habang nagtype
yung user - tinatanggal lahat ng hindi digit at may cap na 11 characters. */
export const sanitizePhoneInput = (value) => (value || '').replace(/\D/g, '').slice(0, 11);

/* Nagbabalik ng error message kung invalid, o '' kung valid na PH mobile
number yung value (o blangko, kapag false yung required). */
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
