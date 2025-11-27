/**
 * Notes Processor
 *
 * Processes notes from various sources (text files, uploaded notes, etc.)
 * and converts them into structured, meaningful tasks with descriptions.
 */

import { DetectedWork } from "../types/index.js";

export interface ProcessedNote {
  originalText: string;
  tasks: DetectedWork[];
}

export interface NoteTask {
  text: string;
  lineNumber: number;
}

export interface StructuredTask {
  title: string;
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  estimateHours?: number;
  description: string;
  lineNumber: number;
}

export class NotesProcessor {
  // Patterns to identify tasks in notes
  private taskPatterns = [
    /^[-*•]\s+(.+)$/gm,              // Bullet points
    /^(\d+)\.\s+(.+)$/gm,            // Numbered lists
    /^TODO:\s*(.+)$/gim,             // TODO items
    /^FIXME:\s*(.+)$/gim,            // FIXME items
    /^\[\s*\]\s*(.+)$/gm,            // Checkbox items [ ]
    /^(?:need to|should|must|have to)\s+(.+)$/gim, // Action phrases
  ];

  // Patterns to identify work types
  private featureKeywords = [
    'add', 'implement', 'create', 'build', 'develop', 'new feature',
    'integrate', 'setup', 'configure', 'install', 'enable'
  ];

  private bugKeywords = [
    'fix', 'bug', 'issue', 'error', 'problem', 'broken', 'crash',
    'resolve', 'correct', 'repair', 'debug', 'patch'
  ];

  private improvementKeywords = [
    'improve', 'enhance', 'optimize', 'refactor', 'update', 'upgrade',
    'better', 'performance', 'speed up', 'clean up', 'reorganize'
  ];

  private testKeywords = [
    'test', 'testing', 'unit test', 'integration test', 'e2e',
    'coverage', 'qa', 'verify', 'validate', 'check'
  ];

  private docKeywords = [
    'document', 'documentation', 'docs', 'readme', 'comment',
    'explain', 'describe', 'write about', 'add notes'
  ];

  /**
   * Process notes and extract tasks
   */
  async processNotes(notesText: string): Promise<ProcessedNote> {
    const tasks: DetectedWork[] = [];

    // Check if this is structured format (contains --- separators and Task X.X: pattern)
    const hasStructuredFormat = notesText.includes('---') && /Task \d+(?:\.\d+)?:/i.test(notesText);

    if (hasStructuredFormat) {
      // Parse as structured tasks
      const structuredTasks = this.parseStructuredTasks(notesText);
      tasks.push(...structuredTasks);
    } else {
      // Extract potential tasks from notes (original behavior)
      const extractedTasks = this.extractTasks(notesText);

      // Convert each extracted task into a DetectedWork item
      for (const task of extractedTasks) {
        const detectedWork = this.convertToDetectedWork(task.text);
        if (detectedWork) {
          tasks.push(detectedWork);
        }
      }

      // If no structured tasks found, try to extract from free-form text
      if (tasks.length === 0) {
        const freeFormTasks = this.extractFromFreeForm(notesText);
        tasks.push(...freeFormTasks);
      }
    }

    return {
      originalText: notesText,
      tasks,
    };
  }

