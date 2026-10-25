/* Who-did-this names shown in the UI use the staff member's full name, with
the username only as a fallback for accounts that have no name set.

- actorName(): what new records store as createdBy / recordedBy / releasedBy …
- displayActorNames(): rewrites older records that stored a username, on the
  way out of the API, so every screen, report and export shows full names
  without rewriting stored history. */

const actorName = (user, fallback = 'Unknown') => user?.fullName?.trim() || user?.username || fallback;

// Response fields that name the staff member who performed an action.
const ACTOR_FIELDS = new Set([
  'createdBy', 'updatedBy', 'recordedBy', 'processedBy', 'approvedBy', 'rejectedBy',
  'verifiedBy', 'releasedBy', 'changedBy', 'scannedBy', 'exportedBy', 'uploadedBy',
  'performedBy', 'userName', 'actor',
]);

const CACHE_MS = 60 * 1000;
let cache = { names: new Map(), loadedAt: 0, loading: null };

const loadNames = async (User) => {
  const users = await User.find({ role: { $ne: 'member' }, fullName: { $type: 'string', $ne: '' } })
    .select('username fullName').lean();
  return new Map(users.filter(user => user.username && user.fullName.trim()).map(user => [user.username, user.fullName.trim()]));
};

const getStaffNames = async (User) => {
  if (Date.now() - cache.loadedAt < CACHE_MS) return cache.names;
  if (!cache.loading) {
    cache.loading = loadNames(User)
      .then(names => { cache = { names, loadedAt: Date.now(), loading: null }; return names; })
      .catch(error => { cache.loading = null; throw error; });
  }
  return cache.loading;
};

// Call after a staff account's name or username changes.
const invalidateStaffNames = () => { cache = { names: new Map(), loadedAt: 0, loading: null }; };

const replaceActorNames = (value, names) => {
  if (Array.isArray(value)) { value.forEach(item => replaceActorNames(item, names)); return value; }
  if (!value || typeof value !== 'object') return value;
  for (const [key, field] of Object.entries(value)) {
    if (typeof field === 'string') {
      if (ACTOR_FIELDS.has(key) && names.has(field.trim())) value[key] = names.get(field.trim());
    } else if (field && typeof field === 'object') {
      replaceActorNames(field, names);
    }
  }
  return value;
};

// Express middleware: swap stored usernames in actor fields for full names.
const displayActorNames = (User) => async (req, res, next) => {
  let names;
  try {
    names = await getStaffNames(User);
  } catch (error) {
    console.error('Unable to load staff names for display:', error.message);
    return next();
  }
  if (names.size) {
    const json = res.json.bind(res);
    res.json = (body) => {
      if (!body || typeof body !== 'object') return json(body);
      // Plain copy first: responses can carry Mongoose documents.
      return json(replaceActorNames(JSON.parse(JSON.stringify(body)), names));
    };
  }
  return next();
};

module.exports = { actorName, displayActorNames, invalidateStaffNames, replaceActorNames, ACTOR_FIELDS };
