import { useLocation, useNavigate } from 'react-router-dom';
import { readUrlValue, updateUrlValue } from '../utils/navigation';

// The URL is the source of truth, including browser Back/Forward navigation.
export default function useUrlState(key, fallback, allowed) {
  const location = useLocation();
  const navigate = useNavigate();
  const value = readUrlValue(location.search, key, fallback, allowed);
  const setValue = (next, extra = {}) => {
    const resolved = typeof next === 'function' ? next(value) : next;
    const search = updateUrlValue(location.search, key, resolved, fallback, extra);
    if (search !== location.search.replace(/^\?/, '')) navigate({ pathname: location.pathname, search });
  };
  return [value, setValue];
}
