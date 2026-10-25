import { PageHeader } from '../../ui/workspace';
import { Button as ActionButton } from '../../ui/button';
import { Input as TextInput, Textarea } from '../../ui/input';
import { FormField } from '../../ui/workspace';
import { Table as DataTable } from '../../ui/table';
import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  User,
  Heart,
  FileText,
  ClipboardCheck,
  History,
  Plus,
  Undo2,
} from "lucide-react";
import "../treasurer/Dashboard.css";
import "./Claims.css";
import Button from "../../shared/ui/Button";
import { claimAPI } from "../../../services/api";
import { getClaimStatusMeta, isClaimFullySubmitted } from "../shared/claimMeta";
import ApproveRejectClaimModal from "./modals/ApproveRejectClaimModal";

/* Isang checkbox column lang, pero sa underlying data hiwalay talaga ang
`submitted`/`verified` booleans sa schema (walang combined field) - kaya
pag toggle, parehas silang na-update imbes na tumuro sa haka-haka na key. */
const COMBINED_COLUMN = { label: "Submitted & Verified" };

/* Possible na may keys galing sa dating global checklist ang mga lumang
claims. Panatilihing readable yun habang ang bagong claim-specific
requirements ay gagamit ng naka-store na label nila. */
const fallbackLabel = (key) =>
  key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

/* Quick-add suggestions para sa pinaka-common na required documents, para
hindi na nag re-retype ang Admin ng parehong labels sa every claim. */
const COMMON_REQUIREMENTS = [
  "Claim Application Form",
  "Death Certificate",
  "Member's Cooperative ID",
  "Beneficiary's Valid ID",
  "Barangay Certificate",
  "Burial Permit",
];

