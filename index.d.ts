import type { Response } from 'supertest';

function rewriteBody(
  rewrite: Record<string, rewriteBody.RewriteValue>,
  opts?: { log: boolean },
): (res: Response) => void;

namespace rewriteBody {
  interface RewriteValue<T = any> {
    // add(key: string, validate: (value: T) => boolean): this,

    transform(transform: (value: any) => T): this,
    validate(validate: (value: T) => boolean): this,
    value(value: T): this,
  }

  function string(): RewriteValue<string> & {
    lowercase(): this,
    uppercase(): this,
    email(): this,
    url(): this,

    matches(match: string | string[] | RegExp): this,
    startsWith(prefix: string): this,
    endsWith(suffix: string): this,
    in(values: string[] | Set<string>): this,
  };

  function number(): RewriteValue<number> & {
    positive(): this,
    negative(): this,
    lt(lt: number): this,
    lte(lte: number): this,
    gt(gt: number): this,
    gte(gte: number): this,
    in(values: number[] | Set<number>): this,
  };

  function boolean(): RewriteValue<boolean>;

  function date(): RewriteValue<Date> & {
    today(): this,
    lt(lt: Date): this,
    lte(lte: Date): this,
    gt(gt: Date): this,
    gte(gte: Date): this,
    within(ms: number): this,
  };
}

export = rewriteBody;
