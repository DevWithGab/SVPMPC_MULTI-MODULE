import { useEffect, useState } from 'react';

export const peso = (value) => value == null ? '—' : new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value));
export const shortDate = (value) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
export const fieldClass = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-coop-green focus:ring-2 focus:ring-coop-green/15 disabled:bg-slate-50';

export function useClaimQueue(fetchClaims) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({ claims: [], total: 0, key: '', error: '' });
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const key = `${page}:${query}:${version}`;
  useEffect(() => {
    let active = true;
    fetchClaims({ page, limit: 10, search: query }).then((res) => {
      if (!active) return;
      const total = res.pagination?.total ?? res.data?.length ?? 0;
      if (page > Math.max(1, Math.ceil(total / 10))) { setPage(Math.max(1, Math.ceil(total / 10))); return; }
      setState({ claims: res.data || [], total, key, error: '' });
    }).catch(() => {
      if (active) setState((old) => ({ ...old, key, error: 'Unable to load claims. Please try again.' }));
    });
    return () => { active = false; };
  }, [fetchClaims, page, query, key]);
  return { ...state, loading: state.key !== key || search.trim() !== query, search, setSearch, page, setPage, refresh: () => setVersion((n) => n + 1) };
}

