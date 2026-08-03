/**
 * Destination CRUD.
 *
 * Responses carry `Destination` objects, which by construction have no API key
 * field — see the note on that type. Nothing here reads a key back out except
 * `/test`, which uses it to make one ClickUp call and never returns it.
 */

import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { DestinationStore } from "../destinations/DestinationStore.js";
import { ClickUpService } from "../services/ClickUpService.js";

const REQUIRED_ON_CREATE = ["name", "apiKey", "teamId", "listId"] as const;

/**
 * Only the fields a destination actually has. Whitelisted rather than passing
 * `req.body` through, so a caller cannot reach `userId`, `isDefault`, or a
 * future column by naming it in the body.
 */
function destinationInputFrom(body: any) {
  return {
    name: body.name,
    apiKey: body.apiKey,
    teamId: body.teamId,
    teamName: body.teamName,
    spaceId: body.spaceId,
    spaceName: body.spaceName,
    folderId: body.folderId,
    folderName: body.folderName,
    listId: body.listId,
    listName: body.listName,
    defaultTemplateId: body.defaultTemplateId,
    defaultAssignee: body.defaultAssignee,
  };
}

export function createDestinationsRouter(destinations: DestinationStore): Router {
  const router = Router();
  const userIdOf = (req: any): string => req.user!.userId;

  const fail = (res: any, error: unknown, status = 400): void => {
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : "Request failed",
    });
  };

  router.get("/", authenticate, (req, res) => {
    res.json({ success: true, data: destinations.list(userIdOf(req)) });
  });

  router.post("/", authenticate, (req, res) => {
    const missing = REQUIRED_ON_CREATE.filter((key) => !req.body[key]);
    if (missing.length > 0) {
      res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(", ")}`,
      });
      return;
    }
    try {
      res.status(201).json({
        success: true,
        data: destinations.create(userIdOf(req), destinationInputFrom(req.body)),
      });
    } catch (error) {
      fail(res, error);
    }
  });

  router.put("/:id", authenticate, (req, res) => {
    try {
      res.json({
        success: true,
        data: destinations.update(req.params.id!, userIdOf(req), destinationInputFrom(req.body)),
      });
    } catch (error) {
      fail(res, error, 404);
    }
  });

  router.post("/:id/default", authenticate, (req, res) => {
    try {
      destinations.setDefault(req.params.id!, userIdOf(req));
      res.json({ success: true });
    } catch (error) {
      fail(res, error, 404);
    }
  });

  router.delete("/:id", authenticate, (req, res) => {
    try {
      destinations.remove(req.params.id!, userIdOf(req));
      res.json({ success: true });
    } catch (error) {
      fail(res, error, 404);
    }
  });

  // Confirms the credentials work and the target list is reachable. Returns the
  // list's real statuses, which is also the answer to "why did my status get
  // dropped in the preview".
  router.post("/:id/test", authenticate, async (req, res) => {
    try {
      const userId = userIdOf(req);
      const destination = destinations.get(req.params.id!, userId);
      if (!destination) {
        fail(res, new Error("Destination not found"), 404);
        return;
      }
      const service = new ClickUpService({
        teamId: destination.teamId,
        apiKey: destinations.getApiKey(destination.id, userId),
        projectName: destination.name,
      });
      const statuses = await service.getListStatuses(destination.listId);
      res.json({ success: true, data: { reachable: true, statuses } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Test failed";
      res.status(400).json({
        success: false,
        error: message.includes("401")
          ? "This destination's API key is invalid or was revoked."
          : message.includes("404")
          ? "The target list no longer exists. Re-select it for this destination."
          : message,
      });
    }
  });

  return router;
}
