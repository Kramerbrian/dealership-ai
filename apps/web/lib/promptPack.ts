// Prompt pack management and processing system
import { logger } from './logger';
import { cache } from './cache';

export interface PromptVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    options?: string[];
  };
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  template: string;
  variables: PromptVariable[];
  metadata: {
    author: string;
    version: string;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
  };
  settings: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };
}

export interface PromptPack {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  prompts: PromptTemplate[];
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    tags: string[];
    category: string;
    license?: string;
  };
}

export interface PromptExpansion {
  prompt: string;
  variables: Record<string, any>;
  expandedPrompt: string;
  metadata: {
    templateId: string;
    expandedAt: Date;
    tokenCount?: number;
  };
}

export interface BatchPromptRequest {
  templateId: string;
  variations: Array<Record<string, any>>;
  settings?: PromptTemplate['settings'];
}

class PromptPackManager {
  private packs = new Map<string, PromptPack>();
  private templates = new Map<string, PromptTemplate>();

  async loadPack(packData: PromptPack): Promise<void> {
    // Validate pack structure
    this.validatePromptPack(packData);

    this.packs.set(packData.id, packData);

    // Index individual templates for quick access
    packData.prompts.forEach(prompt => {
      this.templates.set(prompt.id, prompt);
    });

    // Cache the pack
    await cache.set(
      cache.key('prompt-pack', packData.id),
      packData,
      24 * 60 * 60 // Cache for 24 hours
    );

    logger.info('Prompt pack loaded', {
      packId: packData.id,
      name: packData.name,
      promptCount: packData.prompts.length,
    });
  }

  async loadPackFromFile(filePath: string): Promise<PromptPack> {
    try {
      const fs = await import('fs/promises');
      const packData = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      await this.loadPack(packData);
      return packData;
    } catch (error) {
      logger.error('Failed to load prompt pack from file', error instanceof Error ? error : new Error(String(error)), {
        filePath,
      });
      throw error;
    }
  }

  getPack(packId: string): PromptPack | null {
    return this.packs.get(packId) || null;
  }

  getTemplate(templateId: string): PromptTemplate | null {
    return this.templates.get(templateId) || null;
  }

  listPacks(): PromptPack[] {
    return Array.from(this.packs.values());
  }

  listTemplates(packId?: string): PromptTemplate[] {
    if (packId) {
      const pack = this.getPack(packId);
      return pack ? pack.prompts : [];
    }
    return Array.from(this.templates.values());
  }

  searchTemplates(query: string, category?: string): PromptTemplate[] {
    const templates = Array.from(this.templates.values());
    const searchTerm = query.toLowerCase();

    return templates.filter(template => {
      const matchesQuery = template.name.toLowerCase().includes(searchTerm) ||
                          template.description.toLowerCase().includes(searchTerm) ||
                          template.metadata.tags.some(tag => tag.toLowerCase().includes(searchTerm));

      const matchesCategory = !category || template.category === category;

      return matchesQuery && matchesCategory;
    });
  }

  async expandPrompt(templateId: string, variables: Record<string, any>): Promise<PromptExpansion> {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate variables
    this.validateVariables(template, variables);

    // Expand the template
    const expandedPrompt = this.processTemplate(template.template, variables);

    const expansion: PromptExpansion = {
      prompt: template.template,
      variables,
      expandedPrompt,
      metadata: {
        templateId,
        expandedAt: new Date(),
        tokenCount: this.estimateTokenCount(expandedPrompt),
      },
    };

    logger.debug('Prompt expanded', {
      templateId,
      variableCount: Object.keys(variables).length,
      tokenCount: expansion.metadata.tokenCount,
    });

    return expansion;
  }

  async expandBatch(request: BatchPromptRequest): Promise<PromptExpansion[]> {
    const template = this.getTemplate(request.templateId);
    if (!template) {
      throw new Error(`Template not found: ${request.templateId}`);
    }

    const expansions: PromptExpansion[] = [];

    for (const variables of request.variations) {
      try {
        const expansion = await this.expandPrompt(request.templateId, variables);
        expansions.push(expansion);
      } catch (error) {
        logger.error('Failed to expand prompt variation', error instanceof Error ? error : new Error(String(error)), {
          templateId: request.templateId,
          variables,
        });
        // Continue with other variations
      }
    }

    logger.info('Batch prompt expansion completed', {
      templateId: request.templateId,
      requested: request.variations.length,
      successful: expansions.length,
    });

    return expansions;
  }

