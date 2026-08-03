/**
 * Manager Summary AI Service - generates manager-friendly summaries.
 *
 * The multi-provider fallback chain it used to own now lives in
 * src/ai/AiClient.ts, shared with commit grouping. This class keeps only what is
 * specific to summaries: the prompt.
 */

import { createAiClientFromEnv } from "../ai/AiClient.js";

/**
 * The shape the manager-summary endpoint posts. Deliberately NOT the domain
 * WorkItem from src/domain/WorkItem.ts — this one is `name`-keyed and arrives
 * straight off the wire from the saved-reports UI.
 */
interface SummaryWorkItem {
  name: string;
  type: string;
  description?: string;
}

export class ManagerSummaryAIService {
  private client = createAiClientFromEnv();

  /**
   * Generate manager-friendly summary with automatic provider fallback.
   */
  async generateManagerSummary(workItems: SummaryWorkItem[], reportDate?: string): Promise<string> {
    if (!workItems || workItems.length === 0) {
      throw new Error('No work items provided');
    }

    const prompt = this.buildPrompt(workItems, reportDate);
    const { text } = await this.client.complete(prompt);
    return text;
  }

  private buildPrompt(workItems: SummaryWorkItem[], reportDate?: string): string {
    const workItemsList = workItems.map((item: SummaryWorkItem, index: number) => {
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
    return this.client.providerNames;
  }
}
