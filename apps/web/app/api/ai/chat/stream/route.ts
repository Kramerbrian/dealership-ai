import { NextRequest, NextResponse } from 'next/server';
import { withAuth, canAccessDealer } from '@/lib/auth';
import { generateStreamingResponse } from '@/lib/ai/providers';

export const POST = withAuth(async (request: NextRequest, session: any) => {
  try {
    const { message, dealerId, context = {}, provider = 'openai' } = await request.json();

    // Check if user can access this dealer data
    if (dealerId && !canAccessDealer(session, dealerId)) {
      return NextResponse.json(
        { error: 'Access denied - Cannot access this dealer\'s AI assistant' },
        { status: 403 }
      );
    }

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Prepare enhanced context
    const enhancedContext = {
      ...context,
      dealerId,
      userRole: session.user.role,
      streaming: true
    };

    // Set up Server-Sent Events headers
    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    // Create readable stream for real-time response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (event: string, data: any) => {
          const formatted = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(formatted));
        };

        try {
          // Send initial connection event
          sendEvent('connected', {
            dealerId,
            provider,
            timestamp: new Date().toISOString()
          });

          // Generate streaming AI response
          const aiResponse = await generateStreamingResponse(
            message,
            enhancedContext,
            provider,
            (chunk: string) => {
              // Send each chunk as it's generated
              sendEvent('chunk', {
                content: chunk,
                timestamp: new Date().toISOString()
              });
            }
          );

          // Send final response metadata
          sendEvent('complete', {
            metadata: {
              provider: aiResponse.provider,
              model: aiResponse.model,
              tokensUsed: aiResponse.tokensUsed,
              cost: aiResponse.cost,
              latency: aiResponse.latency
            },
            suggestions: [
              "Tell me more about this recommendation",
              "What are the implementation steps?",
              "How long will this take to see results?",
              "What's the expected ROI?"
            ],
            timestamp: aiResponse.timestamp
          });

          // Close the stream
          sendEvent('close', { message: 'Stream completed successfully' });
          controller.close();

        } catch (error) {
          console.error('Streaming AI error:', error);

          // Send error event
          sendEvent('error', {
            error: 'Failed to generate AI response',
            fallback: 'I\'m experiencing some connectivity issues. Please try again in a moment.',
            timestamp: new Date().toISOString()
          });

          controller.close();
        }
      },

      cancel() {
        // Clean up if client disconnects
        console.log('Streaming cancelled by client');
      }
    });

    return new NextResponse(stream, { headers });

  } catch (error) {
    console.error('AI Streaming API error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize streaming chat' },
      { status: 500 }
    );
  }
});

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'AI Streaming Chat API is running',
    description: 'Real-time streaming responses for enhanced user experience',
    usage: {
      method: 'POST',
      endpoint: '/api/ai/chat/stream',
      contentType: 'text/event-stream',
      events: ['connected', 'chunk', 'complete', 'error', 'close']
    },
    features: [
      'real-time-streaming',
      'server-sent-events',
      'progressive-responses',
      'client-disconnect-handling'
    ]
  });
}