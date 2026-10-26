import React, { useRef, useState } from 'react';
import { AlertCircle, CheckCircle, Loader, UserPlus } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Modal } from '../ui/modal';
import { sanitizePhoneInput } from '../../utils/validation';
import { MEMBER_VALIDATION_FIELDS, validateMemberField } from '../../utils/memberValidation';

/* Iisang "Create member" form para sa Super Admin at sa Mortuary admin portal -
parehong fields, validation, at confirmation, kahit magkaiba ang endpoint na
tinatawag (ipinapasa bilang `createMember`). */

/* Labeled field na may required marker, inline validation error, at helper
text - para consistent yung lahat ng field sa form (error prevention +
recognition-over-recall, ginawa once imbes na per-field). */
export const MemberFormField = React.forwardRef(
  ({ label, name, value, onChange, onBlur, error, hint, required, type = 'text', placeholder, maxLength, inputMode, listId }, ref) => {
    const errorId = error ? `${name}-error` : undefined;
    return (
      <div>
        <label htmlFor={name} className="block text-sm font-bold text-slate-700 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <Input
          id={name}
          ref={ref}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          maxLength={maxLength}
          inputMode={inputMode}
          list={listId}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className={error ? 'border-red-300 focus-visible:ring-red-400' : ''}
        />
        {error ? (
          <p id={errorId} className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </p>
        ) : hint ? (
          <p className="text-xs text-slate-400 mt-1.5">{hint}</p>
        ) : null}
      </div>
    );
  },
);
MemberFormField.displayName = 'MemberFormField';

const emptyMemberForm = () => ({
  passbookNo: '',
  memberName: '',
  email: '',
  phoneNumber: '',
  barangay: '',
  address: '',
  beneficiaries: '',
  beneficiaryRelationship: '',
  beneficiaryContactNumber: '',
  dateOfBirth: '',
  gender: 'male',
  modules: ['attendance', 'mortuary'],
});

/**
 * @param {{ isOpen: boolean, onClose: () => void, barangays?: string[],
 *   createMember: (member: object) => Promise<{ member: object }>,
 *   onCreated?: (member: object) => void, onError?: (message: string) => void }} props
 */
