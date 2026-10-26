import { validatePhPhone } from './validation';

/* Validation ng member registration/edit forms (Super Admin at Mortuary). */
export const MEMBER_VALIDATION_FIELDS = ['passbookNo', 'memberName', 'email', 'phoneNumber', 'barangay', 'address', 'beneficiaryContactNumber'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateMemberField = (name, rawValue) => {
  const value = (rawValue || '').trim();
  switch (name) {
    case 'memberName':
      if (!value) return 'Full name is required.';
      if (value.length < 2) return "Enter the member's full name.";
      return '';
    case 'email':
      if (!value) return '';
      if (!EMAIL_REGEX.test(value)) return 'Enter a valid email address.';
      return '';
    case 'phoneNumber':
      if (!value) return '';
      /* Shared with mortuary Beneficiary forms - same 11-digit,
      starts-with-09 PH mobile rule, dito lang ginagamit sa buong app. */
      return validatePhPhone(value);
    case 'barangay':
      if (!value) return 'Barangay is required.';
      return '';
    case 'address':
      if (!value) return 'Address is required.';
      return '';
    case 'beneficiaryContactNumber':
      /* Optional - vavalidate lang kung may talagang na-enter. Kung
      naprovide (kasama ang beneficiary name at relationship), sapat na
      yun para auto-register agad bilang proper Beneficiary record
      imbes na iwan as free text na kailangan pang kumpletuhin ng admin. */
      if (!value) return '';
      return validatePhPhone(value);
    default:
      return '';
  }
};
