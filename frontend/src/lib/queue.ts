export type QueueStatus = 'pending' | 'uploading' | 'done' | 'error';

export interface QueueFile {
  id: string;
  file: File;
  previewUrl?: string;
  status: QueueStatus;
  progress: number;
  resultBlob?: Blob;
  resultFilename?: string;
  error?: string;
}
