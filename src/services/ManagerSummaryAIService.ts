/**
 * Manager Summary AI Service - Multi-provider fallback system for generating manager-friendly summaries
 * Supports: Google Gemini, Groq, Hugging Face Inference API, OpenRouter
 */

interface WorkItem {
  name: string;
  type: string;
  description?: string;
}

interface AIProvider {
  name: string;
  generate: (prompt: string) => Promise<string>;
  isConfigured: () => boolean;
}

export class ManagerSummaryAIService {
  private providers: AIProvider[] = [];

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    // Provider 1: Google Gemini (multiple models)
    if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY !== 'your_google_api_key_here') {
      this.providers.push({
        name: 'Google Gemini 1.5 Flash Latest',
        isConfigured: () => true,
        generate: async (prompt: string) => {
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
          const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
          const result = await model.generateContent(prompt);
          return result.response.text();
        },
      });

      this.providers.push({
        name: 'Google Gemini 1.5 Pro Latest',
        isConfigured: () => true,
        generate: async (prompt: string) => {
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
          const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
          const result = await model.generateContent(prompt);
          return result.response.text();
        },
      });

      this.providers.push({
        name: 'Google Gemini Pro',
        isConfigured: () => true,
        generate: async (prompt: string) => {
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
          const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
          const result = await model.generateContent(prompt);
          return result.response.text();
        },
      });
    }

    // Provider 2: Groq (Free, no credit card)
    if (process.env.GROQ_API_KEY) {
      this.providers.push({
        name: 'Groq Llama 3.3 70B',
        isConfigured: () => true,
        generate: async (prompt: string) => {
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.7,
              max_tokens: 1024,
            }),
          });

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`Groq API error: ${error}`);
          }

          const data = await response.json();
          return data.choices[0].message.content;
        },
      });
    }

    // Provider 3: Hugging Face Inference API (Free)
    if (process.env.HUGGINGFACE_API_KEY) {
      this.providers.push({
        name: 'Hugging Face Qwen 2.5 72B',
        isConfigured: () => true,
        generate: async (prompt: string) => {
          const response = await fetch(
            'https://api-inference.huggingface.co/models/Qwen/Qwen2.5-72B-Instruct',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                inputs: prompt,
                parameters: {
                  max_new_tokens: 1024,
                  temperature: 0.7,
                  return_full_text: false,
                },
              }),
            }
          );

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`Hugging Face API error: ${error}`);
          }

          const data = await response.json();
          return data[0].generated_text;
        },
      });
    }

    // Provider 4: OpenRouter (Free tier available)
    if (process.env.OPENROUTER_API_KEY) {
      this.providers.push({
        name: 'OpenRouter (Free Models)',
        isConfigured: () => true,
        generate: async (prompt: string) => {
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://github.com/auto-work-analyzer',
            },
            body: JSON.stringify({
              model: 'meta-llama/llama-3.3-70b-instruct:free',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.7,
              max_tokens: 1024,
            }),
          });

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenRouter API error: ${error}`);
          }

          const data = await response.json();
          return data.choices[0].message.content;
        },
      });
    }
  }

  /**
   * Generate manager-friendly summary with automatic fallback
   */
  async generateManagerSummary(workItems: WorkItem[], reportDate?: string): Promise<string> {
    if (!workItems || workItems.length === 0) {
      throw new Error('No work items provided');
    }

    if (this.providers.length === 0) {
      throw new Error(
        'No AI providers configured. Please add at least one API key to your .env file:\n' +
        '- GOOGLE_API_KEY (https://aistudio.google.com/apikey)\n' +
        '- GROQ_API_KEY (https://console.groq.com/keys)\n' +
        '- HUGGINGFACE_API_KEY (https://huggingface.co/settings/tokens)\n' +
        '- OPENROUTER_API_KEY (https://openrouter.ai/keys)'
      );
    }

    const prompt = this.buildPrompt(workItems, reportDate);
    const errors: Array<{ provider: string; error: string }> = [];

    // Try each provider in sequence until one succeeds
    for (const provider of this.providers) {
      try {
        console.log(`🤖 Attempting to generate summary with: ${provider.name}`);
        const summary = await provider.generate(prompt);
        console.log(`✅ Successfully generated summary with: ${provider.name}`);
        return summary;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ ${provider.name} failed:`, errorMessage);
        errors.push({ provider: provider.name, error: errorMessage });

        // Check if it's a quota/rate limit error
        if (this.isQuotaError(errorMessage)) {
          console.log(`⏭️  Quota exceeded for ${provider.name}, trying next provider...`);
          continue;
        }

        // For other errors, still try the next provider
        console.log(`⏭️  Error with ${provider.name}, trying next provider...`);
        continue;
      }
    }

    // All providers failed
    const errorSummary = errors.map(e => `${e.provider}: ${e.error}`).join('\n');
    throw new Error(
      `All AI providers failed to generate summary.\n\nErrors:\n${errorSummary}\n\n` +
      `Providers tried: ${this.providers.map(p => p.name).join(', ')}`
    );
  }

  private isQuotaError(errorMessage: string): boolean {
    const quotaKeywords = [
      'quota',
      'rate limit',
      'too many requests',
      '429',
      'exceeded',
      'overloaded',
    ];
    return quotaKeywords.some(keyword =>
      errorMessage.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private buildPrompt(workItems: WorkItem[], reportDate?: string): string {
    const workItemsList = workItems.map((item: WorkItem, index: number) => {
      const emoji = item.type === 'feature' ? '✨' : item.type === 'bug-fix' ? '🐛' : '🔧';
      let description = `${index + 1}. ${emoji} ${item.name}`;
      if (item.description && item.description.trim()) {
        description += `\n   Technical details: ${item.description}`;
      }
      return description;
    }).join('\n\n');

    return `You are translating technical work items into a business-friendly summary for non-technical managers.

**Report Date:** ${reportDate || 'Today'}

**Technical Work Items:**
${workItemsList}

Please create a manager-friendly summary that:
1. Translates technical jargon into business language
2. Focuses on business value and outcomes rather than technical implementation
3. Groups related items together when appropriate
4. Uses clear, concise language that a non-technical manager would understand
5. Highlights impact on users, customers, or business processes
6. Keeps the emoji indicators for visual clarity

Format the response as a conversational but professional summary. Start with "Sri Gurusharanatmanda EOD:" and then list the items with brief business-oriented descriptions.

Example format:
Sri Gurusharanatmanda EOD:
- ✨ [Business-friendly title]
  → [What this means for the business/users in 1-2 simple sentences]

Keep it concise and focused on what was accomplished and why it matters to the business.`;
  }

  /**
   * Get list of configured providers
   */
  getConfiguredProviders(): string[] {
    return this.providers.map(p => p.name);
  }
}
