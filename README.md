# supertest-rewrite-json-body

[![NPM](https://badge.fury.io/js/supertest-rewrite-json-body.svg)](https://npm.im/supertest-rewrite-json-body)
[![Test](https://github.com/someimportantcompany/supertest-rewrite-body/actions/workflows/test.yml/badge.svg?branch=main&event=push)](https://github.com/someimportantcompany/supertest-rewrite-body/actions/workflows/test.yml)
[![Typescript](https://img.shields.io/badge/TS-TypeScript-%230074c1.svg)](https://www.typescriptlang.org)
[![Coverage Status](https://coveralls.io/repos/github/someimportantcompany/supertest-rewrite-json-body/badge.svg?branch=main)](https://coveralls.io/github/someimportantcompany/supertest-rewrite-json-body?branch=main)

Rewrite [`supertest`][] body responses to better reinforce your test suite.

```ts
import supertest from 'supertest';
import rewrite from 'supertest-rewrite-json-body';

await supertest(app)
  .get('/path/to/resource/some-kind-of-id')
  .expect(200)
  // .expect({
  //   data: {
  //     type: 'resources',
  //     id: 'f031d2d7-6484-494f-9897-5f16a596e254',
  //     attributes: { counter: 42, enabled: false },
  //     meta: { createdAt: '2023-07-23T21:00:00.000Z' },
  //   },
  // })
  .expect(rewrite({
    'data.id': rewrite.string(),
    'data.attributes.counter': rewrite.number(),
    'data.attributes.enabled': rewrite.boolean(),
    'data.meta.createdAt': rewrite.date(),
  }))
  .expect({
    data: {
      type: 'resources',
      id: ':string:',
      attributes: { counter: ':number:', enabled: ':boolean:' },
      meta: { createdAt: ':date:' },
    },
  });
```

- Supports four key scalar types:
  - Strings
  - Numbers
  - Booleans
  - Dates
- Uses [`flat`][], [`micromatch`][] & [`lodash.set`][] to support (similar) results sets & deep pattern matching.
- Optionally set the replacement value statically to improve the layout of your test suite.
- **Validates raw values before replacing**, so if the wrong type/format is returned during the test then it should still break!
- This **will alter** `res.body` directly - see [extracting data](#extracting-data) below.

## Install

```sh
$ npm install --save supertest-rewrite-json-body
# or
$ yarn add supertest-rewrite-json-body
```

And from within your test suite:

```js
import rewrite from 'supertest-rewrite-json-body';
// or
const rewrite = require('supertest-rewrite-json-body');
```

## Types

- All types include additional optional chainable methods, so you can better validate the raw property returned in your tests.
- All types will have a default replacement value, which you can overwrite for each pattern.

### `string`

Validates the property is a string, and replaces with `:string:` (by default).

```ts
rewrite.string()
```

Method | Description
---- | ----
`lowercase()` | Ensure the string is all lowercase.
`uppercase()` | Ensure the string is all uppercase.
`email()` | Ensure the string contains an `@` symbol.
`url()` | Ensure the string starts with `http://` or `https://`.
`matches(match: string / string[] / RegExp)` | Ensure the string matches the argument, either with a regular expression or passing into [`micromatch`][].
`startsWith(prefix: string)` | Ensure the string starts with the specific prefix.
`endsWith(suffix: string)` | Ensure the string ends with the specific suffix.
`in(values: Set<string> / string[])` | Ensure the string matches one of these values.
`value(replace: string)` | Set the default `:string:` replacement to a value of your choosing.
`validate(validate: (value: string) => boolean)` | Add a custom validator, so you can be more confident the value being replaced is of the correct type/contents.

```ts
rewrite.string()
  .lowercase()
  .uppercase()
  .email()
  .url()

  .matches('/path/to/resource/*')
  .matches('/(path|route)/to/resource')
  .matches(['/(path|route)/to/resource', '/path/from/*'])
  .matches(/^[a-f0-9]{32}$/i)

  .startsWith('some-important-')
  .endsWith('-company')
  .in(['a1', 'b2', 'c3'])

  .value(':paramId')
  .validate((value: string) => value.split('/').length === 3)
```

### `number`

Validates the property is a number, and replaces with `:number:` (by default).

```ts
rewrite.number()
```

Method | Description
---- | ----
`positive()` | Ensure the number is greater than `0`.
`negative()` | Ensure the number is less than `0`.
`lt(lt: number)` | Ensure the number is less than the given number.
`lte(lte: number)` | Ensure the number is less than or equal to the given number.
`gt(gt: number)` | Ensure the number is greater than the given number.
`gte(gte: number)` | Ensure the number is greater than or equal to the given number.
`in(values: Set<number> / number[])` | Ensure the number matches one of these values.
`value(replace: number)` | Set the default `:number:` replacement to a (number) value of your choosing.
`validate(validate: (value: number) => boolean)` | Add a custom validator, so you can be more confident the value being replaced is of the correct type/contents.

```ts
rewrite.number()
  .positive()
  .negative()

  .lt(10)
  .lte(9)
  .gt(11)
  .gte(12)
  .in([1, 2, 3])

  .value(42)
  .validate((value: number) => (value * Math.random()) >= 17)
```

### `boolean`

Validates the property is a boolean, and replaces with `:boolean:` (by default).

```ts
rewrite.number()
```

Method | Description
---- | ----
`value(replace: boolean)` | Set the default `:boolean:` replacement to a (boolean) value of your choosing.
`validate(validate: (value: boolean) => boolean)` | Add a custom validator, so you can be more confident the value being replaced is of the correct type/contents.

```ts
rewrite.boolean()
  .value(false)
  .validate((value: boolean) => !value === true)
```

### `date`

Validates the property is a number, and replaces with `:number:` (by default).

```ts
rewrite.date()
```

Method | Description
---- | ----
`today()` | Ensure the number is greater than `0`.
`lt(lt: Date)` | Ensure the date is less than the given date.
`lte(lte: Date)` | Ensure the date is less than or equal to the given date.
`gt(gt: Date)` | Ensure the date is greater than the given date.
`gte(gte: Date)` | Ensure the date is greater than or equal to the given date.
`within(ms: number)` | Ensure the date is within a specific window of milliseconds.
`value(replace: number)` | Set the default `:number:` replacement to a (number) value of your choosing.
`validate(validate: (value: number) => boolean)` | Add a custom validator, so you can be more confident the value being replaced is of the correct type/contents.

```ts
rewrite.date()
  .today()

  .lt(new Date('2020-01-01'))
  .lte(new Date('2020-02-01'))
  .gt(new Date('2020-03-01'))
  .gte(new Date('2020-04-01'))

  .within(100)

  .value(42)
  .validate((value: number) => (value * Math.random()) >= 17)
```

**Fun fact:** `within` pairs really well with [`ms`](https://npm.im/ms) for "created at" or "recently updated" dates:

```ts
import ms from 'ms';
import rewrite from 'supertest-rewrite-json-body';

rewrite.date().within(ms('30s'))
```

## Advanced

### Wildcard rewrite keys

**Are supported!** Thanks to [`flat`][] & [`micromatch`][], you can perform the same rewrites for a similar pattern in your response:

```ts
await supertest(app)
  .get('/path/to/resource')
  .query({ page: 1, limit: 20 })
  .expect(200)
  // .expect({
  //   data: [
  //     {
  //       type: 'resources',
  //       id: 'f031d2d7-6484-494f-9897-5f16a596e254',
  //       attributes: { counter: 42, enabled: false },
  //       meta: { createdAt: '2023-07-23T21:00:00.000Z' },
  //     },
  //     { ... Repeat for the other 19 items }
  //   ],
  //   meta: {
  //     total: 20,
  //   },
  // })
  .expect(rewrite({
    'data.*.id': rewrite.string().matches('*-*-*-*').value(':resourceId'),
    'data.*.meta.createdAt': rewrite.date().value(':createdAt'),
  }))
  .expect({
    data: [
      {
        type: 'resources',
        id: ':resourceId',
        attributes: { counter: 42, enabled: false },
        meta: { createdAt: ':date:' },
      },
      // { ... Repeat for the other 19 items }
    ],
    meta: {
      total: 20,
    },
  });
```

- You must match the [`flat`][] `arr.0` pattern with your wildcard, so `arr.*` matches.
- All properties matches will have the same replacement - so you should test your IDs better than this example!
  - E.g. [`validator`](https://npm.im/validator)?
  - `.validate(value => validator.isMongoId(value))`
  - `.validate(value => validator.isUUID(value, 4))`

### Extracting data

To keep [`supertest`][] as unchanged as possible, the `rewrite` method **will alter** `res.body`. This means if you `rewrite` an ID you need later, the ID's value will be overwritten for the rewrite:

```ts
import supertest from 'supertest';
import rewrite from 'supertest-rewrite-json-body';

await supertest(app)
  .get('/path/to/resource/some-kind-of-id')
  .expect(200)
  // .expect({
  //   data: {
  //     type: 'resources',
  //     id: 'f031d2d7-6484-494f-9897-5f16a596e254',
  //     attributes: { counter: 42, enabled: false },
  //     meta: { createdAt: '2023-07-23T21:00:00.000Z' },
  //   },
  // })
  .expect(rewrite({
    'data.id': rewrite.string(),
    'data.attributes.counter': rewrite.number(),
    'data.attributes.enabled': rewrite.boolean(),
    'data.meta.createdAt': rewrite.date(),
  }))
  .expect({
    data: {
      type: 'resources',
      id: ':string:',
      attributes: { counter: ':number:', enabled: ':boolean:' },
      meta: { createdAt: ':date:' },
    },
  })
  .expect(res => {
    // So now you want to cleanup your test
    // Perhaps by deleting from DB where `id` = `data.id`?
    // Ah, but at this point `data.id === ":string:"`
  });
```

Instead, you should extract your "correct" IDs before running through `rewrite`, like so:

```ts
import supertest from 'supertest';
import rewrite from 'supertest-rewrite-json-body';

let createdId: string;

await supertest(app)
  .get('/path/to/resource/some-kind-of-id')
  .expect(200)
  // .expect({
  //   data: {
  //     type: 'resources',
  //     id: 'f031d2d7-6484-494f-9897-5f16a596e254',
  //     attributes: { counter: 42, enabled: false },
  //     meta: { createdAt: '2023-07-23T21:00:00.000Z' },
  //   },
  // })
  .expect(res => {
    if (res.body && typeof res.body.data?.id === 'string) {
      // Extract the ID you need here, if the ID was indeed set
      ({ id: createdId } = res.body.data);
    }
  })
  .expect(rewrite({
    'data.id': rewrite.string(),
    'data.attributes.counter': rewrite.number(),
    'data.attributes.enabled': rewrite.boolean(),
    'data.meta.createdAt': rewrite.date(),
  }))
  .expect({
    data: {
      type: 'resources',
      id: ':string:',
      attributes: { counter: ':number:', enabled: ':boolean:' },
      meta: { createdAt: ':date:' },
    },
  });

// Now cleanup your test with `createdId`
```

----

- Questions or feedback? [Open an issue](https://github.com/someimportantcompany/supertest-rewrite-body)!

[`supertest`]: https://npm.im/supertest
[`flat`]: https://npm.im/flat
[`micromatch`]: https://npm.im/micromatch
[`lodash.set`]: https://npm.im/lodash.set
