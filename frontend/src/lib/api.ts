export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface ApiErrorBody {
  error: string;
  message: string;
}

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody;
  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.status = status;
    this.body = body;
  }
}

async function parseJsonOrThrow(res: Response) {
  if (!res.ok) {
    let body: ApiErrorBody;
    try {
      body = await res.json();
    } catch {
      body = { error: 'UnknownError', message: res.statusText };
    }
    throw new ApiError(res.status, body);
  }
  return res.json();
}

export async function apiGet(path: string) {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include' });
  return parseJsonOrThrow(res);
}

export async function apiPost(path: string, data: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return parseJsonOrThrow(res);
}

export interface UploadProgressCallback {
  (percent: number): void;
}

/**
 * Uploads a multipart form to the API using XMLHttpRequest so we can report
 * upload progress (fetch has no upload progress event). Resolves with the
 * raw Blob response and its content-type/filename so callers can decide how
 * to present or download the result.
 */
export function uploadForConversion(
  path: string,
  formData: FormData,
  onProgress?: UploadProgressCallback
): Promise<{ blob: Blob; filename: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}${path}`);
    xhr.withCredentials = true;
    xhr.responseType = 'blob';

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const disposition = xhr.getResponseHeader('Content-Disposition') ?? '';
        const match = disposition.match(/filename="?([^"]+)"?/);
        resolve({
          blob: xhr.response,
          filename: match?.[1] ?? 'converted-file',
          contentType: xhr.getResponseHeader('Content-Type') ?? 'application/octet-stream',
        });
      } else {
        try {
          const text = await xhr.response.text();
          const body = JSON.parse(text) as ApiErrorBody;
          reject(new ApiError(xhr.status, body));
        } catch {
          reject(new ApiError(xhr.status, { error: 'UnknownError', message: 'Conversion failed' }));
        }
      }
    };

    xhr.onerror = () => reject(new ApiError(0, { error: 'NetworkError', message: 'Network error during upload' }));
    xhr.send(formData);
  });
}
