const { body, validationResult } = require('express-validator');

const validateReportSubmission = [
  body('campId').isString().notEmpty().withMessage('Valid campId parameter required.').trim(),
  body('issueDescription').isString().isLength({ min: 10, max: 2000 }).withMessage('Issue description must scale between 10 and 2000 characters.'),
  body('needsList').isArray({ min: 1 }).withMessage('Needs list array parameter must contain at least 1 targeted element.'),
  body('needsList.*').isString().trim().notEmpty().withMessage('Needs elements must be populated valid string tokens.'),
  (req, res, next) => {
    const errorChecks = validationResult(req);
    if (!errorChecks.isEmpty()) {
      return res.status(400).json({ success: false, errors: errorChecks.array() });
    }
    next();
  }
];

module.exports = { validateReportSubmission };
