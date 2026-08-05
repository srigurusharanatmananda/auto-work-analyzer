import { DEFAULT_TEMPLATE_OPTIONS, Template } from "./Template.js";

/**
 * Seeded, read-only templates. The UI offers "Duplicate to edit" rather than
 * allowing these to be modified, so a user can always get back to a known-good
 * format.
 */
export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: "builtin-standard",
    name: "Standard Work Report",
    description:
      "The default. Prose description followed by provenance. Matches the structured markdown report format.",
    nameTemplate: "{{title}}",
    descriptionTemplate: [
      "{{description}}",
      "",
      "**Type:** {{typeLabel}}  ",
      "**Estimate:** {{estimateHours}} hours  ",
      "{{#completedDate}}**Completed:** {{completedDate}}  {{/completedDate}}",
      "{{#dateRange}}**Commit range:** {{dateRange}}  {{/dateRange}}",
      "{{#commitCount}}**Commits:** {{commitCount}} across {{fileCount}} files{{/commitCount}}",
    ].join("\n"),
    options: { ...DEFAULT_TEMPLATE_OPTIONS },
    isBuiltin: true,
  },
  {
    id: "builtin-terse",
    name: "Terse",
    description: "Title and one-line description. No provenance.",
    nameTemplate: "{{title}}",
    descriptionTemplate: "{{description}}",
    options: {
      ...DEFAULT_TEMPLATE_OPTIONS,
      applyTimeEstimate: false,
      dueDateSource: "none",
      tagStrategy: { mode: "none" },
    },
    isBuiltin: true,
  },
  {
    id: "builtin-commit-log",
    name: "Commit Log",
    description:
      "Audit-heavy: appends every commit hash, date, and changed file to the description.",
    nameTemplate: "{{typeEmoji}} {{title}}",
    descriptionTemplate: [
      "{{description}}",
      "",
      "### Commits",
      "{{#commits}}- `{{shortHash}}` {{date}} — {{message}}",
      "{{/commits}}{{^commits}}_No commits recorded._",
      "{{/commits}}",
      "### Files changed",
      "{{#files}}- `{{.}}`",
      "{{/files}}{{^files}}_None recorded._",
      "{{/files}}",
    ].join("\n"),
    options: { ...DEFAULT_TEMPLATE_OPTIONS },
    isBuiltin: true,
  },
];
