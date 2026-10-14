import React, { useState, useEffect, useCallback } from "react";
import { ShieldCheck, Pencil, History, Loader2 } from "lucide-react";
import { benefitCapSettingAPI } from "../../../services/api";
import UpdateBenefitCapModal from "./modals/UpdateBenefitCapModal";
import { Pagination, PaginationInfo } from "../../ui/pagination";
import { usePagination } from "../../../hooks/usePagination";

export default function BenefitCapSettings({ user }) {
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const { page, limit, setPage } = usePagination(1, 10);

  const load = useCallback(async (pageNum) => {
    setLoading(true);
    setError("");
    try {
      const [currentRes, historyRes] = await Promise.all([
        benefitCapSettingAPI.getCurrentCap(),
        benefitCapSettingAPI.getCapHistory({ page: pageNum, limit }),
      ]);
      setCurrent(currentRes?.data || null);
      setHistory(Array.isArray(historyRes?.data) ? historyRes.data : []);
      setHistoryTotal(historyRes?.pagination?.total ?? 0);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to load benefit cap settings.",
      );
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load(page);
  }, [load, page]);

  const totalPages = Math.ceil(historyTotal / limit) || 1;

  return (
    <div className="fs-section">
      <p className="fs-section-description">
        The maximum death benefit released per claim. Collections above this
        amount from the per-member assessment become cooperative income instead
        of being paid out.
      </p>

      {loading ? (
        <div className="fs-loading" role="status" aria-label="Loading settings">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <>
          {/* Current cap */}
          <div className="fs-panel fs-current">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="fs-current-icon">
                  <ShieldCheck className="w-6 h-6 text-coop-green" />
                </div>
                <div>
                  <p className="fs-value-label">
                    Current Cap
                  </p>
                  <p className="fs-value">
                    ₱
                    {current?.amount?.toLocaleString?.() ??
                      current?.amount ??
                      "—"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Effective{" "}
                    {current?.effectiveDate
                      ? new Date(current.effectiveDate).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUpdateModal(true)}
                className="td-button td-primary"
              >
                <Pencil className="w-4 h-4" /> Update Cap
              </button>
            </div>
          </div>

          {/* History */}
          <div className="fs-panel fs-history">
            <div className="fs-panel-heading">
              <History className="w-4 h-4 text-coop-green" />
              <p className="text-sm font-bold text-slate-900">Cap History</p>
            </div>
            <div className="fs-table-scroll" role="region" aria-label="Settings history" tabIndex={0}>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th scope="col" className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th scope="col" className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Effective Date
                    </th>
                    <th scope="col" className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                      Set By
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.length > 0 ? (
                    history.map((setting) => (
                      <tr
                        key={setting.settingId}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-6 py-3 text-sm font-semibold text-slate-900">
                          ₱
                          {setting.amount?.toLocaleString?.() ?? setting.amount}
                        </td>
                        <td className="px-6 py-3 text-sm text-slate-600">
                          {new Date(setting.effectiveDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${
                              setting.status === "active"
                                ? "bg-green-50 text-coop-green border-green-200"
                                : "bg-slate-100 text-slate-500 border-slate-200"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${setting.status === "active" ? "bg-coop-green" : "bg-slate-400"}`}
                            />
                            {setting.status === "active"
                              ? "Active"
                              : "Superseded"}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm text-slate-500 hidden sm:table-cell">
                          {setting.createdBy || "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-12 text-center text-sm text-slate-400"
                      >
                        {error || "No cap history yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {historyTotal > 0 && (
              <div className="fs-pagination">
                <PaginationInfo currentPage={page} limit={limit} total={historyTotal} />
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  hasNextPage={page < totalPages}
                  hasPrevPage={page > 1}
                />
              </div>
            )}
          </div>
        </>
      )}

      <UpdateBenefitCapModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        currentAmount={current?.amount ?? 50000}
        user={user}
        onSaved={() => { setPage(1); load(1); }}
      />
    </div>
  );
}