  private validatePromptPack(pack: PromptPack): void {
    if (!pack.id || !pack.name || !pack.prompts) {
      throw new Error('Invalid prompt pack structure');
    }

    // Validate each prompt template
    pack.prompts.forEach(prompt => {
      if (!prompt.id || !prompt.name || !prompt.template) {
        throw new Error(`Invalid prompt template: ${prompt.id || 'unknown'}`);
      }

      // Check for duplicate template IDs
      const templateIds = pack.prompts.map(p => p.id);
      const duplicates = templateIds.filter((id, index) => templateIds.indexOf(id) !== index);
      if (duplicates.length > 0) {
        throw new Error(`Duplicate template IDs found: ${duplicates.join(', ')}`);
      }
    });
  }

  private validateVariables(template: PromptTemplate, variables: Record<string, any>): void {
    // Check required variables
    const missingRequired = template.variables
      .filter(v => v.required && !(v.name in variables))
      .map(v => v.name);

    if (missingRequired.length > 0) {
      throw new Error(`Missing required variables: ${missingRequired.join(', ')}`);
    }

    // Validate variable types and constraints
    for (const variable of template.variables) {
      const value = variables[variable.name];
      if (value === undefined) continue;

      this.validateVariable(variable, value);
    }
  }

  private validateVariable(variable: PromptVariable, value: any): void {
    // Type validation
    switch (variable.type) {
      case 'string':
        if (typeof value !== 'string') {
          throw new Error(`Variable ${variable.name} must be a string`);
        }
        break;
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          throw new Error(`Variable ${variable.name} must be a number`);
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new Error(`Variable ${variable.name} must be a boolean`);
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          throw new Error(`Variable ${variable.name} must be an array`);
        }
        break;
      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          throw new Error(`Variable ${variable.name} must be an object`);
        }
        break;
    }

    // Additional validation
    if (variable.validation) {
      const { pattern, min, max, options } = variable.validation;

      if (pattern && typeof value === 'string') {
        const regex = new RegExp(pattern);
        if (!regex.test(value)) {
          throw new Error(`Variable ${variable.name} does not match required pattern`);
        }
      }

      if (min !== undefined && typeof value === 'number' && value < min) {
        throw new Error(`Variable ${variable.name} must be >= ${min}`);
      }

      if (max !== undefined && typeof value === 'number' && value > max) {
        throw new Error(`Variable ${variable.name} must be <= ${max}`);
      }

      if (options && !options.includes(value)) {
        throw new Error(`Variable ${variable.name} must be one of: ${options.join(', ')}`);
      }
    }
  }

  private processTemplate(template: string, variables: Record<string, any>): string {
    let result = template;

    // Replace {{variable}} patterns
    const variablePattern = /\{\{(\w+)\}\}/g;
    result = result.replace(variablePattern, (match, variableName) => {
      if (variableName in variables) {
        const value = variables[variableName];
        return Array.isArray(value) ? value.join(', ') : String(value);
      }
      return match; // Leave unreplaced if variable not found
    });

    // Handle conditional blocks: {{#if variable}}...{{/if}}
    const conditionalPattern = /\{\{#if (\w+)\}\}(.*?)\{\{\/if\}\}/gs;
    result = result.replace(conditionalPattern, (match, variableName, content) => {
      const value = variables[variableName];
      return value ? content : '';
    });

    // Handle loops: {{#each array}}...{{/each}}
    const loopPattern = /\{\{#each (\w+)\}\}(.*?)\{\{\/each\}\}/gs;
    result = result.replace(loopPattern, (match, variableName, content) => {
      const array = variables[variableName];
      if (Array.isArray(array)) {
        return array.map(item => {
          // Replace {{this}} with current item
          return content.replace(/\{\{this\}\}/g, String(item));
        }).join('\n');
      }
      return '';
    });

    return result;
  }

  private estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  // Get template usage statistics
  async getTemplateStats(templateId: string): Promise<{
    usageCount: number;
    lastUsed: Date | null;
    averageTokens: number;
  }> {
    const statsKey = cache.key('template-stats', templateId);
    const stats = await cache.get<{
      count: number;
      lastUsed: string | null;
      totalTokens: number;
    }>(statsKey);

    return {
      usageCount: stats?.count || 0,
      lastUsed: stats?.lastUsed ? new Date(stats.lastUsed) : null,
      averageTokens: stats?.count ? Math.round((stats.totalTokens || 0) / stats.count) : 0,
    };
  }

  async recordTemplateUsage(templateId: string, tokenCount: number): Promise<void> {
    const statsKey = cache.key('template-stats', templateId);
    const existingStats = await cache.get<{
      count: number;
      lastUsed: string | null;
      totalTokens: number;
    }>(statsKey);

    const newStats = {
      count: (existingStats?.count || 0) + 1,
      lastUsed: new Date().toISOString(),
      totalTokens: (existingStats?.totalTokens || 0) + tokenCount,
    };

    await cache.set(statsKey, newStats, 30 * 24 * 60 * 60); // Cache for 30 days
  }
}

export const promptPack = new PromptPackManager();
export default promptPack;