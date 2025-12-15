import { NextRequest, NextResponse } from 'next/server';

const MINTIT_API_BASE = 'https://api.mintit.pro';
const USER_ID = '9198e3fb-4c22-11f0-906d-080027fda028';

// Configure route for larger payloads
export const maxDuration = 60; // seconds
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
    requestOptions.body = JSON.stringify(body);
  }

  try {
    console.log('[ID Route] Proxying request to:', url);
    console.log('[ID Route] Headers:', requestOptions.headers);
    
    const response = await fetch(url, requestOptions);
    const responseData = await response.text();
    
    console.log('[ID Route] Response status:', response.status);
    console.log('[ID Route] Response data:', responseData.substring(0, 200));
    
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
    console.error('[ID Route] Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to backend service', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// GET /api/projects/[id] - Get a specific project
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  return proxyToMintit('GET', `/api/projects/${id}`);
}

// DELETE /api/projects/[id] - Delete a specific project
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  return proxyToMintit('DELETE', `/api/projects/${id}`);
}

// PUT /api/projects/[id] - Update a specific project
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    return proxyToMintit('PUT', `/api/projects/${id}`, body);
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