  /**
   * Parse structured tasks separated by ---
   * Format: Task X.X: Title
   *         Priority: LEVEL
   *         Estimate: X hours
   *         Assignee: Name (ignored)
   *         Description: ...
   */
  private parseStructuredTasks(text: string): DetectedWork[] {
    const tasks: DetectedWork[] = [];

    // Split by --- separator (handle optional spaces before/after)
    const sections = text.split(/\n\s*---+\s*\n/).filter(s => s.trim());

    for (const section of sections) {
      const lines = section.split('\n').map(l => l.trim());
      let currentLine = 0;

      // Find task title line (Task X.X: Title)
      const taskTitleRegex = /^Task\s+\d+(?:\.\d+)?:\s*(.+)$/i;
      let taskTitle = '';
      let titleIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(taskTitleRegex);
        if (match) {
          taskTitle = match[1].trim();
          titleIndex = i;
          break;
        }
      }

      if (!taskTitle || titleIndex === -1) {
        continue; // Skip if no task title found
      }

      // Parse metadata and description
      let priority: 'urgent' | 'high' | 'normal' | 'low' = 'normal';
      let estimateHours = 3; // Default
      const descriptionLines: string[] = [];
      let parsingDescription = false;

      for (let i = titleIndex + 1; i < lines.length; i++) {
        let line = lines[i];

        if (!line) {
          if (parsingDescription) {
            descriptionLines.push(''); // Preserve blank lines in description
          }
          continue;
        }

        // Check if this line has combined metadata (Priority:CRITICALEstimate:3hours...)
        // This handles the format where all metadata is on one line
        if (line.includes('Priority:') && line.includes('Estimate:')) {
          // Extract priority
          const priorityMatch = line.match(/Priority:\s*([A-Z]+)/i);
          if (priorityMatch) {
            const priorityValue = priorityMatch[1].toUpperCase();
            if (priorityValue === 'CRITICAL' || priorityValue === 'URGENT') {
              priority = 'urgent';
            } else if (priorityValue === 'HIGH') {
              priority = 'high';
            } else if (priorityValue === 'MEDIUM' || priorityValue === 'NORMAL') {
              priority = 'normal';
            } else if (priorityValue === 'LOW') {
              priority = 'low';
            }
          }

          // Extract estimate
          const estimateMatch = line.match(/Estimate:\s*(\d+(?:\.\d+)?)\s*hours?/i);
          if (estimateMatch) {
            estimateHours = parseFloat(estimateMatch[1]);
          }

          // Check if Description: is on the same line
          if (line.includes('Description:')) {
            // Extract any description text after "Description:"
            const descMatch = line.match(/Description:\s*(.+)$/i);
            if (descMatch && descMatch[1].trim()) {
              descriptionLines.push(descMatch[1].trim());
            }
            parsingDescription = true;
          }
          continue;
        }

        // Parse priority (separate line format)
        const priorityMatch = line.match(/^Priority:\s*(.+)$/i);
        if (priorityMatch) {
          const priorityValue = priorityMatch[1].trim().toUpperCase();
          if (priorityValue === 'CRITICAL' || priorityValue === 'URGENT') {
            priority = 'urgent';
          } else if (priorityValue === 'HIGH') {
            priority = 'high';
          } else if (priorityValue === 'MEDIUM' || priorityValue === 'NORMAL') {
            priority = 'normal';
          } else if (priorityValue === 'LOW') {
            priority = 'low';
          }
          continue;
        }

        // Parse estimate (separate line format)
        const estimateMatch = line.match(/^Estimate:\s*(\d+(?:\.\d+)?)\s*hours?$/i);
        if (estimateMatch) {
          estimateHours = parseFloat(estimateMatch[1]);
          continue;
        }

        // Skip assignee line (we use app default)
        if (line.match(/^Assignee:/i)) {
          continue;
        }

        // Skip "Description:" label
        if (line.match(/^Description:\s*$/i)) {
          parsingDescription = true;
          continue;
        }

        // Everything else is part of description
        parsingDescription = true;
        descriptionLines.push(line);
      }

      // Build description with proper formatting
      const description = descriptionLines
        .join('\n')
        .trim();

      // Determine task type based on title/description
      let type: DetectedWork['type'] = 'feature';
      const searchText = (taskTitle + ' ' + description).toLowerCase();

      if (this.containsAnyKeyword(searchText, this.bugKeywords)) {
        type = 'bug-fix';
      } else if (this.containsAnyKeyword(searchText, this.testKeywords)) {
        type = 'test';
      } else if (this.containsAnyKeyword(searchText, this.docKeywords)) {
        type = 'documentation';
      } else if (this.containsAnyKeyword(searchText, this.improvementKeywords)) {
        type = 'improvement';
      } else if (this.containsAnyKeyword(searchText, this.featureKeywords)) {
        type = 'feature';
      }

      // Map priority to complexity for consistency
      const complexity = priority === 'urgent' ? 'high' :
                        priority === 'high' ? 'high' :
                        priority === 'low' ? 'low' : 'medium';

      // Generate tags
      const tags = this.generateTags(taskTitle + ' ' + description);
      tags.push('structured-notes');

      // Deduplicate tags
      const uniqueTags = Array.from(new Set(tags));

      tasks.push({
        type,
        name: taskTitle,
        description: description || `Task: ${taskTitle}`,
        files: [],
        commits: [],
        complexity,
        estimatedHours: estimateHours,
        tags: uniqueTags,
        priority, // Add priority for ClickUp
      } as any); // Type assertion needed because priority is not in DetectedWork interface
    }

