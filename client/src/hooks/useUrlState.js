import { useLocation, useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { UrlStateContext } from './urlStateContext';
import { readUrlValue, updateUrlValue } from '../utils/navigation';

// The URL is the source of truth, including browser Back/Forward navigation.
export default function useUrlState(key, fallback, allowed) {
  const keys = useContext(UrlStateContext);
  const urlKey = keys[key] || key;
  const location = useLocation();
  const navigate = useNavigate();
  const value = readUrlValue(location.search, urlKey, fallback, allowed);
  const setValue = (next, extra = {}) => {
    const resolved = typeof next === 'function' ? next(value) : next;
    const params = key === 'tab' && urlKey !== key ? { claim: null, member: null, claimsView: null, month: null, ...extra } : extra;
    const search = updateUrlValue(location.search, urlKey, resolved, fallback, params);
    if (search !== location.search.replace(/^\?/, '')) navigate({ pathname: location.pathname, search });
  };
  return [value, setValue];
}
