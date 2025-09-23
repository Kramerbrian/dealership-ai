import { NextRequest, NextResponse } from 'next/server';
import { withAuth, canAccessDealer } from '@/lib/auth';
import { IntegrationManager } from '@/lib/third-party/integrations';

export const GET = withAuth(async (request: NextRequest, session: any) => {
  try {
    const { searchParams } = new URL(request.url);
    const dealerId = searchParams.get('dealerId');
    const action = searchParams.get('action') || 'status';

    // Check dealer access
    if (dealerId && !canAccessDealer(session, dealerId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const integrationManager = new IntegrationManager();

    switch (action) {
      case 'status':
        const status = integrationManager.getIntegrationStatus();
        return NextResponse.json({
          integrations: status,
          enabled_count: status.filter(i => i.enabled).length,
          total_features: status.reduce((sum, i) => sum + i.features.length, 0)
        });

      case 'market-data':
        if (!dealerId) {
          return NextResponse.json({ error: 'Dealer ID required for market data' }, { status: 400 });
        }

        const make = searchParams.get('make');
        const model = searchParams.get('model');
        const marketData = await integrationManager.getComprehensiveMarketData(dealerId, make || undefined, model || undefined);

        return NextResponse.json({
          success: true,
          data: marketData,
          dealer_id: dealerId,
          generated_at: new Date().toISOString()
        });

      case 'recommendations':
        if (!dealerId) {
          return NextResponse.json({ error: 'Dealer ID required for recommendations' }, { status: 400 });
        }

        // Get market data first
        const fullMarketData = await integrationManager.getComprehensiveMarketData(dealerId);
        const recommendations = await integrationManager.generateMarketingRecommendations(dealerId, fullMarketData);

        return NextResponse.json({
          success: true,
          recommendations,
          dealer_id: dealerId
        });

      default:
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });
    }

  } catch (error) {
    console.error('Integrations API error:', error);
    return NextResponse.json(
      { error: 'Failed to process integration request', details: error.message },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest, session: any) => {
  try {
    const { action, dealerId, ...params } = await request.json();

    // Check dealer access
    if (dealerId && !canAccessDealer(session, dealerId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const integrationManager = new IntegrationManager();

    switch (action) {
      case 'sync-inventory':
        if (!dealerId || !params.inventory) {
          return NextResponse.json({ error: 'Dealer ID and inventory data required' }, { status: 400 });
        }

        // Sync inventory to AutoTrader
        const syncResult = await integrationManager.autotrader.syncInventory(dealerId, params.inventory);

        return NextResponse.json({
          success: syncResult.success,
          result: syncResult,
          synced_at: new Date().toISOString()
        });

      case 'post-social':
        if (!params.platform || !params.content) {
          return NextResponse.json({ error: 'Platform and content required' }, { status: 400 });
        }

        let postResult;
        if (params.platform === 'facebook') {
          postResult = await integrationManager.social.postToFacebook(
            params.pageId || 'default_page',
            params.content,
            params.imageUrl
          );
        } else {
          return NextResponse.json({ error: 'Unsupported social platform' }, { status: 400 });
        }

        return NextResponse.json({
          success: postResult.success,
          result: postResult,
          posted_at: new Date().toISOString()
        });

      case 'fetch-reviews':
        if (!dealerId) {
          return NextResponse.json({ error: 'Dealer ID required' }, { status: 400 });
        }

        const reviews = await integrationManager.gmb.getReviews(params.locationId || 'default_location');

        return NextResponse.json({
          success: true,
          reviews,
          dealer_id: dealerId,
          fetched_at: new Date().toISOString()
        });

      case 'get-lead-metrics':
        if (!dealerId) {
          return NextResponse.json({ error: 'Dealer ID required' }, { status: 400 });
        }

        const leadMetrics = await integrationManager.carscom.getLeadMetrics(dealerId, params.dateRange);

        return NextResponse.json({
          success: true,
          metrics: leadMetrics,
          dealer_id: dealerId,
          period: params.dateRange || '30d'
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Integration action error:', error);
    return NextResponse.json(
      { error: 'Failed to execute integration action', details: error.message },
      { status: 500 }
    );
  }
});