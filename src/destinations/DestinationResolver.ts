import { ClickUpService } from "../services/ClickUpService.js";
import { TemplateStore } from "../services/TemplateStore.js";
import { Template, UnknownTemplateError } from "../formatting/Template.js";
import { ClickUpConfig } from "../types/index.js";
import { Destination, DestinationStore } from "./DestinationStore.js";

const DEFAULT_TEMPLATE_ID = "builtin-standard";

/**
 * Raised when a request names a destination that does not exist, or that
 * belongs to another user — deliberately the same error for both, so the
 * endpoint is not an enumeration oracle for other users' destination ids.
 * Typed so the route layer can answer 400 rather than 500: naming a bad id is
 * the caller's mistake.
 */
export class UnknownDestinationError extends Error {
  constructor(destinationId: string) {
    super(`Destination not found: ${destinationId}`);
    this.name = "UnknownDestinationError";
  }
}

export interface ResolvedDestination {
  /** Null when falling back to the .env configuration. */
  destination: Destination | null;
  clickUp: ClickUpService;
  listId: string | undefined;
  template: Template;
  /**
   * The same configuration `clickUp` was built from. Needed because the legacy
   * `{ workAnalysis }` create path hands a ClickUpConfig to
   * GitWorkAnalyzer.createTasksFromWork, which constructs its own service —
   * without this, that path would keep writing to the .env list no matter which
   * destination the user picked. Contains a plaintext API key: never log it and
   * never put it in a response.
   */
  config: ClickUpConfig;
}

export interface DestinationResolverDeps {
  destinations: DestinationStore;
  templates: TemplateStore;
  envConfig: ClickUpConfig;
}

export class DestinationResolver {
  constructor(private deps: DestinationResolverDeps) {}

  /**
   * Resolution order: explicit id → the user's default → the .env config.
   * The last step keeps callers that predate destinations working unchanged.
   */
  resolve(userId: string, destinationId?: string, templateId?: string): ResolvedDestination {
    let destination: Destination | null = null;

    if (destinationId) {
      destination = this.deps.destinations.get(destinationId, userId);
      if (!destination) throw new UnknownDestinationError(destinationId);
    } else {
      destination = this.deps.destinations.getDefault(userId);
    }

    const template = this.resolveTemplate(templateId, destination);

    if (!destination) {
      return {
        destination: null,
        clickUp: new ClickUpService(this.deps.envConfig),
        listId: this.deps.envConfig.defaultListId,
        template,
        config: this.deps.envConfig,
      };
    }

    const config: ClickUpConfig = {
      teamId: destination.teamId,
      apiKey: this.deps.destinations.getApiKey(destination.id, userId),
      defaultListId: destination.listId,
      defaultAssignee: destination.defaultAssignee,
      projectName: destination.name,
    };

    return {
      destination,
      clickUp: new ClickUpService(config),
      listId: destination.listId,
      template,
      config,
    };
  }

  /**
   * A templateId the caller supplied must exist — substituting a different
   * template would render tasks nobody asked for, and the API has always
   * answered 400 for an unknown id. A *stored* default on a destination is
   * treated more forgivingly: the template may have been deleted since, and
   * refusing would make the destination permanently unusable.
   */
  private resolveTemplate(
    templateId: string | undefined,
    destination: Destination | null
  ): Template {
    if (templateId) {
      const requested = this.deps.templates.get(templateId);
      if (!requested) throw new UnknownTemplateError(templateId);
      return requested;
    }

    const stored = destination?.defaultTemplateId
      ? this.deps.templates.get(destination.defaultTemplateId)
      : null;
    if (stored) return stored;

    const fallback = this.deps.templates.get(DEFAULT_TEMPLATE_ID);
    if (!fallback) throw new Error("No template available — built-in templates are missing");
    return fallback;
  }
}
