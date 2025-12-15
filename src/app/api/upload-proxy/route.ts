import { NextResponse } from 'next/server'

// POST proxy: accepts multipart/form-data with a "file" field and forwards it
// to the Mint API. Returns Mint's response body on success. On failure we
// return the upstream body text and status so the client (and logs) have more
// information for debugging.
export async function POST(req: Request) {
  try {
    console.log('[UPLOAD-PROXY] Received upload request');
    const contentType = req.headers.get('content-type') || ''
    console.log('[UPLOAD-PROXY] Content-Type:', contentType);

    // Try to extract file from form data
    let file: Blob | null = null
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const maybeFile = formData.get('file')
      // Check if it's a Blob (File extends Blob)
      if (maybeFile && typeof maybeFile === 'object' && 'size' in maybeFile && 'type' in maybeFile) {
        file = maybeFile as Blob
        const fileName = (maybeFile as any).name || 'file'
        console.log('[UPLOAD-PROXY] File received:', fileName, file.size, 'bytes');
      } else {
        console.error('[UPLOAD-PROXY] File field is not a Blob:', typeof maybeFile);
      }
    } else {
      console.error('[UPLOAD-PROXY] Not multipart/form-data');
    }

    if (!file) {
      console.error('[UPLOAD-PROXY] No file in request');
      return NextResponse.json({ error: 'No file provided (expect multipart/form-data with "file")' }, { status: 400 })
    }

    // Forward to Mint API
    console.log('[UPLOAD-PROXY] Forwarding to Mint API...');
    const mintForm = new FormData()
    mintForm.append('file', file)
    mintForm.append('user_id', '9198e3fb-4c22-11f0-906d-080027fda028')
    mintForm.append('is_public', 'true')

    const mintRes = await fetch('https://api.mintit.pro/upload/', {
      method: 'POST',
      body: mintForm,
    })

    console.log('[UPLOAD-PROXY] Mint API response status:', mintRes.status);
    const bodyText = await mintRes.text()
    console.log('[UPLOAD-PROXY] Mint API response body:', bodyText.substring(0, 200));

    if (!mintRes.ok) {
      console.error('Mint upload failed', { status: mintRes.status, statusText: mintRes.statusText, body: bodyText })
      // Return the upstream body for debugging, preserving status
      return new NextResponse(bodyText, {
        status: mintRes.status,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    // Try to parse JSON, and always return a { url } field if possible
    try {
      const json = JSON.parse(bodyText)
      // If variants, pick high or first
      if (json.variants && Array.isArray(json.variants) && json.variants.length > 0) {
        const high = json.variants.find((v: any) => v.quality === 'high')
        console.log('[UPLOAD-PROXY] Returning variant URL');
        return NextResponse.json({ url: (high && high.url) || json.variants[0].url }, { status: 200 })
      }
      // Else, if url/imageUrl/link/data.url present, return as { url }
      const url = json.url || json.imageUrl || json.link || (json.data && json.data.url)
      if (typeof url === 'string' && url.length > 0) {
        console.log('[UPLOAD-PROXY] Returning URL:', url);
        return NextResponse.json({ url }, { status: 200 })
      }
      // Fallback: return original JSON
      console.log('[UPLOAD-PROXY] Returning original JSON');
      return NextResponse.json(json, { status: 200 })
    } catch (err) {
      console.warn('[UPLOAD-PROXY] JSON parse failed, returning raw text');
      return new NextResponse(bodyText, { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }
  } catch (err) {
    console.error('[UPLOAD-PROXY] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function GET() {
  return new NextResponse(null, { status: 405 })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
