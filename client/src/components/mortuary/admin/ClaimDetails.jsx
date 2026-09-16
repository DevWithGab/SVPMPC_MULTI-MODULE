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
} from "lucide-react";
import Button from "../../shared/ui/Button";
import { claimAPI } from "../../../services/api";
import {
  getClaimStatusMeta,
  REQUIREMENT_LABELS,
  REQUIREMENT_KEYS,
  isClaimFullySubmitted,
} from "./claimMeta";
import ApproveRejectClaimModal from "./modals/ApproveRejectClaimModal";

// One checkbox column, but the underlying data still has separate
// `submitted`/`verified` booleans on the schema (no combined field exists) —
// so toggling it flips both together instead of pointing at a fictional key.
const COMBINED_COLUMN = { label: "Submitted & Verified" };

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
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-coop-green mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Claims
          </button>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {claim.memberName}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Claim ID: {claim.claimId}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border shrink-0 ${meta.bg} ${meta.text} ${meta.border}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </div>

      {canDecide && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4">
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
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-coop-green" />
                <p className="text-sm font-bold text-slate-900">Member</p>
              </div>
              <p className="text-sm font-semibold text-slate-900">
                {claim.memberName}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                ID: {claim.memberId}
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

            <div className="bg-white border border-slate-200 rounded-xl p-5">
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
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="border-b border-slate-100 p-5 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-coop-green" />
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Physical Requirements Checklist
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Documents are submitted in person at the cooperative office —
                  this only tracks status.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">
                      Requirement
                    </th>
                    <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">
                      {COMBINED_COLUMN.label}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {REQUIREMENT_KEYS.map((reqKey) => {
                    const checked = Boolean(
                      claim.requirements?.[reqKey]?.submitted,
                    );
                    const isSaving = savingRequirement === reqKey;
                    return (
                      <tr key={reqKey}>
                        <td className="px-5 py-3 font-medium text-slate-700">
                          {REQUIREMENT_LABELS[reqKey]}
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Verification info */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-coop-green" />
              <p className="text-sm font-bold text-slate-900">
                Verification Information
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                  Verified By
                </label>
                <input
                  value={verificationForm.verifiedBy}
                  onChange={(e) =>
                    setVerificationForm((f) => ({
                      ...f,
                      verifiedBy: e.target.value,
                    }))
                  }
                  disabled={!canDecide}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coop-green/30 focus:border-coop-green disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                  Verification Date
                </label>
                <input
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
              </div>
            </div>
            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                Remarks
              </label>
              <textarea
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
            </div>
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
        <div className="bg-white border border-slate-200 rounded-xl p-5 h-fit">
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
