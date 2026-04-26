// Mortuary module API services
import mortuaryTreasurerAPI from './treasurer.js';
import mortuaryAdminAPI from './admin.js';

// Export organized APIs
export const mortuaryAPI = {
  treasurer: mortuaryTreasurerAPI,
  admin: mortuaryAdminAPI
};

export default mortuaryAPI;