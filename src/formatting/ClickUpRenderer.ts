import { WorkItem } from "../domain/WorkItem.js";
import { TaskData } from "../types/index.js";
import { buildRenderContext, RenderMeta, WORK_ITEM_SCHEMA } from "./renderContext.js";
import { Template } from "./Template.js";
import { renderTemplate } from "./TemplateEngine.js";

/** ClickUp rejects task names longer than this. */
const MAX_NAME_LENGTH = 500;

export interface RenderedTask {
  task: TaskData;
  workItem: WorkItem;
}

function resolveDueDate(item: WorkItem, template: Template): string | undefined {
  switch (template.options.dueDateSource) {
    case "completedDate":
      return item.completedDate;
    case "lastCommitDate": {
      const dates = item.provenance.commits.map((c) => c.date).sort();
      return dates.length > 0 ? dates[dates.length - 1] : undefined;
    }
    case "none":
    default:
      return undefined;
  }
}

/**
 * `dueDate` is passed in rather than re-derived so the two can never disagree:
 * `matchDueDate` must mean *this* due date, and the `firstCommitDate` fallback
 * has to land on it too.
 */
function resolveStartDate(
  item: WorkItem,
  template: Template,
  dueDate: string | undefined
): string | undefined {
  switch (template.options.startDateSource) {
    case "firstCommitDate": {
      const dates = item.provenance.commits.map((c) => c.date).sort();
      return dates[0] ?? dueDate;
    }
    case "matchDueDate":
      return dueDate;
    case "none":
    default:
      return undefined;
  }
}

function resolveStatus(item: WorkItem, template: Template): string | undefined {
  switch (template.options.statusMode) {
    case "fromWorkItem":
      return item.status;
    case "fixed":
      return template.options.fixedStatus;
    case "destinationDefault":
    default:
      return undefined;
  }
}

function resolveTags(item: WorkItem, template: Template): string[] {
  const strategy = template.options.tagStrategy;
  switch (strategy.mode) {
    case "none":
      return [];
    case "fixed":
      return [...(strategy.fixed ?? [])];
    case "merge":
      return Array.from(new Set([...item.tags, ...(strategy.fixed ?? [])]));
    case "fromWorkItem":
    default:
      return [...item.tags];
  }
}

function renderOne(item: WorkItem, template: Template, meta: RenderMeta): TaskData {
  const context = buildRenderContext(item, meta);
  const name = renderTemplate(template.nameTemplate, context, WORK_ITEM_SCHEMA).trim();
  const description = renderTemplate(template.descriptionTemplate, context, WORK_ITEM_SCHEMA).trim();

  const task: TaskData = {
    name: name.slice(0, MAX_NAME_LENGTH),
    description,
    tags: resolveTags(item, template),
  };

  if (template.options.applyPriority) task.priority = item.priority;
  if (template.options.applyTimeEstimate) {
    task.timeEstimate = Math.round(item.estimateHours * 60 * 60 * 1000);
  }

  const status = resolveStatus(item, template);
  if (status) task.status = status;

  const dueDate = resolveDueDate(item, template);
  if (dueDate) task.dueDate = dueDate;

  // ClickUp rejects a start date after the due date, which is reachable
  // honestly: `dueDateSource: "completedDate"` with a note whose recorded
  // completion predates its own last commit. Dropping the start date loses the
  // Timeline bar; moving the due date would silently contradict the source. So
  // clamp the start to the due date — the task still schedules, on the one day
  // both sources agree on.
  const startDate = resolveStartDate(item, template, dueDate);
  if (startDate) {
    task.startDate = dueDate && startDate > dueDate ? dueDate : startDate;
  }

  if (template.options.emitSubtasks && item.subitems && item.subitems.length > 0) {
    task.subtasks = item.subitems.map((sub) => {
      const { subtasks, ...rest } = renderOne(sub, template, meta);
      return rest;
    });
  }

  return task;
}

export function renderTasks(
  items: WorkItem[],
  template: Template,
  meta: RenderMeta = {}
): RenderedTask[] {
  return items.map((workItem) => ({
    workItem,
    task: renderOne(workItem, template, meta),
  }));
}
