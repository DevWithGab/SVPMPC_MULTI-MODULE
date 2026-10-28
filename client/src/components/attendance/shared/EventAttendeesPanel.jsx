import { Input as TextInput } from '../../ui/input';
import { SearchField, PanelHeader } from '../../ui/workspace';
import { Button } from '../../ui/button';
import React, { useEffect, useMemo, useState } from "react";
import { Search, X, Users, CheckCircle2, XCircle } from "lucide-react";
import { formatDate } from "../../../utils/date";
import { Pagination, PaginationInfo } from "../../ui/pagination";
import { usePagination } from "../../../hooks/usePagination";
import { attendanceScannedBy } from '../../../utils/attendanceScannedBy';
import './EventAttendeesPanel.css';

/* Ipinapakita dito kung sino talaga ang dumalo sa event kumpara sa hindi -
nirender bilang body ng sarili nitong page (hindi modal, hindi cramped
scroll box sa loob ng card). "Absent" ay bawat active member na walang
present log para sa event na ito - walang separate na "invited/expected"
roster dito sa app, kaya ang active membership ang buong pool na
pinagkukumpara. May name/ID search sa tabi ng All/Present/Absent filter
para madaling mahanap ang isang specific member, at paginated ang list
imbes na isang mahabang scroll. */

export default function EventAttendeesPanel({
  event,
  presentLogs,
  allMembers,
  onClose,
}) {
  const [filter, setFilter] = useState("all"); // 'all' | 'present' | 'absent'
  const [search, setSearch] = useState("");
  const { page, limit, setPage } = usePagination(1, 100);

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
        scannedBy: attendanceScannedBy(log),
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
    filter === "present"
      ? presentList
      : filter === "absent"
        ? absentList
        : [...presentList, ...absentList];

  const query = search.trim().toLowerCase();
  const visibleList = query
    ? byFilter.filter(
        (m) =>
          String(m.memberName || "")
            .toLowerCase()
            .includes(query) ||
          String(m.memberId || "")
            .toLowerCase()
            .includes(query),
      )
    : byFilter;

  const total = visibleList.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const currentPage = Math.min(page, totalPages);
  const pagedList = visibleList.slice((currentPage - 1) * limit, currentPage * limit);

  /* Nagbabago ang size ng result set tuwing magbabago ang filter o search -
  i-reset sa page 1 para hindi maiwan ang viewer sa isang walang-laman na
  page dahil sa pagination. */
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search]);

  if (!event) return null;

  const pagination = total > 0 && (
    <div className="eap-pagination p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
      <PaginationInfo currentPage={currentPage} limit={limit} total={total} />
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        hasNextPage={currentPage < totalPages}
        hasPrevPage={currentPage > 1}
        className="flex-wrap"
      />
    </div>
  );

  return (
    <div className="event-attendees-panel">
      <PanelHeader className="eap-header">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{event.name}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {event.date
              ? formatDate(event.date)
              : "No date"}
          </p>
          <p className="eap-description">Review attendance for active members and recorded attendees.</p>
        </div>
        {onClose && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </Button>
        )}
      </PanelHeader>

      <div className="eap-toolbar">
        <SearchField className="eap-search">
          <Search size={18} aria-hidden="true" />
          <TextInput
            unstyled
            type="text"
            aria-label="Search members by name or passbook number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or passbook number"
          />
        </SearchField>

        <div className="eap-filters" role="group" aria-label="Attendance status">
          {[
            {
              key: "all",
              label: "All",
              count: presentList.length + absentList.length,
            },
            { key: "present", label: "Present", count: presentList.length },
            { key: "absent", label: "Absent", count: absentList.length },
          ].map((tab) => (
            <Button
              variant={filter === tab.key ? 'default' : 'outline'}
              type="button"
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              aria-pressed={filter === tab.key}
              className={`inline-flex min-h-11 items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
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
            </Button>
          ))}
        </div>
      </div>

      <div className="eap-list-heading" aria-hidden="true"><span>Member</span><span>Passbook number</span><span>Barangay</span><span>Status</span></div>
      <div className="divide-y divide-slate-100" role="list" aria-label="Event members">
        {pagedList.length > 0 ? (
          pagedList.map((m) => {
            const isPresent = presentList.some(
              (p) => p.memberId === m.memberId,
            );
            return (
              <div
                key={m.memberId}
                role="listitem"
                className="eap-member"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 break-words">
                    {m.memberName}
                  </p>
                  {isPresent && <p className="text-xs text-slate-500 break-words">Scanned by: {attendanceScannedBy(m)}</p>}
                </div>
                <div className="eap-passbook" data-label="Passbook no.">{m.memberId || 'Not recorded'}</div>
                <div className="eap-barangay" data-label="Barangay">{m.barangay || 'Not recorded'}</div>
                <span
                  className={`eap-status inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${
                    isPresent
                      ? "bg-green-50 text-coop-green"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {isPresent ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  {isPresent ? "Present" : "Absent"}
                </span>
              </div>
            );
          })
        ) : (
          <div className="py-16 text-center text-sm text-slate-400">
            <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            {query
              ? `No member matching "${search}" in this filter.`
              : "No members to show for this filter."}
          </div>
        )}
      </div>

      {pagination}
    </div>
  );
}
