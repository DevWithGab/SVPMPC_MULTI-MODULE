import React, { useEffect, useMemo, useState } from "react";
import { Search, X, Users, CheckCircle2, XCircle } from "lucide-react";
import { formatDate, formatTime } from "../../../utils/date";
import { Pagination, PaginationInfo } from "../../ui/pagination";
import { usePagination } from "../../../hooks/usePagination";

// Shows who actually showed up to an event vs. who didn't — rendered as the
// body of its own page (not a modal, not a cramped scroll box inside a
// card). "Absent" is every active member without a present log for this
// event — there's no separate "invited/expected" roster in this app, so
// active membership is the whole pool compared against. A name/ID search
// sits alongside the All/Present/Absent filter so a specific member can be
// found quickly, and the list itself is paginated instead of a single long
// scroll.
export default function EventAttendeesPanel({ event, presentLogs, allMembers, onClose }) {
  const [filter, setFilter] = useState("all"); // 'all' | 'present' | 'absent'
  const [search, setSearch] = useState("");
  const { page, limit, setPage } = usePagination(1, 10);

  const { presentList, absentList } = useMemo(() => {
    const presentByMemberId = new Map();
    (presentLogs || []).forEach((log) => {
      const memberId = log.memberId || log.member_id;
      if (!memberId || presentByMemberId.has(memberId)) return;
      presentByMemberId.set(memberId, {
        memberId,
        memberName: log.memberName || "Unknown member",
        barangay: log.barangay || "",
        scanTime: log.scanTime || log.timestamp || null,
      });
    });

    const activeMembers = (allMembers || []).filter(
      (m) => (m.status || "active").toLowerCase() === "active",
    );

    const absent = activeMembers
      .filter((m) => {
        const memberId = m.memberId || m.id || m._id;
        return !presentByMemberId.has(memberId);
      })
      .map((m) => ({
        memberId: m.memberId || m.id || m._id,
        memberName: m.memberName || m.name || "Unknown member",
        barangay: m.barangay || "",
      }));

    return {
      presentList: Array.from(presentByMemberId.values()),
      absentList: absent,
    };
  }, [presentLogs, allMembers]);

  const byFilter =
    filter === "present" ? presentList : filter === "absent" ? absentList : [...presentList, ...absentList];

  const query = search.trim().toLowerCase();
  const visibleList = query
    ? byFilter.filter(
        (m) =>
          String(m.memberName || "").toLowerCase().includes(query) ||
          String(m.memberId || "").toLowerCase().includes(query),
      )
    : byFilter;

  const total = visibleList.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const pagedList = visibleList.slice((page - 1) * limit, page * limit);

  // The result set's size changes whenever the filter or search changes —
  // reset to page 1 so pagination doesn't strand the viewer on an empty page.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search]);

  if (!event) return null;

  return (
    <div>
      <div className="px-6 py-4 flex items-start justify-between gap-4 border-b border-slate-100">
        <div>
          <h4 className="text-lg font-bold text-slate-900">{event.name}</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            {event.date ? `${formatDate(event.date)} • ${formatTime(event.date)}` : "No date"}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="px-6 py-4 flex flex-col sm:flex-row gap-3 sm:items-center border-b border-slate-100">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search member by name or Passbook No."
            className="h-10 w-full pl-9 pr-3 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-coop-green/20 focus:border-coop-green outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          {[
            { key: "all", label: "All", count: presentList.length + absentList.length },
            { key: "present", label: "Present", count: presentList.length },
            { key: "absent", label: "Absent", count: absentList.length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                filter === tab.key
                  ? "bg-coop-green text-white border-coop-green"
                  : "bg-white text-slate-600 border-slate-200 hover:border-coop-green/40"
              }`}
            >
              {tab.label}
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  filter === tab.key ? "bg-white/20" : "bg-slate-100"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {pagedList.length > 0 ? (
          pagedList.map((m) => {
            const isPresent = presentList.some((p) => p.memberId === m.memberId);
            return (
              <div key={m.memberId} className="px-6 py-3.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{m.memberName}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {m.barangay || "—"} {m.memberId ? `• Passbook No.: ${m.memberId}` : ""}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${
                    isPresent ? "bg-green-50 text-coop-green" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {isPresent ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  {isPresent ? "Present" : "Absent"}
                </span>
              </div>
            );
          })
        ) : (
          <div className="py-16 text-center text-sm text-slate-400">
            <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            {query ? `No member matching "${search}" in this filter.` : "No members to show for this filter."}
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <PaginationInfo currentPage={page} limit={limit} total={total} />
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
  );
}
