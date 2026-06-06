import type { Request, Response, NextFunction } from 'express';
import type { ZodTypeAny, z } from 'zod';

type Schemas = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

// Validate and coerce request parts. Parsed values replace the originals.
export const validate =
  (schemas: Schemas) => (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query) as Request['query'];
      if (schemas.params) req.params = schemas.params.parse(req.params) as Request['params'];
      next();
    } catch (err) {
      next(err);
    }
  };

export type Infer<T extends ZodTypeAny> = z.infer<T>;
