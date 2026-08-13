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
import type { Request, Response, NextFunction } from 'express';
import type multer from 'multer';

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
