import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, Plus, Pencil, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import Modal from '../shared/Modal';
import Button from '../../shared/ui/Button';
import { claimRequirementAPI } from '../../../services/api';
import AddEditClaimRequirementModal from './modals/AddEditClaimRequirementModal';

// The admin-configurable list of physical documents a claim must collect
// before it can be approved. Each claim snapshots whichever of these exist
// at filing time (see server/modules/mortuary/controllers/claimController.js),
// so adding, renaming, or removing an entry here never touches a claim
// that's already in progress — it only shapes what NEW claims start with,
// and how existing claims display the requirements they already captured.
export default function ClaimRequirementSettings() {
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editorState, setEditorState] = useState(null); // { editing: row | null } | null
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await claimRequirementAPI.getAll();
      setRequirements(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load claim requirements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      await claimRequirementAPI.remove(pendingDelete._id);
      setPendingDelete(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to remove this requirement.');
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="text-slate-500 text-sm max-w-xl">
          Documents a member's beneficiary must submit in person before a death claim can be
          approved. Add, rename, or remove items here — claims already in progress keep whatever
          checklist they started with.
        </p>
        <Button onClick={() => setEditorState({ editing: null })} className="shrink-0">
          <Plus className="w-4 h-4" /> Add Requirement
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="border-b border-slate-100 p-5 flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-coop-green" />
          <p className="text-sm font-bold text-slate-900">Requirement Checklist Items ({requirements.length})</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : requirements.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            No requirements configured yet — add one above.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {requirements.map((req) => (
              <li key={req._id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <span className="text-sm font-medium text-slate-700">{req.label}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setEditorState({ editing: req })}
                    aria-label={`Edit ${req.label}`}
                    title="Edit"
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-coop-green hover:bg-green-50 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPendingDelete(req)}
                    aria-label={`Remove ${req.label}`}
                    title="Remove"
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AddEditClaimRequirementModal
        isOpen={Boolean(editorState)}
        editing={editorState?.editing || null}
        onClose={() => setEditorState(null)}
        onSaved={load}
      />

      <Modal
        isOpen={Boolean(pendingDelete)}
        onClose={() => !deleting && setPendingDelete(null)}
        title="Remove Requirement"
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3 p-4 border border-red-200 bg-red-50 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">
              This removes <span className="font-semibold">{pendingDelete?.label}</span> from the
              checklist new claims will use. Claims already filed keep their own copy of this
              requirement untouched.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={confirmDelete}
              disabled={deleting}
              className="flex-1"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
