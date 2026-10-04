import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const REVIEW_PHOTOS_DIR = path.resolve(__dirname, '../../uploads/reviews');
export const PLAN_RECEIPTS_DIR = path.resolve(__dirname, '../../uploads/plan-receipts');

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

fs.mkdirSync(REVIEW_PHOTOS_DIR, { recursive: true });
fs.mkdirSync(PLAN_RECEIPTS_DIR, { recursive: true });

function filenameFromMime(mimetype) {
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}${EXT_BY_MIME[mimetype] ?? ''}`;
}

const storage = multer.diskStorage({
  destination: REVIEW_PHOTOS_DIR,
  filename(_req, file, cb) {
    cb(null, filenameFromMime(file.mimetype));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_PHOTO_SIZE },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      const error = new Error('La foto debe ser JPG, PNG o WebP.');
      error.status = 400;
      return cb(error);
    }
    return cb(null, true);
  },
});

export const reviewPhotoUpload = upload.single('photo');

export function handleReviewPhotoUpload(req, res, next) {
  reviewPhotoUpload(req, res, (error) => {
    if (!error) {
      return next();
    }
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'La foto no puede superar los 5 MB.' });
    }
    return res.status(error.status ?? 400).json({ error: error.message });
  });
}

// El comprobante de transferencia es una imagen (jpg/png/webp) O un PDF, hasta 5 MB.
const ALLOWED_RECEIPT_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

const planReceiptUpload = multer({
  storage: multer.diskStorage({
    destination: PLAN_RECEIPTS_DIR,
    filename(_req, file, cb) {
      cb(null, filenameFromMime(file.mimetype));
    },
  }),
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_RECEIPT_MIMES.has(file.mimetype)) {
      const error = new Error('El comprobante debe ser una imagen (JPG, PNG, WebP) o un PDF.');
      error.status = 400;
      return cb(error);
    }
    return cb(null, true);
  },
}).single('receipt');

export function handlePlanReceiptUpload(req, res, next) {
  planReceiptUpload(req, res, (error) => {
    if (!error) {
      return next();
    }
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El comprobante no puede superar los 5 MB.' });
    }
    return res.status(error.status ?? 400).json({ error: error.message });
  });
}
