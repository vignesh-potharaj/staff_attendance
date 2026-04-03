/**
 * Helper function to resolve photo/image URLs correctly
 * 
 * Rules:
 * - If URL is absolute (http:// or https://), use as-is
 * - If URL is relative (/static/...), prepend API base URL
 * - Returns null if URL is empty
 */
export function resolvePhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  // Already an absolute URL (Google Drive, external resources, etc.)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Relative path - prepend API base URL
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  return `${API_BASE}${url}`;
}
