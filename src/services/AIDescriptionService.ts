/**
 * AI Description Service - Uses Google Gemini API to enhance work item descriptions
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GitCommit } from '../types/index.js';

export interface EnhancedDescription {
  improvedTitle: string;
  description: string;
  suggestedTags: string[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
  businessValue: string;
  technicalSummary: string;
}

export class AIDescriptionService {
  private genAI: GoogleGenerativeAI;
  private model: string = 'gemini-2.5-flash';

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GOOGLE_API_KEY;

    if (!key) {
      throw new Error('GOOGLE_API_KEY is required. Please add it to your .env file.');
    }

    this.genAI = new GoogleGenerativeAI(key);
  }

  /**
   * Generate enhanced description from work item details
   */
  async enhanceWorkItemDescription(
    workItemName: string,
    currentDescription: string,
    commits: GitCommit[],
    filesChanged: string[]
  ): Promise<EnhancedDescription> {
    const prompt = this.buildPrompt(workItemName, currentDescription, commits, filesChanged);

    try {
      const model = this.genAI.getGenerativeModel({ model: this.model });

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      return this.parseResponse(text);
    } catch (error) {
      console.error('AI enhancement failed:', error);
      throw new Error(`Failed to enhance description: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build prompt for Gemini API
   */
  private buildPrompt(
    workItemName: string,
    currentDescription: string,
    commits: GitCommit[],
    filesChanged: string[]
  ): string {
    const commitMessages = commits.map((c) => `- ${c.message}`).join('\n');
    const files = filesChanged.slice(0, 20).join('\n'); // Limit to 20 files to avoid token limits

    return `You are a technical project manager analyzing git commits to create a clear, actionable task description.

**Work Item:** ${workItemName}

**Current Description:**
${currentDescription || '(No description provided)'}

**Commit Messages:**
${commitMessages}

**Files Changed (${filesChanged.length} total):**
${files}
${filesChanged.length > 20 ? `\n... and ${filesChanged.length - 20} more files` : ''}

Please analyze this work and provide:

1. **Improved Title** (5-10 words): A clear, concise title that accurately describes what was done. Better than the current title. Use proper capitalization.
2. **Enhanced Description** (2-3 sentences): A clear, non-technical summary that explains what was done and why it matters
3. **Suggested Tags** (3-5 tags): Relevant labels like "frontend", "api", "bug-fix", "performance", "security", etc.
4. **Priority** (one of: low, normal, high, urgent): Based on keywords like "urgent", "critical", "fix", "breaking", etc.
5. **Business Value** (1 sentence): What business problem this solves or what value it provides
6. **Technical Summary** (2-3 bullet points): Key technical changes made

Format your response EXACTLY as JSON:
{
  "improvedTitle": "...",
  "description": "...",
  "suggestedTags": ["tag1", "tag2", ...],
  "priority": "normal",
  "businessValue": "...",
  "technicalSummary": "- Point 1\\n- Point 2\\n- Point 3"
}`;
  }

  /**
   * Parse Gemini's response into structured data
   */
  private parseResponse(responseText: string): EnhancedDescription {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate response structure
      if (!parsed.description || !parsed.suggestedTags || !parsed.priority) {
        throw new Error('Invalid response structure');
      }

      // Ensure priority is valid
      const validPriorities = ['low', 'normal', 'high', 'urgent'];
      if (!validPriorities.includes(parsed.priority)) {
        parsed.priority = 'normal';
      }

      return {
        improvedTitle: parsed.improvedTitle || '',
        description: parsed.description,
        suggestedTags: Array.isArray(parsed.suggestedTags) ? parsed.suggestedTags : [],
        priority: parsed.priority,
        businessValue: parsed.businessValue || '',
        technicalSummary: parsed.technicalSummary || '',
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      console.error('Response text:', responseText);

      // Fallback: use the raw response as description
      return {
        improvedTitle: '',
        description: responseText.trim(),
        suggestedTags: [],
        priority: 'normal',
        businessValue: '',
        technicalSummary: '',
      };
    }
  }

  /**
   * Batch enhance multiple work items
   */
  async enhanceMultipleWorkItems(
    workItems: Array<{
      name: string;
      description: string;
      commits: GitCommit[];
      files: string[];
    }>
  ): Promise<EnhancedDescription[]> {
    const results: EnhancedDescription[] = [];

    // Process in batches to avoid rate limits
    for (const item of workItems) {
      try {
        const enhanced = await this.enhanceWorkItemDescription(
          item.name,
          item.description,
          item.commits,
          item.files
        );
        results.push(enhanced);

        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to enhance "${item.name}":`, error);
        // Return original description on error
        results.push({
          improvedTitle: item.name,
          description: item.description,
          suggestedTags: [],
          priority: 'normal',
          businessValue: '',
          technicalSummary: '',
        });
      }
    }

    return results;
  }
}
