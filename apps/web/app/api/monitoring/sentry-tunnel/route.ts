// Sentry Tunnel API Route for Production Error Reporting
// This prevents ad blockers from blocking error reports

import { NextRequest, NextResponse } from 'next/server';

const SENTRY_HOST = 'sentry.io';
const SENTRY_PROJECT_IDS = ['your-project-id']; // Replace with actual project ID

export async function POST(request: NextRequest) {
  try {
    const envelope = await request.text();

    // Parse the envelope to extract the DSN
    const pieces = envelope.split('\n');
    const header = JSON.parse(pieces[0]);
    const { host, project_id } = parseDsn(header.dsn);

    // Validate the request
    if (host !== SENTRY_HOST) {
      throw new Error(`Invalid host: ${host}`);
    }

    if (!SENTRY_PROJECT_IDS.includes(project_id)) {
      throw new Error(`Invalid project ID: ${project_id}`);
    }

    // Forward to Sentry
    const sentryUrl = `https://${host}/api/${project_id}/envelope/`;

    const response = await fetch(sentryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'User-Agent': request.headers.get('user-agent') || 'DealershipAI/1.0'
      },
      body: envelope
    });

    return new Response(null, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error('Sentry tunnel error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

function parseDsn(dsn: string) {
  const match = dsn.match(/^https:\/\/(.+?)@(.+?)\/(.+)$/);
  if (!match) {
    throw new Error('Invalid DSN format');
  }

  return {
    key: match[1],
    host: match[2],
    project_id: match[3]
  };
}