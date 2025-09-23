// API endpoint for AI consensus analysis
import { executeConsensusAnalysis, DEALERSHIP_PROMPTS } from '../../../lib/ai-consensus-engine';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { domain, analysisType = 'localDominance', dealerId } = req.body;

  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }

  try {
    // Get the specific prompt for the analysis type
    const taskPrompt = DEALERSHIP_PROMPTS[analysisType] || DEALERSHIP_PROMPTS.localDominance;

    // Log the analysis start
    console.log(`Starting consensus analysis for ${domain} - ${analysisType}`);

    // Execute consensus analysis with all three AI providers
    const result = await executeConsensusAnalysis(domain, taskPrompt);

    // Add metadata
    const response = {
      ...result,
      metadata: {
        domain,
        analysisType,
        dealerId,
        timestamp: new Date().toISOString(),
        aiProviders: ['perplexity', 'chatgpt', 'gemini'],
        costEstimate: '$0.05' // Rough estimate based on provider costs
      }
    };

    // Log successful completion
    console.log(`Consensus analysis complete for ${domain}:`, {
      score: result.consensus_score,
      confidence: result.confidence,
      unanimousIssues: result.unanimous_issues.length
    });

    res.status(200).json(response);

  } catch (error) {
    console.error('Consensus analysis failed:', error);

    // Return a fallback response to prevent complete failure
    res.status(500).json({
      error: 'Analysis failed',
      fallback: {
        consensus_score: 50,
        confidence: 'low',
        recommendation: 'Unable to complete analysis - manual review required',
        individual_scores: {
          perplexity: null,
          chatgpt: null,
          gemini: null
        },
        unanimous_issues: [],
        all_quick_wins: []
      },
      metadata: {
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
}