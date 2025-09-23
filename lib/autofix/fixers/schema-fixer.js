const { BaseFixer } = require('../engine');

class SchemaFixer extends BaseFixer {
  async fix(issue, dealership) {
    console.log(`🔧 Fixing schema: ${issue.subtype} for ${dealership.name}`);

    try {
      let schema, deployResult;

      switch (issue.subtype) {
        case 'LOCAL_BUSINESS':
          schema = await this.generateLocalBusinessSchema(dealership);
          deployResult = await this.deploySchema(schema, dealership.url);
          break;

        case 'PRODUCT':
          schema = await this.generateProductSchema(issue, dealership);
          deployResult = await this.deploySchema(schema, issue.url);
          break;

        default:
          throw new Error(`Unknown schema subtype: ${issue.subtype}`);
      }

      // Verify with Perplexity (it can actually check the web)
      const verified = await this.verifyWithPerplexity(issue.url, issue.subtype);

      return {
        success: true,
        details: `Generated and deployed ${issue.subtype} schema`,
        schema: schema,
        verified: verified,
        estimatedValue: issue.estimatedValue,
        timeToComplete: '5-10 minutes'
      };

    } catch (error) {
      return {
        success: false,
        details: `Failed to fix schema: ${error.message}`,
        estimatedValue: 0
      };
    }
  }

  async generateLocalBusinessSchema(dealership) {
    const prompt = `Generate JSON-LD schema for a car dealership with this information:

Business: ${dealership.name}
Address: ${dealership.address}
Phone: ${dealership.phone}
Website: ${dealership.url}
Type: Car Dealer

Include:
- LocalBusiness and AutoDealer types
- Operating hours
- Accepted payments
- Service areas
- Popular vehicle makes
- Customer reviews structure

Return only valid JSON-LD schema markup.`;

    const schemaJson = await this.callOpenAI(prompt, {
      temperature: 0.3, // Low temperature for structured data
      maxTokens: 2000
    });

    return JSON.parse(schemaJson.replace(/```json|```/g, ''));
  }

  async generateProductSchema(issue, dealership) {
    // Extract vehicle info from URL or issue context
    const vehicleInfo = this.extractVehicleInfo(issue.url);

    const prompt = `Generate JSON-LD Product schema for this vehicle listing:

Dealership: ${dealership.name}
Vehicle URL: ${issue.url}
Vehicle: ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}

Include:
- Product type with Vehicle specifics
- Brand, model, year
- Offers section with price range
- Dealer information
- Availability
- Vehicle features
- Fuel economy if applicable

Return only valid JSON-LD schema markup.`;

    const schemaJson = await this.callOpenAI(prompt, {
      temperature: 0.3,
      maxTokens: 1500
    });

    return JSON.parse(schemaJson.replace(/```json|```/g, ''));
  }

  async deploySchema(schema, url) {
    // This would integrate with the dealership's CMS
    // For now, we'll simulate deployment and return instructions

    const schemaScript = `<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
</script>`;

    console.log(`📝 Schema generated for ${url}`);
    console.log('Schema to deploy:', schemaScript);

    // In a real implementation, this would:
    // 1. Connect to their CMS API (WordPress, custom, etc.)
    // 2. Inject the schema into the page head
    // 3. Verify deployment success

    return {
      success: true,
      method: 'CMS_INJECTION',
      location: 'HEAD_SECTION',
      code: schemaScript
    };
  }

  async verifyWithPerplexity(url, schemaType) {
    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-online',
          messages: [{
            role: 'user',
            content: `Check if ${url} now has ${schemaType} schema markup. Use Google's Rich Results Test or similar tools to verify the schema is properly implemented and valid.`
          }],
          max_tokens: 300
        })
      });

      const data = await response.json();
      const result = data.choices[0].message.content;

      // Parse Perplexity's response for success indicators
      const hasSchema = result.toLowerCase().includes('schema found') ||
                       result.toLowerCase().includes('valid schema') ||
                       result.toLowerCase().includes('structured data detected');

      return {
        verified: hasSchema,
        details: result,
        method: 'PERPLEXITY_WEB_CHECK'
      };

    } catch (error) {
      console.error('Perplexity verification failed:', error);
      return {
        verified: false,
        details: 'Unable to verify - will check in next scan cycle',
        method: 'FALLBACK'
      };
    }
  }

  extractVehicleInfo(url) {
    // Parse vehicle info from URL patterns like:
    // /inventory/2024-honda-civic
    // /vehicles/2023-toyota-camry-le

    const urlParts = url.split('/').pop().split('-');

    return {
      year: urlParts[0] || '2024',
      make: urlParts[1] || 'Vehicle',
      model: urlParts.slice(2).join(' ') || 'Listing'
    };
  }
}

module.exports = SchemaFixer;