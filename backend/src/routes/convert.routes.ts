import { Router } from 'express';
import { uploadSingle, uploadBatch } from '../middleware/upload.middleware';
import { validateSingleFile, validateBatchFiles } from '../middleware/validateFile.middleware';
import { optionalAuth } from '../middleware/auth.middleware';
import { convertSingle, convertBatch, convertImagesToSinglePdf } from '../controllers/convert.controller';

const router = Router();

router.post('/', optionalAuth, uploadSingle, validateSingleFile, convertSingle);
router.post('/batch', optionalAuth, uploadBatch, validateBatchFiles, convertBatch);
router.post('/batch/merge-pdf', optionalAuth, uploadBatch, validateBatchFiles, convertImagesToSinglePdf);

export default router;
