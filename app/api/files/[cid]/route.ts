import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { requireSession } from '@/lib/session';
import { getR1FS } from '@/lib/sdk';
import { getFileRecord } from '@/lib/store';
import type { R1FSDownloadResult } from '@ratio1/edge-sdk-ts';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cid: string }> }
) {
  const env = getServerEnv();
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { cid } = await params;
  if (!cid) {
    return NextResponse.json({ error: 'CID is required' }, { status: 400 });
  }

  const r1fs = getR1FS();
  const fileMeta = await getFileRecord(cid);

  try {
    // Prefer base64 to avoid relying on node-local file paths from R1FS.
    const base64Res = await r1fs.getFileBase64Full({ cid });
    const base64Result = base64Res.result as R1FSDownloadResult;
    if (base64Result?.file_base64_str) {
      const buffer = Buffer.from(base64Result.file_base64_str, 'base64');
      const headers = new Headers();
      headers.set('content-type', fileMeta?.mime || 'application/octet-stream');
      headers.set('content-length', buffer.byteLength.toString());
      headers.set('cache-control', 'private, max-age=0');
      return new NextResponse(buffer, { headers });
    }

    const res = await r1fs.getFileFull({ cid });
    const result = res.result as Response | R1FSDownloadResult;

    if (result instanceof Response) {
      const headers = new Headers(result.headers);
      if (fileMeta?.mime && !headers.has('content-type')) {
        headers.set('content-type', fileMeta.mime);
      }
      headers.set('cache-control', 'private, max-age=0');
      return new NextResponse(result.body, {
        status: result.status,
        statusText: result.statusText,
        headers
      });
    }

    if (result?.file_base64_str) {
      const buffer = Buffer.from(result.file_base64_str, 'base64');
      const headers = new Headers();
      headers.set('content-type', fileMeta?.mime || 'application/octet-stream');
      headers.set('content-length', buffer.byteLength.toString());
      headers.set('cache-control', 'private, max-age=0');
      return new NextResponse(buffer, { headers });
    }

    const filePath = result.file_path || result.meta?.file;
    if (filePath) {
      const upstream = await fetch(`${env.r1fsUrl.replace(/\/$/, '')}${filePath}`);
      if (!upstream.ok || !upstream.body) {
        return NextResponse.json({ error: 'File not found' }, { status: upstream.status });
      }
      const headers = new Headers(upstream.headers);
      if (fileMeta?.mime) {
        headers.set('content-type', fileMeta.mime);
      }
      headers.set('cache-control', 'private, max-age=0');
      return new NextResponse(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers
      });
    }

    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch file';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
export const runtime = 'nodejs';
