export const DEFAULT_UPLOAD_LIMITS = {
  maxSizeBytes: 8 * 1024 * 1024,
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ],
};

export type UploadLimits = typeof DEFAULT_UPLOAD_LIMITS;
