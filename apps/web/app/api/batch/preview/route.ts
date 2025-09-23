import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { promptPack } from '@/lib/promptPack';
import { rbac } from '@/lib/rbac';
import { costTracker } from '@/lib/ai-cost';

export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const user = await rbac.authenticateRequest(request);
    if (!user || !rbac.hasPermission(user, 'read:batches')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { templateId, variations, maxPreview = 3 } = await request.json();

    if (!templateId || !variations || !Array.isArray(variations)) {
      return NextResponse.json(
        { error: 'templateId and variations array are required' },
        { status: 400 }
      );
    }

    if (variations.length === 0) {
      return NextResponse.json(
        { error: 'At least one variation is required' },
        { status: 400 }
      );
    }

    const template = promptPack.getTemplate(templateId);
    if (!template) {
      return NextResponse.json(
        { error: `Template not found: ${templateId}` },
        { status: 404 }
      );
    }

    // Preview first few variations
    const previewVariations = variations.slice(0, maxPreview);
    const previews = [];
    let totalTokens = 0;
    let errors = [];

    for (let i = 0; i < previewVariations.length; i++) {
      try {
        const expansion = await promptPack.expandPrompt(templateId, previewVariations[i]);
        previews.push({
          index: i,
          variables: previewVariations[i],
          expandedPrompt: expansion.expandedPrompt,
          tokenCount: expansion.metadata.tokenCount || 0,
        });
        totalTokens += expansion.metadata.tokenCount || 0;
      } catch (error) {
        errors.push({
          index: i,
          variables: previewVariations[i],
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Estimate costs for full batch
    const avgTokensPerVariation = totalTokens / Math.max(previews.length, 1);
    const estimatedTotalTokens = Math.round(avgTokensPerVariation * variations.length);
    const estimatedCost = costTracker.calculateCost(
      'openai',
      template.settings?.model || 'gpt-4o-mini',
      estimatedTotalTokens,
      estimatedTotalTokens * 0.3 // Assume 30% of tokens are output
    );

    // Check if batch would exceed cost limits
    const canProceed = await costTracker.canProceed(
      'openai',
      template.settings?.model || 'gpt-4o-mini',
      estimatedTotalTokens,
      Math.round(estimatedTotalTokens * 0.3),
      user.id,
      user.dealerId
    );

    const summary = {
      totalVariations: variations.length,
      previewedVariations: previews.length,
      erroredVariations: errors.length,
      estimatedTokens: estimatedTotalTokens,
      estimatedCost,
      canProceed: canProceed.allowed,
      costWarning: !canProceed.allowed ? canProceed.reason : undefined,
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        model: template.settings?.model || 'gpt-4o-mini',
      },
    };

    logger.info('Batch preview generated', {
      templateId,
      userId: user.id,
      totalVariations: variations.length,
      previewCount: previews.length,
      errorCount: errors.length,
      estimatedCost,
    });

    return NextResponse.json({
      success: true,
      summary,
      previews,
      errors,
    });
  } catch (error) {
    logger.error('Batch preview error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      {
        error: 'Failed to generate batch preview',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}