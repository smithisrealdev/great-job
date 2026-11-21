import { RESUME_MAX_BYTES } from '@/lib/config';

/** Same checks the server makes, run before upload so an oversize file never hits the platform's body limit. */
export const resumeFileError = (file: File): 'not_pdf' | 'too_large' | null =>
  file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf') ? 'not_pdf' : file.size > RESUME_MAX_BYTES ? 'too_large' : null;
