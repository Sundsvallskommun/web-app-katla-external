import { Request } from 'express';
import multer from 'multer';

type FileFilterCallback = (error: Error | null, pass: boolean) => void;

/** Kept to what the bilagor in the AoT forms are: documents, spreadsheets and scans. */
const ALLOWED_MIME_TYPES = [
  'application/msword',
  'application/pdf',
  'application/rtf',
  'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'text/plain',
];

export const MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024;

const fileFilter = (_request: Request, file: Express.Multer.File, callback: FileFilterCallback): void => {
  // Busboy hands the filename back as latin1; without this an å in the name reaches upstream mojibake.
  file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
  callback(null, ALLOWED_MIME_TYPES.includes(file.mimetype));
};

export const fileUploadOptions = {
  limits: { fieldNameSize: 255, fileSize: MAX_ATTACHMENT_SIZE_BYTES },
  storage: multer.memoryStorage(),
  fileFilter,
};
