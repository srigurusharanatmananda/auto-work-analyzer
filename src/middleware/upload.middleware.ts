/**
 * Multer signals a rejected upload — over the configured size limit, or a
 * mimetype/extension its own `fileFilter` doesn't allow — by calling back
 * with an Error. Left alone, that reaches Express's global error handler
 * and answers 500 "Internal server error", blaming the server for what is
 * actually a bad request. This wraps any single-file multer instance so a
 * rejection turns into a 400 naming the cause instead.
 *
 * Extracted after this exact ~15-line shape existed twice, independently,
 * in `tasks.routes.ts` (its own `uploadNotes`) and `translate.routes.ts`
 * (its own `uploadOcrImage`) — a future fix to the error shape (say,
 * distinguishing multer's own `LIMIT_UNEXPECTED_FILE` too) would otherwise
 * need to be found and applied in both places, easy to do once and forget
 * the other.
 */
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';

/**
 * A disk-storage engine that writes to `uploadsDir` (created on demand)
 * under a server-generated uuid filename, keeping only the original
 * extension — the browser-supplied name is never trusted on the
 * filesystem, only stored in the database for display.
 *
 * Extracted after this exact shape existed twice, independently, in
 * `resources.routes.ts` and `chantBooks.routes.ts` — the same "found
 * twice, extract" reasoning `uploadSingleOrReject` below already
 * documents for itself.
 */
export function createUuidDiskStorage(uploadsDir: string): multer.StorageEngine {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      mkdir(uploadsDir, { recursive: true })
        .then(() => cb(null, uploadsDir))
        .catch((error) => cb(error, uploadsDir));
    },
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
    },
  });
}

export function uploadSingleOrReject(
  upload: multer.Multer,
  fieldName: string,
  maxSizeLabel: string
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single(fieldName)(req, res, (error: unknown) => {
      if (!error) {
        next();
        return;
      }
      const tooLarge = (error as { code?: string })?.code === 'LIMIT_FILE_SIZE';
      res.status(400).json({
        success: false,
        error: tooLarge
          ? `That file is larger than the ${maxSizeLabel} limit.`
          : error instanceof Error
            ? error.message
            : 'Upload rejected',
      });
    });
  };
}
