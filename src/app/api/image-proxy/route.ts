// app/api/image-proxy/route.ts
import { NextResponse } from 'next/server'

export const runtime = 'edge' // or 'nodejs' - edge is faster for proxying

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const imageUrl = searchParams.get('url')
  
  if (!imageUrl) {
    return new NextResponse('No URL provided', { status: 400 })
  }

  // Validate the URL to prevent SSRF attacks
  try {
    const url = new URL(imageUrl)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return new NextResponse('Invalid protocol', { status: 400 })
    }
  } catch {
    return new NextResponse('Invalid URL', { status: 400 })
  }

  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ImageProxy/1.0)',
      },
    })
    
    if (!response.ok) {
      console.error(`Image proxy failed: ${response.status} ${response.statusText}`)
      return new NextResponse(
        `Failed to fetch: ${response.statusText}`, 
        { status: response.status }
      )
    }
    
    const arrayBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('Content-Type') || 'image/webp'
    
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return new NextResponse(
      `Failed to proxy image: ${error instanceof Error ? error.message : 'Unknown error'}`, 
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}