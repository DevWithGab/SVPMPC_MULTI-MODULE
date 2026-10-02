const ClaimRequirement = require('../models/ClaimRequirement');

// The 4 requirement types this app shipped with before this settings screen
// existed — seeded once so existing claims (which already have these exact
// keys baked into their stored requirements) keep matching a live
// definition, and so the Admin sees familiar entries on first visit instead
// of an empty list.
const DEFAULT_REQUIREMENTS = [
  { key: 'claimApplicationForm', label: 'Claim Application Form', order: 0 },
  { key: 'deathCertificate', label: 'Death Certificate', order: 1 },
  { key: 'memberCooperativeId', label: "Member's Cooperative ID", order: 2 },
  { key: 'beneficiaryValidId', label: "Beneficiary's Valid ID", order: 3 },
];

// Mirrors the existing claimApplicationForm/deathCertificate naming style:
// lowercase first word, capitalize the rest, strip anything non-alphanumeric.
const slugifyToKey = (label) => {
  const words = String(label || '')
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
};

// Seeds the 4 original defaults the first time this is ever called on a
// database that predates this settings screen, then returns the full
// current list. Shared by the HTTP handler below and claimController's
// createClaim (which needs the same list to snapshot onto a new claim).
const getOrSeedRequirements = async () => {
  const count = await ClaimRequirement.countDocuments();
  if (count === 0) {
    await ClaimRequirement.insertMany(DEFAULT_REQUIREMENTS);
  }
  return ClaimRequirement.find().sort({ order: 1 });
};

const getAllRequirements = async (req, res) => {
  try {
    const requirements = await getOrSeedRequirements();
    res.status(200).json({ success: true, data: requirements });
  } catch (error) {
    console.error('Error fetching claim requirements:', error);
    res.status(500).json({ success: false, message: 'Error fetching claim requirements', error: error.message });
  }
};

const createRequirement = async (req, res) => {
  try {
    const label = String(req.body.label || '').trim();
    if (!label) {
      return res.status(400).json({ success: false, message: 'A label is required' });
    }

    const baseKey = slugifyToKey(label);
    if (!baseKey) {
      return res.status(400).json({ success: false, message: 'Label must contain at least one letter or number' });
    }

    let key = baseKey;
    let suffix = 2;
    while (await ClaimRequirement.exists({ key })) {
      key = `${baseKey}${suffix}`;
      suffix += 1;
    }

    const lastInOrder = await ClaimRequirement.findOne().sort({ order: -1 });
    const order = (lastInOrder?.order ?? -1) + 1;

    const requirement = await ClaimRequirement.create({
      key,
      label,
      order,
      createdBy: req.user?.username || req.user?.name || 'admin',
    });

    res.status(201).json({ success: true, message: 'Requirement added', data: requirement });
  } catch (error) {
    console.error('Error creating claim requirement:', error);
    res.status(500).json({ success: false, message: 'Error creating claim requirement', error: error.message });
  }
};

// Label only — `key` is permanent once created (see model comment).
const updateRequirement = async (req, res) => {
  try {
    const label = String(req.body.label || '').trim();
    if (!label) {
      return res.status(400).json({ success: false, message: 'A label is required' });
    }

    const requirement = await ClaimRequirement.findByIdAndUpdate(
      req.params.id,
      { label },
      { new: true, runValidators: true }
    );
    if (!requirement) {
      return res.status(404).json({ success: false, message: 'Requirement not found' });
    }

    res.status(200).json({ success: true, message: 'Requirement updated', data: requirement });
  } catch (error) {
    console.error('Error updating claim requirement:', error);
    res.status(500).json({ success: false, message: 'Error updating claim requirement', error: error.message });
  }
};

// Hard delete — safe because every claim already snapshotted its own
// requirement keys at filing time (see Claim.js); this only affects claims
// filed after this point.
const deleteRequirement = async (req, res) => {
  try {
    const requirement = await ClaimRequirement.findByIdAndDelete(req.params.id);
    if (!requirement) {
      return res.status(404).json({ success: false, message: 'Requirement not found' });
    }

    res.status(200).json({ success: true, message: 'Requirement removed' });
  } catch (error) {
    console.error('Error deleting claim requirement:', error);
    res.status(500).json({ success: false, message: 'Error deleting claim requirement', error: error.message });
  }
};

module.exports = {
  getAllRequirements,
  getOrSeedRequirements,
  createRequirement,
  updateRequirement,
  deleteRequirement,
};