export default function ClaimDetails({ claimId, user, onBack, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingRequirement, setSavingRequirement] = useState("");
  const [verificationForm, setVerificationForm] = useState({
    verifiedBy: "",
    verificationDate: "",
    remarks: "",
  });
  const [savingVerification, setSavingVerification] = useState(false);
  const [approveRejectMode, setApproveRejectMode] = useState(null); // 'approve' | 'reject' | null
  const [newRequirement, setNewRequirement] = useState("");
  const [addingRequirement, setAddingRequirement] = useState(false);
  // The requirement just added, so an accidental add can be undone in one click.
  const [lastAdded, setLastAdded] = useState(null);
  const [removingRequirement, setRemovingRequirement] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await claimAPI.getClaimById(claimId);
      const payload = res?.data || {};
      setData(payload);
      setVerificationForm({
        verifiedBy:
          payload.claim?.verification?.verifiedBy ||
          user?.fullName ||
          user?.name ||
          user?.username ||
          "",
        verificationDate: payload.claim?.verification?.verificationDate
          ? new Date(payload.claim.verification.verificationDate)
              .toISOString()
              .split("T")[0]
          : new Date().toISOString().split("T")[0],
        remarks: payload.claim?.verification?.remarks || "",
      });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load this claim.");
    } finally {
      setLoading(false);
    }
  }, [claimId, user]);

  useEffect(() => {
    load();
  }, [load]);

  const { claim, member, beneficiary } = data || {};

  const toggleRequirement = async (reqKey, checked) => {
    if (!claim) return;
    setSavingRequirement(reqKey);
    try {
      const res = await claimAPI.updateRequirements(claim.claimId, {
        [reqKey]: { submitted: checked, verified: checked },
      });
      setData((prev) => ({ ...prev, claim: res?.data || prev.claim }));
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to update the checklist.",
      );
    } finally {
      setSavingRequirement("");
    }
  };

  const addRequirement = async (e, labelOverride) => {
    e?.preventDefault();
    const label = (labelOverride ?? newRequirement).trim();
    if (!label || !claim) return;
    setAddingRequirement(true);
    setError("");
    try {
      const before = new Set(Object.keys(claim.requirements || {}));
      const res = await claimAPI.addRequirement(claim.claimId, label);
      setData((prev) => ({ ...prev, claim: res?.data || prev.claim }));
      setNewRequirement("");
      const addedKey = Object.keys(res?.data?.requirements || {}).find((key) => !before.has(key));
      setLastAdded(addedKey ? { key: addedKey, label } : null);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to add this requirement.",
      );
    } finally {
      setAddingRequirement(false);
    }
  };

  const removeRequirement = async (reqKey) => {
    if (!claim) return;
    const item = claim.requirements?.[reqKey];
    const label = item?.label || fallbackLabel(reqKey);
    /* Undoing the add that was just made needs no confirmation; removing an
    older item, or one already marked submitted, does. */
    const isUndo = lastAdded?.key === reqKey && !item?.submitted;
    if (!isUndo && !window.confirm(`Remove "${label}" from this claim's checklist?`)) return;
    setRemovingRequirement(reqKey);
    setError("");
    try {
      const res = await claimAPI.removeRequirement(claim.claimId, reqKey);
      setData((prev) => ({ ...prev, claim: res?.data || prev.claim }));
      if (lastAdded?.key === reqKey) setLastAdded(null);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to remove this requirement.",
      );
    } finally {
      setRemovingRequirement("");
    }
  };

  const existingRequirementLabels = new Set(
    Object.keys(claim?.requirements || {}).map((key) =>
      (claim.requirements[key]?.label || fallbackLabel(key))
        .trim()
        .toLowerCase(),
    ),
  );

  const saveVerification = async () => {
    if (!claim) return;
    setSavingVerification(true);
    setError("");
    try {
      const res = await claimAPI.updateVerification(
        claim.claimId,
        verificationForm,
      );
      setData((prev) => ({ ...prev, claim: res?.data || prev.claim }));
      // Show the name the server actually recorded.
      const recordedBy = res?.data?.verification?.verifiedBy;
      if (recordedBy) setVerificationForm((f) => ({ ...f, verifiedBy: recordedBy }));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save verification information.",
      );
    } finally {
      setSavingVerification(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-coop-green"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Claims
        </button>
        <p className="text-sm text-red-600">{error || "Claim not found."}</p>
      </div>
    );
  }

  const meta = getClaimStatusMeta(claim.status);
  const canDecide = claim.status === "pending_requirements";
  const allSubmitted = isClaimFullySubmitted(claim.requirements);

  return (
    <div className="treasurer-dashboard admin-claim-details space-y-6">
      <PageHeader className="td-header">
        <div>
          <ActionButton variant="outline" onClick={onBack} className="td-button mb-3">
            <ArrowLeft className="w-4 h-4" /> Back to Claims
          </ActionButton>
          <p className="td-eyebrow">Mortuary management / Claims / Details</p>
          <h1>{claim.memberName}</h1>
          <p className="td-description ac-claim-id">
            Claim ID: {claim.claimId}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border shrink-0 ${meta.bg} ${meta.text} ${meta.border}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </PageHeader>

      {canDecide && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 ac-detail-panel p-4">
          <p className="text-sm text-slate-500">
            {allSubmitted
              ? "All requirements are submitted — this claim is ready for a decision."
              : "Approve is disabled until every requirement item is marked Submitted."}
          </p>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="danger"
              onClick={() => setApproveRejectMode("reject")}
              className="px-4"
            >
              <XCircle className="w-4 h-4" /> Reject
            </Button>
            <Button
              variant="primary"
              onClick={() => setApproveRejectMode("approve")}
              disabled={!allSubmitted}
              className="px-4"
            >
              <CheckCircle2 className="w-4 h-4" /> Approve
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Member & Beneficiary info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="ac-detail-panel p-5">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-coop-green" />
                <p className="text-sm font-bold text-slate-900">Member</p>
              </div>
              <p className="text-sm font-semibold text-slate-900">
                {claim.memberName}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Passbook No.: {claim.memberId}
              </p>
              {member && (
                <div className="mt-3 space-y-1 text-xs text-slate-500">
                  <p>{member.phoneNumber || "No phone on file"}</p>
                  <p>{member.address || "No address on file"}</p>
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                <p>
                  Date of death:{" "}
                  <span className="font-semibold text-slate-700">
                    {new Date(claim.dateOfDeath).toLocaleDateString()}
                  </span>
                </p>
                <p>
                  Date filed:{" "}
                  <span className="font-semibold text-slate-700">
                    {new Date(claim.dateFiled).toLocaleDateString()}
                  </span>
                </p>
                {claim.causeOfDeath && (
                  <p>
                    Cause:{" "}
                    <span className="font-semibold text-slate-700">
                      {claim.causeOfDeath}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <div className="ac-detail-panel p-5">
              <div className="flex items-center gap-2 mb-3">
                <Heart className="w-4 h-4 text-coop-green" />
                <p className="text-sm font-bold text-slate-900">Beneficiary</p>
              </div>
              <p className="text-sm font-semibold text-slate-900">
                {claim.beneficiaryName}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {claim.beneficiaryRelationship}
              </p>
              <div className="mt-3 space-y-1 text-xs text-slate-500">
                <p>{claim.beneficiaryContact}</p>
                {beneficiary?.address && <p>{beneficiary.address}</p>}
              </div>
              {claim.remarks && (
                <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <p className="font-semibold text-slate-700 mb-1">Remarks</p>
                  <p>{claim.remarks}</p>
                </div>
              )}
            </div>
          </div>

          {/* Requirements checklist */}
          <div className="ac-detail-panel overflow-hidden">
            <div className="border-b border-slate-100 p-5 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-coop-green" />
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Physical Requirements Checklist
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Add the physical documents required for this individual claim,
                  then track their status.
                </p>
                {canDecide && (
                  <form onSubmit={addRequirement} className="flex gap-2 mt-3">
                    <TextInput
                      value={newRequirement}
                      onChange={(e) => setNewRequirement(e.target.value)}
                      placeholder="e.g. Barangay Certificate"
                      className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={addingRequirement || !newRequirement.trim()}
                    >
                      {addingRequirement ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      Add
                    </Button>
                  </form>
                )}
                {canDecide && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {COMMON_REQUIREMENTS.filter(
                      (label) =>
                        !existingRequirementLabels.has(label.toLowerCase()),
                    ).map((label) => (
                      <button
                        key={label}
                        type="button"
                        disabled={addingRequirement}
                        onClick={() => addRequirement(null, label)}
                        className="px-2.5 py-1 rounded-full border border-slate-200 text-xs font-medium text-slate-500 hover:border-coop-green hover:text-coop-green hover:bg-coop-green/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        + {label}
                      </button>
                    ))}
                  </div>
                )}
                {canDecide && lastAdded && claim.requirements?.[lastAdded.key] && (
                  <div
                    role="status"
                    className="flex items-center justify-between gap-3 mt-3 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-xs text-emerald-800"
                  >
                    <span>
                      Added <strong>{lastAdded.label}</strong> to this claim.
                    </span>
                    <button
                      type="button"
                      onClick={() => removeRequirement(lastAdded.key)}
                      disabled={removingRequirement === lastAdded.key}
                      className="inline-flex items-center gap-1 font-semibold text-emerald-900 hover:underline disabled:opacity-50"
                    >
                      {removingRequirement === lastAdded.key ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Undo2 className="w-3.5 h-3.5" />
                      )}
                      Undo
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <DataTable className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th
                      scope="col"
                      className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide"
                    >
                      Requirement
                    </th>
                    <th
                      scope="col"
                      className="text-center px-3 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide"
                    >
                      {COMBINED_COLUMN.label}
                    </th>
                    {canDecide && (
                      <th scope="col" className="px-3 py-2.5">
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.keys(claim.requirements || {}).map((reqKey) => {
                    const checked = Boolean(
                      claim.requirements?.[reqKey]?.submitted,
                    );
                    const isSaving = savingRequirement === reqKey;
                    return (
                      <tr key={reqKey}>
                        <td className="px-5 py-3 font-medium text-slate-700">
                          {claim.requirements?.[reqKey]?.label ||
                            fallbackLabel(reqKey)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isSaving || !canDecide}
                            onChange={(e) =>
                              toggleRequirement(reqKey, e.target.checked)
                            }
                            className="w-4 h-4 accent-coop-green disabled:opacity-50"
                          />
                        </td>
                        {canDecide && (
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => removeRequirement(reqKey)}
                              disabled={isSaving || removingRequirement === reqKey}
                              title="Remove this requirement (undo an accidental add)"
                              aria-label={`Remove ${claim.requirements?.[reqKey]?.label || fallbackLabel(reqKey)}`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-rose-600 disabled:opacity-50"
                            >
                              {removingRequirement === reqKey ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Undo2 className="w-3.5 h-3.5" />
                              )}
                              Remove
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {Object.keys(claim.requirements || {}).length === 0 && (
                    <tr>
                      <td
                        colSpan={canDecide ? 3 : 2}
                        className="px-5 py-5 text-sm text-slate-400 text-center"
                      >
                        No requirements added yet. Add at least one requirement
                        before approval.
                      </td>
                    </tr>
                  )}
                </tbody>
              </DataTable>
            </div>
          </div>

          {/* Verification info */}
          <div className="ac-detail-panel p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-coop-green" />
              <p className="text-sm font-bold text-slate-900">
                Verification Information
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                  Verified By
                </label>
                {/* Read-only: the server records the signed-in staff member's name. */}
                <TextInput
                  value={verificationForm.verifiedBy}
                  readOnly
                  aria-readonly="true"
                  title="Recorded automatically from the signed-in account"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700 cursor-default focus:outline-none"
                />
              </FormField>
              <FormField>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                  Verification Date
                </label>
                <TextInput
                  type="date"
                  value={verificationForm.verificationDate}
                  onChange={(e) =>
                    setVerificationForm((f) => ({
                      ...f,
                      verificationDate: e.target.value,
                    }))
                  }
                  disabled={!canDecide}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green disabled:bg-slate-50"
                />
              </FormField>
            </div>
            <FormField className="mt-4">
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                Remarks
              </label>
              <Textarea
                value={verificationForm.remarks}
                onChange={(e) =>
                  setVerificationForm((f) => ({
                    ...f,
                    remarks: e.target.value,
                  }))
                }
                disabled={!canDecide}
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green disabled:bg-slate-50"
              />
            </FormField>
            {canDecide && (
              <div className="mt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={saveVerification}
                  disabled={savingVerification}
                >
                  {savingVerification ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : null}
                  Save Verification
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Status history */}
        <div className="ac-detail-panel p-5 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-coop-green" />
            <p className="text-sm font-bold text-slate-900">Status History</p>
          </div>
          <ol className="space-y-4">
            {(claim.statusHistory || [])
              .slice()
              .reverse()
              .map((entry, idx) => {
                const entryMeta = getClaimStatusMeta(entry.status);
                return (
                  <li key={idx} className="relative pl-5">
                    <span
                      className={`absolute left-0 top-1.5 w-2 h-2 rounded-full ${entryMeta.dot}`}
                    />
                    <p className="text-sm font-semibold text-slate-900">
                      {entryMeta.label}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(entry.changedAt).toLocaleString()} •{" "}
                      {entry.changedBy || "system"}
                    </p>
                    {entry.notes && (
                      <p className="text-xs text-slate-500 mt-1">
                        {entry.notes}
                      </p>
                    )}
                  </li>
                );
              })}
            {(!claim.statusHistory || claim.statusHistory.length === 0) && (
              <p className="text-xs text-slate-400">No history yet.</p>
            )}
          </ol>

          {claim.rejection?.reason && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-bold text-rose-600 uppercase tracking-wide mb-1">
                Rejection Reason
              </p>
              <p className="text-xs text-slate-600">{claim.rejection.reason}</p>
            </div>
          )}

          {claim.deduction?.processedAt && (
            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-1">
              <p className="font-bold text-slate-700 uppercase tracking-wide mb-1">
                Deduction
              </p>
              <p>
                ₱{claim.deduction.amountPerMember} ×{" "}
                {claim.deduction.membersCharged} members
              </p>
              <p>
                Total collected: ₱
                {claim.deduction.totalCollected?.toLocaleString?.() ??
                  claim.deduction.totalCollected}
              </p>
            </div>
          )}

          {claim.payout?.releasedAt && (
            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-1">
              <p className="font-bold text-slate-700 uppercase tracking-wide mb-1">
                Payout
              </p>
              <p>
                ₱
                {claim.payout.amount?.toLocaleString?.() ?? claim.payout.amount}{" "}
                released to {claim.beneficiaryName}
              </p>
            </div>
          )}
        </div>
      </div>

      <ApproveRejectClaimModal
        isOpen={Boolean(approveRejectMode)}
        mode={approveRejectMode}
        claim={claim}
        user={user}
        onClose={() => setApproveRejectMode(null)}
        onDone={() => {
          load();
          onChanged?.();
        }}
      />
    </div>
  );
}
