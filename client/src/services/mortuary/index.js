// Mortuary module API services
import mortuaryMemberAPI from './member.js';
import mortuaryTreasurerAPI from './treasurer.js';
import mortuaryAdminAPI from './admin.js';

// Export organized APIs
export const mortuaryAPI = {
  member: mortuaryMemberAPI,
  treasurer: mortuaryTreasurerAPI,
  admin: mortuaryAdminAPI
};

export default mortuaryAPI;