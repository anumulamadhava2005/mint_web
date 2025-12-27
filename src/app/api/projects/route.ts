import { NextRequest, NextResponse } from 'next/server';
import zlib from 'zlib';

const MINTIT_API_BASE = 'https://api.mintit.pro';
const USER_ID = '9198e3fb-4c22-11f0-906d-080027fda028';

// Allow longer execution and force dynamic for large payloads
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Helper function to forward requests to mintit.pro with authentication
async function proxyToMintit(
  method: string,
  endpoint: string,
  body?: any,
  headers?: Record<string, string>
) {
  const url = `${MINTIT_API_BASE}${endpoint}`;
  
  const requestOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': USER_ID,
      ...headers,
    },
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    const raw = JSON.stringify(body);
    // If payload is large, gzip it before proxying to reduce size
    try {
      if (raw.length > 1024 * 1024) {
        const gz = zlib.gzipSync(Buffer.from(raw, 'utf8'));
        requestOptions.body = new Uint8Array(gz);
        (requestOptions.headers as Record<string, string>)['Content-Encoding'] = 'gzip';
      } else {
        requestOptions.body = raw;
      }
    } catch {
      requestOptions.body = raw;
    }
  }

  try {
    console.log('Proxying request to:', url);
    console.log('Headers:', requestOptions.headers);
    
    const response = await fetch(url, requestOptions);
    const responseData = await response.text();
    
    console.log('Response status:', response.status);
    console.log('Response data:', responseData.substring(0, 200));
    
    let jsonData;
    try {
      jsonData = JSON.parse(responseData);
    } catch {
      jsonData = { error: 'Invalid response from server', rawResponse: responseData };
    }

    return new NextResponse(JSON.stringify(jsonData), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to backend service', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// GET /api/projects - List all projects
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '50';
  const offset = searchParams.get('offset') || '0';
  
  return proxyToMintit('GET', `/api/projects?limit=${limit}&offset=${offset}`);
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return proxyToMintit('POST', '/api/projects', body);
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }
}

// OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}