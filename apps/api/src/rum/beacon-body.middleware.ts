import { BadRequestException, HttpException } from "@nestjs/common";
import { text } from "body-parser";
import type { NextFunction, Request, Response } from "express";

/**
 * `navigator.sendBeacon` cannot post `application/json` across origins: that
 * type needs a CORS preflight, and a beacon never makes one. So the browser
 * sends the JSON as `text/plain`, which Nest's global body parsers leave
 * unread. These two run for `POST /rum` only, so no other route starts
 * accepting a text body, and they hand the global `ValidationPipe` an object
 * to validate like any DTO.
 */
export const RUM_BODY_LIMIT = "4kb";

const parseText = text({ type: "text/plain", limit: RUM_BODY_LIMIT });

// body-parser fails with its own http-errors (413 too large, 415 bad charset or
// encoding, 400 aborted), which Nest's filter does not recognise and would
// answer, log and report as a 500. A gzip body that inflates past the limit
// gets through nginx's size cap, so this is reachable by anyone.
export function readBeaconText(req: Request, res: Response, next: NextFunction): void {
  parseText(req, res, (err?: unknown) => {
    const status = (err as { status?: unknown } | undefined)?.status;
    if (typeof status === "number" && status >= 400 && status < 500) {
      next(new HttpException((err as Error).message, status));
      return;
    }
    next(err);
  });
}

export function parseBeaconJson(req: Request, _res: Response, next: NextFunction): void {
  if (typeof req.body === "string") {
    try {
      req.body = JSON.parse(req.body);
    } catch {
      throw new BadRequestException("Beacon body is not JSON");
    }
  }
  next();
}
