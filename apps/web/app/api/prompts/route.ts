import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || 'all';
  const dealerId = searchParams.get('dealerId') || 'toyota-naples';

  try {
    // Mock prompt templates organized by category
    const promptTemplates = {
      seo: [
        {
          id: 'seo-title-optimization',
          title: 'Page Title Optimization',
          description: 'Generate SEO-optimized page titles for dealership pages',
          template: 'Create an SEO-optimized page title for a {vehicle_type} dealership page in {location} that includes {primary_keyword} and stays under 60 characters.',
          variables: ['vehicle_type', 'location', 'primary_keyword'],
          category: 'seo',
          lastUpdated: '2024-01-15'
        },
        {
          id: 'seo-meta-description',
          title: 'Meta Description Generator',
          description: 'Create compelling meta descriptions that drive clicks',
          template: 'Write a meta description under 155 characters for a {page_type} page that highlights {key_benefit} and includes a call-to-action for {location} customers.',
          variables: ['page_type', 'key_benefit', 'location'],
          category: 'seo',
          lastUpdated: '2024-01-12'
        }
      ],
      aeo: [
        {
          id: 'aeo-faq-generation',
          title: 'FAQ Content for AI Engines',
          description: 'Generate FAQ content optimized for AI answer engines',
          template: 'Create 5 frequently asked questions and detailed answers about {topic} for a car dealership in {location}. Format for AI engines with clear, direct answers.',
          variables: ['topic', 'location'],
          category: 'aeo',
          lastUpdated: '2024-01-18'
        },
        {
          id: 'aeo-voice-search',
          title: 'Voice Search Optimization',
          description: 'Content optimized for voice search queries',
          template: 'Write content that answers the voice search query "Where can I {action} in {location}" for a {brand} dealership, using natural conversational language.',
          variables: ['action', 'location', 'brand'],
          category: 'aeo',
          lastUpdated: '2024-01-16'
        }
      ],
      geo: [
        {
          id: 'geo-local-content',
          title: 'Local SEO Content',
          description: 'Generate location-specific content for local search',
          template: 'Create local SEO content about {service} for customers in {city}, {state}. Include local landmarks, community references, and regional benefits.',
          variables: ['service', 'city', 'state'],
          category: 'geo',
          lastUpdated: '2024-01-14'
        },
        {
          id: 'geo-gmb-posts',
          title: 'Google My Business Posts',
          description: 'Create engaging GMB posts for local visibility',
          template: 'Write a Google My Business post about {promotion} at our {location} dealership. Include call-to-action and local relevance. Keep under 1500 characters.',
          variables: ['promotion', 'location'],
          category: 'geo',
          lastUpdated: '2024-01-10'
        }
      ],
      content: [
        {
          id: 'content-blog-outline',
          title: 'Blog Post Outline',
          description: 'Create comprehensive blog post outlines',
          template: 'Create a detailed blog post outline for "{title}" targeting customers interested in {topic}. Include H2/H3 structure, key points, and SEO considerations.',
          variables: ['title', 'topic'],
          category: 'content',
          lastUpdated: '2024-01-13'
        },
        {
          id: 'content-vehicle-description',
          title: 'Vehicle Description Writer',
          description: 'Generate compelling vehicle descriptions',
          template: 'Write an engaging description for a {year} {make} {model} that highlights {key_features} and appeals to {target_audience} in {location}.',
          variables: ['year', 'make', 'model', 'key_features', 'target_audience', 'location'],
          category: 'content',
          lastUpdated: '2024-01-17'
        }
      ]
    };

    // Filter prompts based on category
    const getPrompts = () => {
      if (category === 'all') {
        return Object.values(promptTemplates).flat();
      }
      return promptTemplates[category as keyof typeof promptTemplates] || [];
    };

    const prompts = getPrompts();

    const response = {
      dealerId,
      category,
      timestamp: new Date().toISOString(),
      totalPrompts: prompts.length,

      prompts: prompts.map(prompt => ({
        ...prompt,
        usage: Math.floor(Math.random() * 100), // Mock usage count
        effectiveness: Math.floor(Math.random() * 40) + 60, // 60-100%
        avgResponseTime: `${(Math.random() * 2 + 0.5).toFixed(1)}s`
      })),

      categories: Object.keys(promptTemplates).map(cat => ({
        name: cat,
        count: promptTemplates[cat as keyof typeof promptTemplates].length,
        description: getCategoryDescription(cat)
      })),

      stats: {
        totalTemplates: Object.values(promptTemplates).flat().length,
        recentlyUpdated: Object.values(promptTemplates).flat()
          .filter(p => new Date(p.lastUpdated) > new Date('2024-01-15')).length,
        avgEffectiveness: Math.floor(Math.random() * 15) + 75, // 75-90%
        topPerforming: prompts
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map(p => p.id)
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Prompts API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prompt templates' },
      { status: 500 }
    );
  }
}

function getCategoryDescription(category: string): string {
  const descriptions = {
    seo: 'Traditional search engine optimization prompts',
    aeo: 'AI engine optimization for ChatGPT, Claude, etc.',
    geo: 'Local search and geographic optimization',
    content: 'General content creation and marketing'
  };
  return descriptions[category as keyof typeof descriptions] || 'General prompts';
}

export async function POST(request: NextRequest) {
  try {
    const { id, title, description, template, variables, category } = await request.json();

    // Mock prompt creation/update
    const newPrompt = {
      id: id || `custom-${Date.now()}`,
      title,
      description,
      template,
      variables: variables || [],
      category: category || 'content',
      lastUpdated: new Date().toISOString(),
      isCustom: true
    };

    return NextResponse.json({
      success: true,
      message: id ? 'Prompt template updated' : 'Prompt template created',
      prompt: newPrompt
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save prompt template' },
      { status: 500 }
    );
  }
}