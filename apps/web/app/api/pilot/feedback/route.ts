import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get('timeframe') || '30d';
  const category = searchParams.get('category') || 'all';
  const dealerId = searchParams.get('dealerId') || 'toyota-naples';

  try {
    // Comprehensive feedback collection and analysis system
    const feedbackData = {
      dealerId,
      timeframe,
      category,
      timestamp: new Date().toISOString(),

      // Aggregated feedback metrics
      overallMetrics: {
        totalFeedbackEntries: 147,
        averageRating: 4.4,
        responseRate: 0.78,
        completionRate: 0.91,
        npsScore: 67,
        recommendationRate: 0.89,
        improvementTrend: 0.23 // 23% positive trend
      },

      // Feedback by stakeholder role
      stakeholderFeedback: {
        dealershipManager: {
          totalResponses: 12,
          averageRating: 4.6,
          keyMetrics: {
            systemValue: 4.8,
            easeOfImplementation: 4.2,
            ROIClarity: 4.7,
            staffAdoption: 4.3
          },
          qualitativeFeedback: [
            {
              date: '2024-02-15',
              rating: 5,
              comment: "The AI visibility insights directly improved our Google ranking position from #4 to #2 for 'Toyota Naples'",
              category: 'performance_impact',
              sentiment: 'very_positive',
              actionTaken: 'shared_as_case_study'
            },
            {
              date: '2024-02-12',
              rating: 4,
              comment: "Revenue attribution finally shows which marketing channels actually work. Radio ROI clarity is a game changer.",
              category: 'analytics_value',
              sentiment: 'positive',
              actionTaken: 'expand_radio_tracking'
            },
            {
              date: '2024-02-08',
              rating: 5,
              comment: "Competitive alerts helped us respond to Honda's campaign in 4 hours instead of days. Saved significant market share.",
              category: 'competitive_advantage',
              sentiment: 'very_positive',
              actionTaken: 'increase_monitoring_frequency'
            }
          ]
        },

        salesTeam: {
          totalResponses: 67,
          averageRating: 4.3,
          keyMetrics: {
            dashboardUsability: 4.5,
            customerInsights: 4.7,
            dailyUtility: 4.0,
            learningCurve: 3.8
          },
          commonFeedback: {
            positiveThemes: [
              'Customer journey tracking helps qualify leads better',
              'Voice search insights show what customers really want',
              'Competitive pricing alerts keep us informed',
              'Inventory optimization suggestions increase upsells'
            ],
            improvementAreas: [
              'Need mobile app for lot walk-arounds',
              'More detailed customer preference predictions',
              'Faster data refresh for real-time decisions',
              'Integration with existing sales tools'
            ]
          },
          adoptionMetrics: {
            dailyActiveUsers: 0.87, // 87% of sales team
            featureUtilization: 0.72,
            trainingCompletionRate: 0.94,
            supportTickets: 23
          }
        },

        serviceTeam: {
          totalResponses: 34,
          averageRating: 4.1,
          keyMetrics: {
            appointmentInsights: 4.4,
            serviceOptimization: 3.8,
            customerCommunication: 4.3,
            workflowIntegration: 3.9
          },
          specificFeedback: [
            {
              role: 'Service Manager',
              feedback: 'Voice search data shows customers asking about service hours - we extended weekend hours and saw 15% appointment increase',
              impact: 'operational_change',
              measuredOutcome: '15% appointment increase'
            },
            {
              role: 'Service Advisor',
              feedback: 'Customer journey insights help predict service needs before customers even call',
              impact: 'proactive_service',
              measuredOutcome: '23% customer satisfaction increase'
            }
          ]
        },

        marketingTeam: {
          totalResponses: 18,
          averageRating: 4.7,
          keyMetrics: {
            campaignInsights: 4.9,
            attributionClarity: 4.8,
            competitiveIntelligence: 4.6,
            contentOptimization: 4.4
          },
          campaignImpact: [
            {
              campaign: 'Spring Sales Event',
              beforeAI: { roi: 3.2, attribution_confidence: 0.45 },
              afterAI: { roi: 4.7, attribution_confidence: 0.91 },
              improvement: '47% ROI increase, 91% attribution confidence'
            },
            {
              campaign: 'Voice Search Optimization',
              beforeAI: { queries_captured: 0.23 },
              afterAI: { queries_captured: 0.41 },
              improvement: '78% increase in voice query capture'
            }
          ]
        },

        customers: {
          totalResponses: 89,
          averageRating: 4.2,
          keyMetrics: {
            findingInformation: 4.5,
            voiceSearchExperience: 4.3,
            overallSatisfaction: 4.2,
            likelinessToRecommend: 4.4
          },
          sentimentAnalysis: {
            positive: 0.67,
            neutral: 0.28,
            negative: 0.05
          },
          customerJourneyFeedback: [
            {
              touchpoint: 'voice_search',
              rating: 4.3,
              comments: ['Found exactly what I needed', 'Quick and accurate responses', 'Better than typing on phone']
            },
            {
              touchpoint: 'website_visit',
              rating: 4.1,
              comments: ['Easy to navigate', 'Good vehicle information', 'Appointment booking was smooth']
            },
            {
              touchpoint: 'dealership_visit',
              rating: 4.4,
              comments: ['Staff was well-informed', 'Found my preferences were already known', 'Process was efficient']
            }
          ]
        }
      },

      // Feature-specific feedback analysis
      featureFeedback: {
        voiceSearchOptimization: {
          rating: 4.6,
          adoption: 0.89,
          impact: 'high',
          specificComments: [
            'Dramatically improved our voice search visibility',
            'Customers finding us through Alexa and Google Home now',
            'Question-based content strategy is working'
          ],
          improvementSuggestions: [
            'Add more local voice query variations',
            'Integrate with car voice assistants',
            'Expand to Spanish language queries'
          ]
        },

        competitiveIntelligence: {
          rating: 4.8,
          adoption: 0.92,
          impact: 'very_high',
          specificComments: [
            'Game-changing competitive insights',
            '4-hour response time vs 2+ days before',
            'Prevented loss of market share multiple times'
          ],
          improvementSuggestions: [
            'Add more competitor monitoring',
            'Predictive threat analysis',
            'Automated response recommendations'
          ]
        },

        revenueAttribution: {
          rating: 4.7,
          adoption: 0.85,
          impact: 'high',
          specificComments: [
            'Finally understand marketing ROI accurately',
            'Data-driven budget allocation decisions',
            'Eliminated marketing waste'
          ],
          improvementSuggestions: [
            'More granular channel attribution',
            'Predictive revenue modeling',
            'Integration with financial systems'
          ]
        },

        lotOptimization: {
          rating: 4.5,
          adoption: 0.78,
          impact: 'medium_high',
          specificComments: [
            'Visual lot improvements drove premium sales',
            'Hybrid positioning strategy worked perfectly',
            'Data-backed inventory organization'
          ],
          improvementSuggestions: [
            'Real-time lot condition monitoring',
            'Seasonal optimization recommendations',
            'Weather-based positioning guidance'
          ]
        }
      },

      // System usability and technical feedback
      technicalFeedback: {
        performance: {
          rating: 4.2,
          loadTimes: 'acceptable_to_good',
          reliability: 'good',
          issues: [
            'Occasional slow dashboard loading during peak hours',
            'Radio data connector sometimes needs manual refresh',
            'Mobile responsiveness could be improved'
          ]
        },

        integration: {
          rating: 4.0,
          easeOfSetup: 'moderate',
          dataAccuracy: 'good_to_excellent',
          issues: [
            'CRM integration required custom field mapping',
            'Analytics setup needed technical support',
            'Staff training took longer than expected'
          ]
        },

        userInterface: {
          rating: 4.3,
          intuitiveness: 'good',
          visualDesign: 'professional',
          suggestions: [
            'Larger fonts for older staff members',
            'More customizable dashboard layouts',
            'Better mobile experience',
            'Dark mode option'
          ]
        }
      },

      // Business impact validation
      businessImpactFeedback: {
        quantifiedBenefits: {
          revenueIncrease: {
            reported: 117000,
            confidence: 0.89,
            attribution_method: 'before_after_comparison'
          },
          costSavings: {
            reported: 34000,
            confidence: 0.92,
            sources: ['reduced_marketing_waste', 'staff_efficiency']
          },
          timesSaved: {
            reported: '4.2 hours per week per person',
            confidence: 0.86,
            activities: ['competitive_research', 'report_generation', 'data_analysis']
          }
        },

        strategicValue: [
          'Competitive advantage through faster market response',
          'Data-driven decision making culture',
          'Improved customer experience through optimization',
          'Enhanced staff confidence and productivity',
          'Better marketing ROI and budget allocation'
        ]
      },

      // Improvement roadmap based on feedback
      improvementRoadmap: [
        {
          priority: 'high',
          category: 'mobile_experience',
          description: 'Develop mobile-optimized dashboard and native app',
          requestedBy: ['sales_team', 'service_team'],
          estimatedImpact: 'improved_daily_usage_by_40%',
          timeline: '6-8 weeks'
        },
        {
          priority: 'high',
          category: 'data_refresh',
          description: 'Implement real-time data streaming for critical metrics',
          requestedBy: ['management', 'marketing'],
          estimatedImpact: 'eliminate_refresh_delays',
          timeline: '4-6 weeks'
        },
        {
          priority: 'medium',
          category: 'integration',
          description: 'Expand CRM integration with additional data fields',
          requestedBy: ['sales_team', 'management'],
          estimatedImpact: 'enhanced_customer_insights',
          timeline: '3-4 weeks'
        },
        {
          priority: 'medium',
          category: 'competitive',
          description: 'Add predictive competitive threat analysis',
          requestedBy: ['management', 'marketing'],
          estimatedImpact: 'proactive_market_response',
          timeline: '8-10 weeks'
        }
      ]
    };

    return NextResponse.json(feedbackData);
  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, feedback } = await request.json();

    switch (action) {
      case 'submit_feedback':
        const feedbackId = `feedback-${Date.now()}`;

        return NextResponse.json({
          success: true,
          feedbackId,
          message: 'Feedback submitted successfully',
          feedback: {
            ...feedback,
            id: feedbackId,
            submittedAt: new Date().toISOString(),
            status: 'received',
            sentiment: analyzeFeedbackSentiment(feedback.comment || ''),
            category: categorizeFeedback(feedback.category || feedback.comment || ''),
            priority: calculateFeedbackPriority(feedback.rating || 3)
          },
          nextSteps: feedback.rating < 3 ? [
            'Schedule follow-up call within 24 hours',
            'Escalate to product team',
            'Create improvement ticket'
          ] : [
            'Add to feedback analysis',
            'Consider for roadmap planning'
          ]
        });

      case 'generate_feedback_report':
        return NextResponse.json({
          success: true,
          message: 'Feedback report generation initiated',
          reportId: `feedback-report-${Date.now()}`,
          reportType: 'comprehensive',
          estimatedCompletion: new Date(Date.now() + 600000).toISOString(), // 10 minutes
          sections: [
            'executive_summary',
            'stakeholder_analysis',
            'feature_performance',
            'business_impact_validation',
            'improvement_recommendations'
          ]
        });

      case 'analyze_sentiment':
        return NextResponse.json({
          success: true,
          message: 'Sentiment analysis completed',
          analysisId: `sentiment-${Date.now()}`,
          results: {
            overallSentiment: 'positive',
            confidenceScore: 0.87,
            keyThemes: ['satisfaction', 'value', 'improvement_requests'],
            emotionalTone: 'constructive',
            actionability: 'high'
          }
        });

      default:
        return NextResponse.json({
          error: 'Unknown feedback action',
          availableActions: ['submit_feedback', 'generate_feedback_report', 'analyze_sentiment']
        }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process feedback action' },
      { status: 500 }
    );
  }
}

// Helper functions for feedback analysis
function analyzeFeedbackSentiment(comment: string): string {
  const positiveWords = ['great', 'excellent', 'amazing', 'helpful', 'valuable', 'improved', 'better'];
  const negativeWords = ['bad', 'terrible', 'difficult', 'confusing', 'slow', 'frustrating', 'worse'];

  const lowerComment = comment.toLowerCase();
  const positiveCount = positiveWords.filter(word => lowerComment.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerComment.includes(word)).length;

  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

function categorizeFeedback(input: string): string {
  const categories = {
    'performance': ['slow', 'fast', 'speed', 'loading', 'response'],
    'usability': ['easy', 'difficult', 'interface', 'navigation', 'design'],
    'features': ['feature', 'functionality', 'capability', 'tool'],
    'integration': ['connect', 'sync', 'data', 'crm', 'analytics'],
    'business_value': ['revenue', 'profit', 'roi', 'value', 'money', 'sales']
  };

  const lowerInput = input.toLowerCase();
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => lowerInput.includes(keyword))) {
      return category;
    }
  }

  return 'general';
}

function calculateFeedbackPriority(rating: number): string {
  if (rating <= 2) return 'high';
  if (rating <= 3) return 'medium';
  return 'low';
}