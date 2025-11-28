/// <reference types="node" />
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import Busboy from 'busboy';
import { PassThrough, Readable, type Writable } from 'node:stream';
import type { R1FSUploadResponse } from '@ratio1/edge-sdk-ts';
import { getServerEnv } from '@/lib/env';
import { requireSession } from '@/lib/session';
import {
  addUploadEvent,
  getQuota,
  incrementQuotaUsage,
  listFiles,
  removeFileRecord,
  saveFileRecord
} from '@/lib/store';
import { getUser } from '@/lib/auth';
import { getR1FS } from '@/lib/sdk';

type UploadSuccess = {
  uploadResult: { cid: string };
  filename: string;
  mime: string;
  size: number;
};

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === 'string') return new Error(err);
  try {
    return new Error(JSON.stringify(err));
  } catch {
    return new Error('Unknown error');
  }
}

async function streamUploadToR1FS(request: NextRequest, opts: {
  contentType: string;
  maxBytes: number;
  allowedMimeTypes: string[];
  r1fs: ReturnType<typeof getR1FS>;
}) {
  const { contentType, maxBytes, allowedMimeTypes, r1fs } = opts;

  return new Promise<UploadSuccess>((resolve, reject) => {
    let fileName = '';
    let mimeType = '';
    let totalBytes = 0;
    let settled = false;
    let uploadPromise: Promise<R1FSUploadResponse> | null = null;

    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      reject(toError(err));
    };

    const succeed = (payload: UploadSuccess) => {
      if (settled) return;
      settled = true;
      resolve(payload);
    };

    const busboy = Busboy({ headers: { 'content-type': contentType } });

    busboy.on('file', (field, file, info) => {
      if (field !== 'file') {
        file.resume();
        return;
      }

      fileName = info.filename || 'upload';
      mimeType = info.mimeType || 'application/octet-stream';

      if (!allowedMimeTypes.includes(mimeType)) {
        file.resume();
        fail(new Error('Invalid file type'));
        return;
      }

      const pass = new PassThrough();

      file.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes > maxBytes) {
          file.unpipe(pass);
          pass.destroy(new Error('File too large'));
          busboy.emit('error', new Error('File too large'));
        }
      });

      file.pipe(pass);

      uploadPromise = r1fs.addFileFull({
        file: pass,
        filename: fileName,
        contentType: mimeType
      });

      uploadPromise.catch((err) => {
        pass.destroy(toError(err));
        fail(err);
      });
      file.on('error', fail);
    });

    busboy.on('error', fail);

    busboy.on('close', async () => {
      if (settled) return;
      if (!uploadPromise) {
        fail(new Error('No file received'));
        return;
      }
      try {
        const res = await uploadPromise;
        const uploadResult = res.result;
        if (!uploadResult?.cid) {
          fail(new Error('Upload failed: missing CID'));
          return;
        }
        succeed({
          uploadResult,
          filename: fileName,
          mime: mimeType,
          size: totalBytes
        });
      } catch (err) {
        fail(err);
      }
    });

    try {
      const body = request.body;
      if (!body) {
        busboy.end();
      } else if (typeof (body as { pipe?: unknown }).pipe === 'function') {
        (body as unknown as Readable).pipe(busboy as unknown as Writable);
      } else {
        const nodeStream = Readable.fromWeb(body as unknown as globalThis.ReadableStream);
        nodeStream.on('error', fail);
        nodeStream.pipe(busboy as unknown as Writable);
      }
    } catch (err) {
      fail(err);
    }
  });
}

export async function GET() {
  try {
    const session = await requireSession();
    const files = await listFiles();
    return NextResponse.json({ files, viewer: session.username });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  const env = getServerEnv();
  const r1fs = getR1FS();
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUser(session.username);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
  }

  const quota = await getQuota(session.username);
  if (quota.used >= quota.max) {
    return NextResponse.json({ error: 'Quota exceeded' }, { status: 403 });
  }

  const maxBytes = env.maxUploadBytes;

  const { uploadResult, filename, mime, size } = await streamUploadToR1FS(request, {
    contentType,
    maxBytes,
    allowedMimeTypes: env.allowedMimeTypes,
    r1fs
  });

  const now = new Date().toISOString();
  const record = {
    cid: uploadResult.cid,
    owner: session.username,
    filename: filename || uploadResult.cid,
    mime: mime,
    size,
    createdAt: now,
    nodeId: env.eeId
  };

  await saveFileRecord(record);
  const updatedQuota = await incrementQuotaUsage(session.username, 1);

  if (updatedQuota.used > updatedQuota.max) {
    // Roll back and stop.
    await incrementQuotaUsage(session.username, -1);
    // Best-effort cleanup via SDK; quota check happens after the upload completes.
    try {
      await r1fs.deleteFile({ cid: record.cid, cleanup_local_files: true, run_gc: false });
    } catch {
      // swallow
    }
    await removeFileRecord(record.cid);
    return NextResponse.json({ error: 'Quota exceeded' }, { status: 403 });
  }

  await addUploadEvent({
    type: 'upload',
    user: session.username,
    filename: record.filename,
    cid: record.cid,
    nodeId: env.eeId,
    createdAt: now
  });

  return NextResponse.json({ record, quota: updatedQuota });
}