export default function CreateMemberModal({ isOpen, onClose, barangays = [], createMember, onCreated, onError }) {
  const [newMember, setNewMember] = useState(emptyMemberForm);
  const [memberErrors, setMemberErrors] = useState({});
  const [memberTouched, setMemberTouched] = useState({});
  const [createdMember, setCreatedMember] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const memberFieldRefs = useRef({});

  const reset = () => {
    setNewMember(emptyMemberForm());
    setMemberErrors({});
    setMemberTouched({});
    setCreatedMember(null);
    setFormError('');
  };

  const isCreateFormDirty = () =>
    MEMBER_VALIDATION_FIELDS.concat('beneficiaries', 'beneficiaryRelationship').some(
      (field) => (newMember[field] || '').trim() !== ''
    );

  const handleMemberFieldChange = (name, rawValue) => {
    /* Prevention over correction: tanggalin agad ang non-numeric at
    itigil ang pag-accept ng keystrokes pagkalampas ng 11 digits,
    imbes na mag-flag na lang ng error message pagkatapos. */
    const value = (name === 'phoneNumber' || name === 'beneficiaryContactNumber') ? sanitizePhoneInput(rawValue) : rawValue;
    setNewMember((prev) => ({ ...prev, [name]: value }));
    if (memberTouched[name]) {
      setMemberErrors((prev) => ({ ...prev, [name]: validateMemberField(name, value) }));
    }
  };

  const handleMemberFieldBlur = (name) => {
    setMemberTouched((prev) => ({ ...prev, [name]: true }));
    setMemberErrors((prev) => ({ ...prev, [name]: validateMemberField(name, newMember[name]) }));
  };

  const finishCreateMember = () => {
    reset();
    onClose();
  };

  /* Pag isasara yung form (X, backdrop, Escape, Cancel) habang may
  unsaved input, magtatanong muna ng confirmation, para hindi na-silent
  discard yung work sa isang stray click (error prevention / user
  control & freedom). */
  const requestCloseCreateModal = () => {
    if (createdMember) {
      finishCreateMember();
      return;
    }
    if (isCreateFormDirty() && !window.confirm("Discard the new member details you've entered?")) {
      return;
    }
    finishCreateMember();
  };

  const handleCreateMember = async (e) => {
    e.preventDefault();

    /* I-validate muna lahat client-side bago pa man tumama sa network -
    nahuhuli agad yung mistake imbes na mag-round-trip pa sa server
    (error prevention). */
    const nextErrors = {};
    MEMBER_VALIDATION_FIELDS.forEach((field) => {
      nextErrors[field] = validateMemberField(field, newMember[field]);
    });
    setMemberErrors(nextErrors);
    setMemberTouched(
      MEMBER_VALIDATION_FIELDS.reduce((acc, field) => ({ ...acc, [field]: true }), {})
    );

    const firstInvalidField = MEMBER_VALIDATION_FIELDS.find((field) => nextErrors[field]);
    if (firstInvalidField) {
      memberFieldRefs.current[firstInvalidField]?.focus();
      return;
    }

    setLoading(true);
    setFormError('');
    try {
      const response = await createMember(newMember);
      setCreatedMember(response.member);
      onCreated?.(response.member);
    } catch (error) {
      const message = error.response?.data?.message || 'Error creating member';
      if (/passbook/i.test(message)) {
        setMemberErrors((prev) => ({ ...prev, passbookNo: message }));
        setMemberTouched((prev) => ({ ...prev, passbookNo: true }));
        memberFieldRefs.current.passbookNo?.focus();
      } else if (/email/i.test(message)) {
        /* Ipapakita agad sa ilalim ng field na may problema, hindi lang
        toast na kailangan pang i-map balik ng admin sa tamang field. */
        setMemberErrors((prev) => ({ ...prev, email: message }));
        setMemberTouched((prev) => ({ ...prev, email: true }));
        memberFieldRefs.current.email?.focus();
      } else if (onError) {
        onError(message);
      } else {
        setFormError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={requestCloseCreateModal}
      title={createdMember ? 'Member Created' : 'Create New Member'}
      className="max-w-2xl"
    >
      {createdMember ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-900">
                {createdMember.memberName} was added successfully.
              </p>
              <p className="text-xs text-emerald-700 mt-1">
                Passbook No.: {createdMember.memberId}. The member record is ready for attendance and mortuary management.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={finishCreateMember}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={handleCreateMember} noValidate className="space-y-4">
          <p className="text-xs text-slate-500 -mt-1">
            Fields marked <span className="text-red-500 font-bold">*</span> are required.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <MemberFormField
              label="Passbook No."
              name="passbookNo"
              value={newMember.passbookNo}
              onChange={(value) => handleMemberFieldChange('passbookNo', value)}
              onBlur={() => handleMemberFieldBlur('passbookNo')}
              error={memberTouched.passbookNo ? memberErrors.passbookNo : ''}
              placeholder="000123"
              hint="Enter the unique passbook number. Leave blank to generate one automatically."
              ref={(el) => (memberFieldRefs.current.passbookNo = el)}
            />
            <MemberFormField
              label="Full Name"
              name="memberName"
              required
              value={newMember.memberName}
              onChange={(value) => handleMemberFieldChange('memberName', value)}
              onBlur={() => handleMemberFieldBlur('memberName')}
              error={memberTouched.memberName ? memberErrors.memberName : ''}
              placeholder="Juan Dela Cruz"
              maxLength={100}
              ref={(el) => (memberFieldRefs.current.memberName = el)}
            />
            <MemberFormField
              label="Email (optional)"
              name="email"
              type="email"
              value={newMember.email}
              onChange={(value) => handleMemberFieldChange('email', value)}
              onBlur={() => handleMemberFieldBlur('email')}
              error={memberTouched.email ? memberErrors.email : ''}
              placeholder="name@example.com"
              ref={(el) => (memberFieldRefs.current.email = el)}
            />
            <MemberFormField
              label="Phone Number (optional)"
              name="phoneNumber"
              type="tel"
              inputMode="numeric"
              value={newMember.phoneNumber}
              onChange={(value) => handleMemberFieldChange('phoneNumber', value)}
              onBlur={() => handleMemberFieldBlur('phoneNumber')}
              error={memberTouched.phoneNumber ? memberErrors.phoneNumber : ''}
              hint={!memberErrors.phoneNumber ? 'Optional contact number. 11 digits, e.g. 09171234567.' : undefined}
              placeholder="09171234567"
              maxLength={11}
              ref={(el) => (memberFieldRefs.current.phoneNumber = el)}
            />
            <MemberFormField
              label="Barangay"
              name="barangay"
              required
              value={newMember.barangay}
              onChange={(value) => handleMemberFieldChange('barangay', value)}
              onBlur={() => handleMemberFieldBlur('barangay')}
              error={memberTouched.barangay ? memberErrors.barangay : ''}
              placeholder="e.g., Domang"
              listId="barangay-options"
              ref={(el) => (memberFieldRefs.current.barangay = el)}
            />
          </div>
          <datalist id="barangay-options">
            {barangays.map((barangay) => (
              <option key={barangay} value={barangay} />
            ))}
          </datalist>

          <MemberFormField
            label="Address"
            name="address"
            required
            value={newMember.address}
            onChange={(value) => handleMemberFieldChange('address', value)}
            onBlur={() => handleMemberFieldBlur('address')}
            error={memberTouched.address ? memberErrors.address : ''}
            placeholder="House No., Street, Barangay"
            maxLength={200}
            ref={(el) => (memberFieldRefs.current.address = el)}
          />

          <div className="grid grid-cols-2 gap-4">
            <MemberFormField
              label="Beneficiaries"
              name="beneficiaries"
              value={newMember.beneficiaries}
              onChange={(value) => handleMemberFieldChange('beneficiaries', value)}
              hint="Optional — comma-separate multiple beneficiaries."
              placeholder="e.g., Maria Dela Cruz"
              maxLength={200}
            />
            <MemberFormField
              label="Relationship"
              name="beneficiaryRelationship"
              value={newMember.beneficiaryRelationship}
              onChange={(value) => handleMemberFieldChange('beneficiaryRelationship', value)}
              hint="Optional — how the beneficiary is related to the member."
              placeholder="e.g., Wife, Son, Sibling"
              maxLength={50}
            />
          </div>

          <div>
            <MemberFormField
              label="Beneficiary Contact Number"
              name="beneficiaryContactNumber"
              value={newMember.beneficiaryContactNumber}
              onChange={(value) => handleMemberFieldChange('beneficiaryContactNumber', value)}
              onBlur={() => handleMemberFieldBlur('beneficiaryContactNumber')}
              error={memberTouched.beneficiaryContactNumber ? memberErrors.beneficiaryContactNumber : ''}
              hint="Optional — if provided along with a beneficiary name above, they're registered automatically instead of showing as 'Not Registered' in Beneficiaries."
              placeholder="09171234567"
              maxLength={11}
              inputMode="numeric"
              ref={(el) => (memberFieldRefs.current.beneficiaryContactNumber = el)}
            />
          </div>

          {formError && (
            <p role="alert" className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {formError}
            </p>
          )}

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={requestCloseCreateModal}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Create Member
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