    return tasks;
  }

  /**
   * Extract tasks from structured notes (bullets, numbers, etc.)
   */
  private extractTasks(text: string): NoteTask[] {
    const tasks: NoteTask[] = [];
    const lines = text.split('\n');
    const seenTasks = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.length < 3) continue;

      // Check against all task patterns
      for (const pattern of this.taskPatterns) {
        pattern.lastIndex = 0; // Reset regex
        const match = pattern.exec(line);

        if (match) {
          const taskText = match[1] || match[2] || match[0];
          const cleanedTask = this.cleanTaskText(taskText);

          // Avoid duplicates
          if (cleanedTask && !seenTasks.has(cleanedTask.toLowerCase())) {
            tasks.push({
              text: cleanedTask,
              lineNumber: i + 1,
            });
            seenTasks.add(cleanedTask.toLowerCase());
          }
          break;
        }
      }
    }

    return tasks;
  }

  /**
   * Extract tasks from free-form text (paragraphs, sentences)
   */
  private extractFromFreeForm(text: string): DetectedWork[] {
    const tasks: DetectedWork[] = [];

    // Split into sentences
    const sentences = text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10);

    for (const sentence of sentences) {
      const detectedWork = this.convertToDetectedWork(sentence);
      if (detectedWork && this.isLikelyTask(sentence)) {
        tasks.push(detectedWork);
      }
    }

    return tasks;
  }

  /**
   * Check if text is likely a task (contains action verbs)
   */
  private isLikelyTask(text: string): boolean {
    const lowerText = text.toLowerCase();

    // Check for action verbs
    const actionVerbs = [
      ...this.featureKeywords,
      ...this.bugKeywords,
      ...this.improvementKeywords,
      ...this.testKeywords,
      ...this.docKeywords,
    ];

    return actionVerbs.some(verb => lowerText.includes(verb));
  }

  /**
   * Convert extracted task text into DetectedWork object
   */
  private convertToDetectedWork(taskText: string): DetectedWork | null {
    if (!taskText || taskText.length < 3) return null;

    const lowerText = taskText.toLowerCase();

    // Determine work type based on keywords
    let type: DetectedWork['type'] = 'improvement';

    if (this.containsAnyKeyword(lowerText, this.bugKeywords)) {
      type = 'bug-fix';
    } else if (this.containsAnyKeyword(lowerText, this.featureKeywords)) {
      type = 'feature';
    } else if (this.containsAnyKeyword(lowerText, this.testKeywords)) {
      type = 'test';
    } else if (this.containsAnyKeyword(lowerText, this.docKeywords)) {
      type = 'documentation';
    } else if (this.containsAnyKeyword(lowerText, this.improvementKeywords)) {
      type = 'improvement';
    }

    // Clean and format the task name
    const name = this.formatTaskName(taskText, type);

    // Generate a meaningful description
    const description = this.generateDescription(taskText, type);

    // Estimate complexity based on task text
    const complexity = this.estimateComplexity(taskText);

    // Estimate hours based on complexity
    const estimatedHours = this.estimateHours(complexity);

    // Generate tags based on content
    const tags = this.generateTags(taskText);

    return {
      type,
      name,
      description,
      files: [],
      commits: [],
      complexity,
      estimatedHours,
      tags,
    };
  }

  /**
   * Clean task text by removing markers and extra whitespace
   */
  private cleanTaskText(text: string): string {
    return text
      .replace(/^[-*•\d+.)\]]\s*/, '')      // Remove list markers
      .replace(/^\[[\sx]\]\s*/i, '')        // Remove checkboxes
      .replace(/^(TODO|FIXME):\s*/i, '')    // Remove TODO/FIXME
      .replace(/\s+/g, ' ')                 // Normalize whitespace
      .trim();
  }

  /**
   * Format task name to be clear and concise
   */
  private formatTaskName(text: string, type: DetectedWork['type']): string {
    let name = this.cleanTaskText(text);

    // Capitalize first letter
    name = name.charAt(0).toUpperCase() + name.slice(1);

    // Limit length to 100 characters
    if (name.length > 100) {
      name = name.substring(0, 97) + '...';
    }

    return name;
  }

  /**
   * Generate meaningful description from task text
   */
  private generateDescription(taskText: string, type: DetectedWork['type']): string {
    let description = `**Task Type:** ${this.formatWorkType(type)}\n\n`;
    description += `**Original Note:**\n${taskText}\n\n`;
    description += `**Details:**\n`;

    // Add type-specific guidance
    switch (type) {
      case 'feature':
        description += '- Implement the described feature\n';
        description += '- Add necessary tests\n';
        description += '- Update documentation if needed\n';
        break;
      case 'bug-fix':
        description += '- Identify root cause of the issue\n';
        description += '- Implement fix with tests\n';
        description += '- Verify fix resolves the problem\n';
        break;
      case 'improvement':
        description += '- Analyze current implementation\n';
        description += '- Make necessary improvements\n';
        description += '- Test changes thoroughly\n';
        break;
      case 'test':
        description += '- Write comprehensive test cases\n';
        description += '- Ensure good coverage\n';
        description += '- Verify all tests pass\n';
        break;
      case 'documentation':
        description += '- Write clear documentation\n';
        description += '- Include examples where appropriate\n';
        description += '- Review for accuracy\n';
        break;
    }

    description += `\n*Generated from notes on ${new Date().toISOString().split('T')[0]}*`;

    return description;
  }

  /**
   * Estimate complexity based on task text
   */
  private estimateComplexity(text: string): 'low' | 'medium' | 'high' {
    const lowerText = text.toLowerCase();

    // High complexity indicators
    const highComplexityIndicators = [
      'architecture', 'refactor', 'redesign', 'rebuild', 'rewrite',
      'complex', 'difficult', 'challenging', 'major', 'large',
      'multiple', 'integration', 'system', 'database'
    ];

    // Low complexity indicators
    const lowComplexityIndicators = [
      'simple', 'quick', 'minor', 'small', 'easy', 'straightforward',
      'typo', 'text', 'label', 'color', 'style'
    ];

    if (this.containsAnyKeyword(lowerText, highComplexityIndicators)) {
      return 'high';
    } else if (this.containsAnyKeyword(lowerText, lowComplexityIndicators)) {
      return 'low';
    }

    // Check text length as indicator
    if (text.length > 100) {
      return 'medium';
    } else if (text.length < 30) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Estimate hours based on complexity
   */
  private estimateHours(complexity: 'low' | 'medium' | 'high'): number {
    const baseHours = {
      low: 1,
      medium: 3,
      high: 6,
    };

    return baseHours[complexity];
  }

  /**
   * Generate tags based on task content
   */
  private generateTags(text: string): string[] {
    const tags: string[] = ['from-notes'];
    const lowerText = text.toLowerCase();

    // Technology tags
    const techTags = {
      'frontend': ['ui', 'frontend', 'react', 'vue', 'angular', 'component', 'page'],
      'backend': ['backend', 'api', 'server', 'database', 'endpoint'],
      'mobile': ['mobile', 'ios', 'android', 'app'],
      'testing': ['test', 'testing', 'qa', 'coverage'],
      'documentation': ['doc', 'documentation', 'readme'],
      'security': ['security', 'auth', 'authentication', 'authorization', 'encrypt'],
      'performance': ['performance', 'optimize', 'speed', 'cache'],
      'database': ['database', 'sql', 'query', 'migration', 'schema'],
      'deployment': ['deploy', 'deployment', 'ci', 'cd', 'pipeline'],
    };

    for (const [tag, keywords] of Object.entries(techTags)) {
      if (this.containsAnyKeyword(lowerText, keywords)) {
        tags.push(tag);
      }
    }

    return Array.from(new Set(tags)); // Remove duplicates
  }

  /**
   * Format work type for display
   */
  private formatWorkType(type: DetectedWork['type']): string {
    const typeMap: Record<DetectedWork['type'], string> = {
      'feature': 'New Feature',
      'bug-fix': 'Bug Fix',
      'improvement': 'Improvement',
      'refactor': 'Refactoring',
      'documentation': 'Documentation',
      'test': 'Testing',
    };

    return typeMap[type] || type;
  }

  /**
   * Check if text contains any of the keywords
   */
  private containsAnyKeyword(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }
}
