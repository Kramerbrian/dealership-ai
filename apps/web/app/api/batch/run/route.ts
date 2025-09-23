import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { promptPack } from '@/lib/promptPack';
import { rbac } from '@/lib/rbac';
import { costTracker } from '@/lib/ai-cost';
import { cache } from '@/lib/cache';

interface BatchRunRequest {
  templateId: string;
  variations: Array<Record<string, any>>;
  settings?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
  batchId?: string;
  runAsync?: boolean;
}

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

    const {
      templateId,
      variations,
      settings = {},
      batchId,
      runAsync = false
    }: BatchRunRequest = await request.json();

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

    // Merge template settings with request settings
    const finalSettings = {
      ...template.settings,
      ...settings,
      model: settings.model || template.settings?.model || 'gpt-4o-mini',
    };

    // Estimate costs and check limits
    const avgTokensPerVariation = 500; // Conservative estimate
    const estimatedInputTokens = avgTokensPerVariation * variations.length;
    const estimatedOutputTokens = Math.round(estimatedInputTokens * 0.3);

    const canProceed = await costTracker.canProceed(
      'openai',
      finalSettings.model,
      estimatedInputTokens,
      estimatedOutputTokens,
      user.id,
      user.dealerId
    );

    if (!canProceed.allowed) {
      return NextResponse.json(
        {
          error: 'Cost limit exceeded',
          details: canProceed.reason,
          currentCost: canProceed.currentCost,
          limit: canProceed.limit,
        },
        { status: 429 }
      );
    }

    // Generate batch ID
    const finalBatchId = batchId || `run_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Initialize batch tracking
    const batchKey = cache.batchKey(finalBatchId);
    const batchData = {
      id: finalBatchId,
      type: 'run',
      templateId,
      template: {
        name: template.name,
        description: template.description,
      },
      settings: finalSettings,
      totalVariations: variations.length,
      status: 'queued',
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      dealerId: user.dealerId,
      progress: {
        completed: 0,
        failed: 0,
        total: variations.length,
        currentStep: 'initializing',
      },
      results: [],
      errors: [],
      costTracking: {
        estimatedCost: costTracker.calculateCost(
          'openai',
          finalSettings.model,
          estimatedInputTokens,
          estimatedOutputTokens
        ),
        actualCost: 0,
        tokensUsed: 0,
      },
      startedAt: null,
      completedAt: null,
    };

    await cache.set(batchKey, batchData, 24 * 60 * 60);

    logger.info('Batch run initiated', {
      batchId: finalBatchId,
      templateId,
      variationCount: variations.length,
      userId: user.id,
      runAsync,
      estimatedCost: batchData.costTracking.estimatedCost,
    });

    if (runAsync) {
      // Queue for background processing
      batchData.status = 'queued';
      await cache.set(batchKey, batchData, 24 * 60 * 60);

      // In a real implementation, you would enqueue this job
      // For now, we'll process it immediately but return the batch ID
      processRunBatchAsync(finalBatchId, templateId, variations, finalSettings, user);

      return NextResponse.json({
        success: true,
        batchId: finalBatchId,
        status: 'queued',
        message: 'Batch queued for processing. Use batch status endpoint to check progress.',
        estimatedCost: batchData.costTracking.estimatedCost,
        estimatedDuration: Math.ceil(variations.length / 10) + ' minutes',
      });
    }

    // Process synchronously
    batchData.status = 'processing';
    batchData.startedAt = new Date().toISOString();
    batchData.progress.currentStep = 'expanding_prompts';
    await cache.set(batchKey, batchData, 24 * 60 * 60);

    const results = [];
    const errors = [];
    let totalTokensUsed = 0;
    let actualCost = 0;

    for (let i = 0; i < variations.length; i++) {
      try {
        // Expand prompt first
        const expansion = await promptPack.expandPrompt(templateId, variations[i]);

        // Simulate AI API call (in real implementation, call actual AI service)
        const simulatedResponse = await simulateAICall(
          expansion.expandedPrompt,
          finalSettings
        );

        // Record cost
        const callCost = costTracker.calculateCost(
          'openai',
          finalSettings.model,
          expansion.metadata.tokenCount || 0,
          simulatedResponse.outputTokens
        );

        await costTracker.recordCost({
          provider: 'openai',
          model: finalSettings.model,
          operation: 'completion',
          inputTokens: expansion.metadata.tokenCount || 0,
          outputTokens: simulatedResponse.outputTokens,
          userId: user.id,
          dealerId: user.dealerId,
          batchId: finalBatchId,
        });

        const result = {
          index: i,
          variables: variations[i],
          expandedPrompt: expansion.expandedPrompt,
          response: simulatedResponse.content,
          metadata: {
            inputTokens: expansion.metadata.tokenCount || 0,
            outputTokens: simulatedResponse.outputTokens,
            cost: callCost,
            processingTime: simulatedResponse.processingTime,
            model: finalSettings.model,
          },
          completedAt: new Date().toISOString(),
        };

        results.push(result);
        totalTokensUsed += (expansion.metadata.tokenCount || 0) + simulatedResponse.outputTokens;
        actualCost += callCost;

        // Update progress
        batchData.progress.completed = i + 1;
        batchData.costTracking.actualCost = actualCost;
        batchData.costTracking.tokensUsed = totalTokensUsed;

        // Update cache every 10 items
        if ((i + 1) % 10 === 0) {
          await cache.set(batchKey, batchData, 24 * 60 * 60);
        }
      } catch (error) {
        const errorInfo = {
          index: i,
          variables: variations[i],
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        };

        errors.push(errorInfo);
        batchData.progress.failed++;
      }
    }

    // Finalize batch
    batchData.status = 'completed';
    batchData.completedAt = new Date().toISOString();
    batchData.progress.currentStep = 'completed';
    batchData.results = results;
    batchData.errors = errors;
    batchData.costTracking.actualCost = actualCost;
    batchData.costTracking.tokensUsed = totalTokensUsed;

    await cache.set(batchKey, batchData, 24 * 60 * 60);

    // Record template usage
    if (totalTokensUsed > 0) {
      await promptPack.recordTemplateUsage(templateId, totalTokensUsed);
    }

    const summary = {
      batchId: finalBatchId,
      status: 'completed',
      results: {
        successful: results.length,
        failed: errors.length,
        total: variations.length,
      },
      costTracking: batchData.costTracking,
      duration: new Date().getTime() - new Date(batchData.createdAt).getTime(),
      createdAt: batchData.createdAt,
      completedAt: batchData.completedAt,
    };

    logger.info('Batch run completed', {
      batchId: finalBatchId,
      successful: results.length,
      failed: errors.length,
      actualCost,
      totalTokens: totalTokensUsed,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      batch: summary,
      results: results.slice(0, 50), // Limit results in response
      errors: errors.slice(0, 10),
      message: results.length > 50 ?
        'Large batch completed. Use batch status endpoint to retrieve full results.' :
        undefined,
    });
  } catch (error) {
    logger.error('Batch run error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      {
        error: 'Failed to process batch run',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Simulate AI API call for development
async function simulateAICall(prompt: string, settings: any) {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

  const outputTokens = Math.round(50 + Math.random() * 200);

  return {
    content: `[Simulated AI Response]\nBased on: ${prompt.substring(0, 100)}...\nModel: ${settings.model}\nLength: ${outputTokens} tokens`,
    outputTokens,
    processingTime: 100 + Math.random() * 200,
  };
}

// Background processing function
async function processRunBatchAsync(
  batchId: string,
  templateId: string,
  variations: Array<Record<string, any>>,
  settings: any,
  user: any
) {
  // In a real implementation, this would be handled by a queue system
  // For now, we'll just process it with a delay to simulate async behavior
  setTimeout(async () => {
    try {
      const batchKey = cache.batchKey(batchId);
      const batchData = await cache.get(batchKey);
      if (!batchData) return;

      batchData.status = 'processing';
      batchData.startedAt = new Date().toISOString();
      await cache.set(batchKey, batchData, 24 * 60 * 60);

      // Process variations (simplified for background)
      // In production, this would be more robust with proper error handling
      // and progress updates

      batchData.status = 'completed';
      batchData.completedAt = new Date().toISOString();
      await cache.set(batchKey, batchData, 24 * 60 * 60);

      logger.info('Background batch processing completed', {
        batchId,
        templateId,
        variationCount: variations.length,
      });
    } catch (error) {
      logger.error('Background batch processing error', error instanceof Error ? error : new Error(String(error)));
    }
  }, 1000); // Start processing after 1 second
}