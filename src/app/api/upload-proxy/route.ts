import { NextResponse } from 'next/server'

export const runtime = 'edge'

// POST proxy: accepts multipart/form-data with a "file" field and forwards it
// to the Mint API. Returns Mint's response body on success. On failure we
// return the upstream body text and status so the client (and logs) have more
// information for debugging.
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || ''

    // Try to extract file from form data
    let file: File | null = null
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const maybeFile = formData.get('file')
      if (maybeFile instanceof File) file = maybeFile
    }

    if (!file) {
      return NextResponse.json({ error: 'No file provided (expect multipart/form-data with "file")' }, { status: 400 })
    }

    // Forward to Mint API
    const mintForm = new FormData()
    mintForm.append('file', file)

    const mintRes = await fetch('https://api.mintit.pro/upload', {
      method: 'POST',
      body: mintForm,
    })

    const bodyText = await mintRes.text()

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
        return NextResponse.json({ url: (high && high.url) || json.variants[0].url }, { status: 200 })
      }
      // Else, if url/imageUrl/link/data.url present, return as { url }
      const url = json.url || json.imageUrl || json.link || (json.data && json.data.url)
      if (typeof url === 'string' && url.length > 0) {
        return NextResponse.json({ url }, { status: 200 })
      }
      // Fallback: return original JSON
      return NextResponse.json(json, { status: 200 })
    } catch (err) {
      return new NextResponse(bodyText, { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }
  } catch (err) {
    console.error('Upload proxy error:', err)
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
