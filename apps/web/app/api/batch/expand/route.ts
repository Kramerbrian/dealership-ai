import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { promptPack } from '@/lib/promptPack';
import { rbac } from '@/lib/rbac';
import { cache } from '@/lib/cache';

export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const user = await rbac.authenticateRequest(request);
    if (!user || !rbac.hasPermission(user, 'write:batches')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { templateId, variations, batchId } = await request.json();

    if (!templateId || !variations || !Array.isArray(variations)) {
      return NextResponse.json(
        { error: 'templateId and variations array are required' },
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

    // Generate batch ID if not provided
    const finalBatchId = batchId || `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Initialize batch tracking
    const batchKey = cache.batchKey(finalBatchId);
    const batchData = {
      id: finalBatchId,
      templateId,
      template: {
        name: template.name,
        description: template.description,
      },
      totalVariations: variations.length,
      status: 'processing',
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      results: {
        successful: 0,
        failed: 0,
        total: variations.length,
      },
      errors: [],
      completedAt: null,
    };

    await cache.set(batchKey, batchData, 24 * 60 * 60); // Cache for 24 hours

    logger.info('Batch expansion started', {
      batchId: finalBatchId,
      templateId,
      variationCount: variations.length,
      userId: user.id,
    });

    // Process batch expansions
    const results = [];
    const errors = [];
    let successCount = 0;

    for (let i = 0; i < variations.length; i++) {
      try {
        const expansion = await promptPack.expandPrompt(templateId, variations[i]);

        results.push({
          index: i,
          variables: variations[i],
          expandedPrompt: expansion.expandedPrompt,
          tokenCount: expansion.metadata.tokenCount || 0,
          expandedAt: expansion.metadata.expandedAt,
        });

        successCount++;

        // Update progress every 10 items or on completion
        if ((i + 1) % 10 === 0 || i === variations.length - 1) {
          batchData.results.successful = successCount;
          batchData.results.failed = errors.length;
          await cache.set(batchKey, batchData, 24 * 60 * 60);
        }
      } catch (error) {
        const errorInfo = {
          index: i,
          variables: variations[i],
          error: error instanceof Error ? error.message : String(error),
        };

        errors.push(errorInfo);
        batchData.errors.push(errorInfo);
      }
    }

    // Record template usage for successful expansions
    const totalTokens = results.reduce((sum, result) => sum + result.tokenCount, 0);
    if (totalTokens > 0) {
      await promptPack.recordTemplateUsage(templateId, totalTokens);
    }

    // Finalize batch
    batchData.status = 'completed';
    batchData.completedAt = new Date().toISOString();
    batchData.results.successful = successCount;
    batchData.results.failed = errors.length;
    await cache.set(batchKey, batchData, 24 * 60 * 60);

    // Store results separately for large batches
    if (results.length > 100) {
      const resultsKey = cache.batchKey(finalBatchId, 'results');
      await cache.set(resultsKey, results, 24 * 60 * 60);
      // Don't include full results in response for large batches
    }

    const summary = {
      batchId: finalBatchId,
      templateId,
      template: {
        name: template.name,
        description: template.description,
      },
      totalVariations: variations.length,
      successful: successCount,
      failed: errors.length,
      totalTokens,
      status: 'completed',
      createdAt: batchData.createdAt,
      completedAt: batchData.completedAt,
    };

    logger.info('Batch expansion completed', {
      batchId: finalBatchId,
      templateId,
      successful: successCount,
      failed: errors.length,
      totalTokens,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      batch: summary,
      results: results.length <= 100 ? results : undefined,
      errors: errors.slice(0, 10), // Limit error details in response
      message: results.length > 100 ?
        'Large batch completed. Use batch status endpoint to retrieve full results.' :
        undefined,
    });
  } catch (error) {
    logger.error('Batch expansion error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      {
        error: 'Failed to process batch expansion',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}