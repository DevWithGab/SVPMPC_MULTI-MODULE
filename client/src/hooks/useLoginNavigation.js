import { useLocation, useNavigate } from 'react-router-dom';
import { MODULE_ROLES } from '../utils/constants';

// Login screens need history entries too, so device Back/Forward can follow them.
export default function useLoginNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const module = params.get('module');
  const selectedSystem = Object.hasOwn(MODULE_ROLES, module) ? module : null;
  const role = params.get('role');
  const selectedRole = MODULE_ROLES[selectedSystem]?.includes(role) ? role : null;
  const steps = { admin: 'ADMIN_LOGIN', secretary: 'SECRETARY_LOGIN', treasurer: 'TREASURER_LOGIN', scanner_operator: 'OPERATOR_LOGIN' };
  const step = selectedSystem === 'mortuary' ? 'MORTUARY_LOGIN' : selectedRole ? steps[selectedRole] : selectedSystem ? 'ROLE_SELECTION' : 'MODULE_SELECTION';

  const go = (system, nextRole) => {
    const search = new URLSearchParams();
    if (system) search.set('module', system);
    if (nextRole) search.set('role', nextRole);
    navigate({ pathname: '/', search: search.toString() }, {
      state: { ...location.state, loginParent: location.search },
    });
  };

  const back = () => {
    const parentSearch = selectedSystem !== 'mortuary' && selectedRole ? `?module=${selectedSystem}` : '';
    if (location.state?.loginParent === parentSearch) navigate(-1);
    // A directly opened login link has no previous selection entry to return to.
    else navigate({ pathname: '/', search: parentSearch }, { replace: true, state: location.state });
  };

  return { selectedSystem, selectedRole, step, selectSystem: system => go(system), selectRole: role => go(selectedSystem, role), back };
}
