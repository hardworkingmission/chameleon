'use client';

import { useState } from 'react';
import Dropzone from '@/components/Dropzone';
import FormatSelector from '@/components/FormatSelector';
import QualitySlider from '@/components/QualitySlider';
import ResizeControls, { ResizeValue } from '@/components/ResizeControls';
import FileQueueItem from '@/components/FileQueueItem';
import DownloadBar from '@/components/DownloadBar';
import { QueueFile } from '@/lib/queue';
import { LOSSY_FORMATS, isImageFile } from '@/lib/formats';
import { uploadForConversion, ApiError } from '@/lib/api';

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `f${idCounter}-${Date.now()}`;
}

export default function ConverterPage() {
  const [queue, setQueue] = useState<QueueFile[]>([]);
  const [targetFormat, setTargetFormat] = useState('webp');
  const [quality, setQuality] = useState(85);
  const [resize, setResize] = useState<ResizeValue>({ width: '', height: '', fit: 'inside' });
  const [converting, setConverting] = useState(false);
  const [zipping, setZipping] = useState(false);

  function handleFiles(files: File[]) {
    const newItems: QueueFile[] = files.map((file) => ({
      id: nextId(),
      file,
      previewUrl: isImageFile(file) && !/\.(heic|heif)$/i.test(file.name) ? URL.createObjectURL(file) : undefined,
      status: 'pending',
      progress: 0,
    }));
    setQueue((prev) => [...prev, ...newItems]);
  }

  function removeItem(id: string) {
    setQueue((prev) => prev.filter((f) => f.id !== id));
  }

  function updateItem(id: string, patch: Partial<QueueFile>) {
    setQueue((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function appendResizeParams(formData: FormData) {
    if (resize.width) formData.append('width', resize.width);
    if (resize.height) formData.append('height', resize.height);
    if (resize.width || resize.height) formData.append('fit', resize.fit);
  }

  async function convertAll() {
    setConverting(true);
    const showQuality = LOSSY_FORMATS.has(targetFormat);

    await Promise.all(
      queue
        .filter((item) => item.status !== 'done')
        .map(async (item) => {
          updateItem(item.id, { status: 'uploading', progress: 0, error: undefined });
          const formData = new FormData();
          formData.append('file', item.file);
          formData.append('targetFormat', targetFormat);
          if (showQuality) formData.append('quality', String(quality));
          appendResizeParams(formData);

          try {
            const result = await uploadForConversion('/api/convert', formData, (percent) =>
              updateItem(item.id, { progress: percent })
            );
            updateItem(item.id, {
              status: 'done',
              progress: 100,
              resultBlob: result.blob,
              resultFilename: result.filename,
            });
          } catch (err) {
            updateItem(item.id, {
              status: 'error',
              error: err instanceof ApiError ? err.body.message : 'Conversion failed',
            });
          }
        })
    );

    setConverting(false);
  }

  function downloadItem(id: string) {
    const item = queue.find((f) => f.id === id);
    if (!item?.resultBlob) return;
    const url = URL.createObjectURL(item.resultBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.resultFilename ?? 'converted-file';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadAllAsZip() {
    setZipping(true);
    try {
      const formData = new FormData();
      queue.forEach((item) => formData.append('files', item.file));
      formData.append('targetFormat', targetFormat);
      if (LOSSY_FORMATS.has(targetFormat)) formData.append('quality', String(quality));
      appendResizeParams(formData);

      const result = await uploadForConversion('/api/convert/batch', formData);
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chameleon-batch.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // best-effort; individual downloads remain available
    } finally {
      setZipping(false);
    }
  }

  const doneCount = queue.filter((f) => f.status === 'done').length;
  const showQuality = LOSSY_FORMATS.has(targetFormat);

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Convert your files</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Images, HEIC/HEIF, and PDFs — converted entirely on this server. Nothing is sent to a third party.
      </p>

      <Dropzone onFiles={handleFiles} />

      <div className="card" style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 200 }}>
            <FormatSelector value={targetFormat} onChange={setTargetFormat} />
          </div>
          {showQuality && (
            <div style={{ flex: 1, minWidth: 200 }}>
              <QualitySlider value={quality} onChange={setQuality} />
            </div>
          )}
          <button className="btn" onClick={convertAll} disabled={converting || queue.length === 0}>
            {converting ? 'Converting…' : `Convert ${queue.length || ''} file${queue.length === 1 ? '' : 's'}`}
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            Resize (optional) — leave blank to keep the original dimensions
          </p>
          <ResizeControls value={resize} onChange={setResize} />
        </div>
      </div>

      {queue.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          {queue.map((item) => (
            <FileQueueItem key={item.id} item={item} onRemove={removeItem} onDownload={downloadItem} />
          ))}
        </div>
      )}

      <DownloadBar doneCount={doneCount} totalCount={queue.length} onDownloadZip={downloadAllAsZip} zipping={zipping} />
    </div>
  );
}
