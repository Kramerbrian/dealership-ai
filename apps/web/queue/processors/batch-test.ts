// Sample batch processing job processor
import { Job } from '../index';
import { logger } from '@/lib/logger';
import { promptPack } from '@/lib/promptPack';
import { costTracker } from '@/lib/ai-cost';

export interface BatchTestJobPayload {
  templateId: string;
  variations: Array<Record<string, any>>;
  settings?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
}

export async function processBatchTest(job: Job): Promise<{
  results: any[];
  totalTokens: number;
  totalCost: number;
  duration: number;
}> {
  const startTime = Date.now();
  logger.info('Processing batch test job', {
    jobId: job.id,
    templateId: job.payload.templateId,
    variationCount: job.payload.variations.length,
  });

  const { templateId, variations, settings = {} }: BatchTestJobPayload = job.payload;

  const template = promptPack.getTemplate(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const finalSettings = {
    ...template.settings,
    ...settings,
    model: settings.model || template.settings?.model || 'gpt-4o-mini',
  };

  const results = [];
  let totalTokens = 0;
  let totalCost = 0;

  for (let i = 0; i < variations.length; i++) {
    try {
      // Expand prompt
      const expansion = await promptPack.expandPrompt(templateId, variations[i]);

      // Simulate AI API call
      const response = await simulateAICall(expansion.expandedPrompt, finalSettings);

      // Calculate cost
      const inputTokens = expansion.metadata.tokenCount || 0;
      const outputTokens = response.outputTokens;
      const cost = costTracker.calculateCost('openai', finalSettings.model, inputTokens, outputTokens);

      // Record cost if user info is available
      if (job.metadata.userId) {
        await costTracker.recordCost({
          provider: 'openai',
          model: finalSettings.model,
          operation: 'completion',
          inputTokens,
          outputTokens,
          userId: job.metadata.userId,
          dealerId: job.metadata.dealerId,
          batchId: job.metadata.batchId,
        });
      }

      const result = {
        index: i,
        variables: variations[i],
        expandedPrompt: expansion.expandedPrompt,
        response: response.content,
        metadata: {
          inputTokens,
          outputTokens,
          cost,
          model: finalSettings.model,
          processingTime: response.processingTime,
        },
      };

      results.push(result);
      totalTokens += inputTokens + outputTokens;
      totalCost += cost;

      // Add small delay to simulate real processing
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

      // Log progress every 10 items
      if ((i + 1) % 10 === 0 || i === variations.length - 1) {
        logger.debug('Batch test progress', {
          jobId: job.id,
          completed: i + 1,
          total: variations.length,
          percentage: Math.round((i + 1) / variations.length * 100),
        });
      }
    } catch (error) {
      logger.error('Error processing variation', error instanceof Error ? error : new Error(String(error)), {
        jobId: job.id,
        variationIndex: i,
        variables: variations[i],
      });

      // Continue with other variations instead of failing the entire job
      results.push({
        index: i,
        variables: variations[i],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Record template usage
  if (totalTokens > 0) {
    await promptPack.recordTemplateUsage(templateId, totalTokens);
  }

  const duration = Date.now() - startTime;

  logger.info('Batch test job completed', {
    jobId: job.id,
    templateId,
    successful: results.filter(r => !r.error).length,
    failed: results.filter(r => r.error).length,
    totalTokens,
    totalCost,
    duration,
  });

  return {
    results,
    totalTokens,
    totalCost,
    duration,
  };
}

// Simulate AI API call for development/testing
async function simulateAICall(prompt: string, settings: any) {
  // Simulate processing time based on prompt length
  const baseTime = 200;
  const variableTime = Math.random() * 300;
  const processingTime = baseTime + variableTime;

  await new Promise(resolve => setTimeout(resolve, processingTime));

  // Simulate output tokens based on prompt length and model settings
  const promptTokens = Math.ceil(prompt.length / 4);
  const maxTokens = settings.maxTokens || 150;
  const outputTokens = Math.min(
    maxTokens,
    Math.round(30 + Math.random() * 120) // Random between 30-150 tokens
  );

  // Generate simulated response
  const responses = [
    'Based on your dealership analysis, here are the key recommendations for improving your online visibility and search rankings.',
    'The automotive market in your area shows significant opportunities for digital optimization and customer engagement.',
    'Your current SEO performance indicates several areas for improvement, particularly in local search optimization.',
    'Customer behavior analysis reveals important trends that can inform your marketing and service strategies.',
    'Competitive analysis shows your position in the market and identifies key areas where you can gain advantage.',
  ];

  const baseResponse = responses[Math.floor(Math.random() * responses.length)];
  const enhancedResponse = `${baseResponse}\n\nDetailed Analysis:\n• Search visibility metrics\n• Local market positioning\n• Customer engagement opportunities\n• Technical optimization recommendations\n\nThis analysis is based on current market data and industry best practices for automotive dealerships.`;

  return {
    content: enhancedResponse,
    outputTokens,
    processingTime,
    metadata: {
      model: settings.model,
      temperature: settings.temperature || 0.7,
      promptTokens,
    },
  };
}