/**
 * ImgBB Image Upload Service (via Server-side Proxy)
 * Proxies image uploads through /api/upload-image so API keys are never exposed in client code
 * and avoids bloating Firestore documents with raw base64 payloads.
 */

export interface ImgBBUploadResult {
  success: boolean;
  url: string;
  displayUrl: string;
  thumbUrl?: string;
  deleteUrl?: string;
  title: string;
  size: string;
  error?: string;
}

/**
 * Converts a File or Blob into a raw base64 string (without the data URL prefix)
 */
export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Upload an image via backend /api/upload-image proxy to ImgBB and return hosted URL metadata.
 * Returns { success: false, error } on failure so callers never write volatile blob: or oversized data: URLs to Firestore.
 */
export async function uploadImageToImgBB(
  file: File,
  customName?: string
): Promise<ImgBBUploadResult> {
  const cleanName = (customName || file.name).replace(/\.[^/.]+$/, '');
  const sizeLabel = `${Math.max(1, Math.round(file.size / 1024))} KB`;

  try {
    const imageBase64 = await fileToBase64(file);
    const response = await fetch('/api/upload-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageBase64,
        name: cleanName
      })
    });

    const json = await response.json().catch(() => null);

    if (response.ok && json?.success && json?.url) {
      return {
        success: true,
        url: json.url,
        displayUrl: json.displayUrl || json.url,
        thumbUrl: json.thumbUrl,
        deleteUrl: json.deleteUrl,
        title: json.title || cleanName,
        size: json.size || sizeLabel
      };
    }

    return {
      success: false,
      url: '',
      displayUrl: '',
      title: cleanName,
      size: sizeLabel,
      error: json?.message || json?.error || `Image upload failed (HTTP ${response.status})`
    };
  } catch (err: any) {
    return {
      success: false,
      url: '',
      displayUrl: '',
      title: cleanName,
      size: sizeLabel,
      error: err?.message || 'Network error uploading image'
    };
  }
}
