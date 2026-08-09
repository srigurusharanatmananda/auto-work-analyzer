/**
 * Read-only ClickUp hierarchy browsing, for the destination picker.
 *
 * Every endpoint is a POST, including the ones that only read. A raw API key
 * must not travel in a query string, where it would be written to access logs
 * and proxy logs verbatim; a body is not logged by default. The key is accepted
 * at all so a user can explore a workspace *before* saving a destination for it.
 *
 * Nothing here ever echoes the key back, and no error message includes it.
 */

import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { anyRole } from "../middleware/policy.js";
import { DestinationStore } from "../destinations/DestinationStore.js";
import { ClickUpService } from "../services/ClickUpService.js";

export function createClickUpRouter(destinations: DestinationStore): Router {
  const router = Router();
  const userIdOf = (req: any): string => req.user!.userId;

  const serviceFor = async (req: any): Promise<ClickUpService> => {
    const { apiKey, destinationId, teamId } = req.body;
    if (destinationId) {
      const destination = await destinations.get(destinationId, userIdOf(req));
      if (!destination) throw new Error("Destination not found");
      return new ClickUpService({
        teamId: teamId || destination.teamId,
        apiKey: await destinations.getApiKey(destinationId, userIdOf(req)),
        projectName: destination.name,
      });
    }
    if (!apiKey) throw new Error("Provide either apiKey or destinationId");
    return new ClickUpService({ teamId: teamId || "", apiKey, projectName: "browse" });
  };

  /**
   * ClickUp's own message is passed through for anything other than a 401,
   * because "which id was wrong" is genuinely useful here. A 401 is translated:
   * the raw text is about tokens, and the user is looking at a key field.
   */
  const handle =
    (fn: (service: ClickUpService, body: any) => Promise<unknown>) =>
    async (req: any, res: any) => {
      try {
        res.json({ success: true, data: await fn(await serviceFor(req), req.body) });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Request failed";
        const unauthorized = message.includes("401");
        res.status(unauthorized ? 401 : 400).json({
          success: false,
          error: unauthorized
            ? "That ClickUp API key is invalid or was revoked."
            : message,
        });
      }
    };

  // With no teamId this lists every workspace the key can see, which is what a
  // first-time picker needs; with one it confirms that single workspace.
  router.post(
    "/teams",
    authenticate,
    anyRole,
    handle(async (service, body) => {
      if (!body.teamId) return service.getTeams();
      const info = await service.getTeamInfo();
      return [{ id: info.team.id, name: info.team.name }];
    })
  );

  router.post(
    "/spaces",
    authenticate,
    anyRole,
    handle(async (service) => {
      const spaces = await service.getSpaces();
      return spaces.map((space: any) => ({ id: space.id, name: space.name }));
    })
  );

  router.post(
    "/folders",
    authenticate,
    anyRole,
    handle((service, body) => service.getFolders(body.spaceId))
  );

  // Returns folder lists when folderId is given, otherwise the space's
  // folderless lists. Both are real places tasks can live, and a picker that
  // walked only folders would silently hide the second kind.
  router.post(
    "/lists",
    authenticate,
    anyRole,
    handle((service, body) =>
      body.folderId
        ? service.getListsInFolder(body.folderId)
        : service.getFolderlessLists(body.spaceId)
    )
  );

  router.post(
    "/statuses",
    authenticate,
    anyRole,
    handle((service, body) => service.getListStatuses(body.listId))
  );

  return router;
}
