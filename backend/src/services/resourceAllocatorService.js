const NGO = require('../models/NGO');
const logger = require('../utils/logger');

/**
 * Automates the tracking, matching and assignments of incoming payloads to regional NGO accounts.
 * @param {Object} requestDocument Mongoose document representation of structural asset needs.
 */
const allocateRequestToNgo = async (requestDocument) => {
  try {
    // Fetch available active NGO resources
    const activeNgos = await NGO.find({ isActive: true });
    if (!activeNgos || activeNgos.length === 0) {
      logger.warn('No registered active NGOs available to parse task queues.');
      return null;
    }

    // Evaluate match profiles against request requirements
    let matchingNgos = activeNgos.filter(ngo => 
      ngo.resourceSpecialties.some(specialty => requestDocument.needsList.includes(specialty))
    );

    let assignedNgoTarget = null;

    if (matchingNgos.length > 0) {
      // Round-Robin select based on oldest assignment history
      matchingNgos.sort((a, b) => {
        if (!a.lastAssignedAt) return -1;
        if (!b.lastAssignedAt) return 1;
        return a.lastAssignedAt - b.lastAssignedAt;
      });
      assignedNgoTarget = matchingNgos[0];
    } else {
      // Fallback search path to catch general-purpose NGOs
      const generalPurposeNgo = activeNgos.find(ngo => ngo.resourceSpecialties.includes('general'));
      if (generalPurposeNgo) {
        assignedNgoTarget = generalPurposeNgo;
      }
    }

    // Update assignment mappings if a target NGO was identified
    if (assignedNgoTarget) {
      requestDocument.assignedNgo = assignedNgoTarget.ngoName;
      requestDocument.status = 'routed';
      await requestDocument.save();

      assignedNgoTarget.lastAssignedAt = new Date();
      await assignedNgoTarget.save();

      logger.info(`Request ${requestDocument.requestId} assigned to NGO ${assignedNgoTarget.ngoName}`);
      return assignedNgoTarget;
    }

    logger.info(`Request ${requestDocument.requestId} remained unassigned due to no specialty matches.`);
    return null;
  } catch (error) {
    logger.error('Resource allocation pipeline execution failure:', error);
    throw error;
  }
};

module.exports = { allocateRequestToNgo };
