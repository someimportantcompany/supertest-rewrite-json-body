// import assert from 'assert';
import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import validator from 'validator';

import rewrite from './';

describe('@someimportantcompany/supertest-rewrite-json-body', () => {
  function createApp(routerFn: (router: express.Router) => void) {
    const app = express();
    app.use(express.json({ strict: true }));
    app.use(express.urlencoded({ extended: false }));

    routerFn(app);

    return app;
  }

  describe('core > supertest', () => {
    const app = createApp(router => {
      router.get('/', (req, res) => {
        res.status(200).json('Hello, world!');
      });

      router.all('/mirror', (req, res) => {
        req.headers.host = req.headers.host!.split(':').shift()!;

        res.status(200).json({
          method: req.method,
          url: `${req.protocol}://${req.hostname}${req.path}`,
          path: req.path,
          headers: { ...req.headers },
          query: { ...req.query },
          body: req.body ?? {},
        });
      });
    });

    it('should handle a GET request', async () => {
      await request(app)
        .get('/mirror')
        .query({ hello: 'query' })
        .expect(200)
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect({
          method: 'GET',
          url: 'http://127.0.0.1/mirror',
          path: '/mirror',
          headers: {
            'accept-encoding': 'gzip, deflate',
            connection: 'close',
            host: '127.0.0.1',
          },
          query: { hello: 'query' },
          body: {},
        });
    });

    it('should handle a POST request', async () => {
      await request(app)
        .post('/mirror')
        .send({ hello: 'body' })
        .expect(200)
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect({
          method: 'POST',
          url: 'http://127.0.0.1/mirror',
          path: '/mirror',
          headers: {
            'accept-encoding': 'gzip, deflate',
            connection: 'close',
            'content-length': '16',
            'content-type': 'application/json',
            host: '127.0.0.1',
          },
          query: {},
          body: { hello: 'body' },
        });
    });

    it('should handle a PUT request', async () => {
      await request(app)
        .put('/mirror')
        .send({ hello: 'body' })
        .expect(200)
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect({
          method: 'PUT',
          url: 'http://127.0.0.1/mirror',
          path: '/mirror',
          headers: {
            'accept-encoding': 'gzip, deflate',
            connection: 'close',
            'content-length': '16',
            'content-type': 'application/json',
            host: '127.0.0.1',
          },
          query: {},
          body: { hello: 'body' },
        });
    });

    it('should handle a DELETE request', async () => {
      await request(app)
        .delete('/mirror')
        .expect(200)
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect({
          method: 'DELETE',
          url: 'http://127.0.0.1/mirror',
          path: '/mirror',
          headers: {
            'accept-encoding': 'gzip, deflate',
            connection: 'close',
            host: '127.0.0.1',
          },
          query: {},
          body: {},
        });
    });
  });

  it('should skip rewrite if the response body is not an object or array', async () => {
    const app = createApp(router => {
      router.get('/static', (req, res) => {
        res.status(200).json('Hello, world');
      });
    });

    await request(app)
      .get('/static')
      .expect(200)
      .expect(rewrite({
        'value': rewrite.string(),
      }))
      .expect('"Hello, world"');
  });

  describe('types', () => {
    function staticValueRoutes(router: express.Router): void {
      router.get('/string/static', (req, res) => {
        res.status(200).json({
          value: 'some static string',
        });
      });

      router.get('/number/static', (req, res) => {
        res.status(200).json({
          value: 42,
        });
      });

      router.get('/boolean/static', (req, res) => {
        res.status(200).json({
          value: true,
        });
      });

      router.get('/date/static', (req, res) => {
        res.status(200).json({
          value: new Date('2023-07-24 18:00:00.000Z'),
        });
      });
    }

    it('should skip rewrite if type matches but validator fails', async () => {
      const app = createApp(router => staticValueRoutes(router));

      await request(app)
        .get('/string/static')
        .expect(200)
        .expect(rewrite({
          'value': rewrite.string()
            .startsWith('some-important')
            .endsWith('-company'),
        }))
        .expect({
          value: 'some static string',
        });
    });

    describe('string', () => {
      const app = createApp(router => {
        staticValueRoutes(router);

        router.get('/string/everything', (req, res) => {
          res.status(200).json({
            lowercase: 'hello world',
            uppercase: 'HELLO WORLD',
            email: 'jdrydn@users.noreply.github.com',
            url: 'https://github.com/jdrydn',
            value: 'something-like-this',
          });
        });
      });

      it('should rewrite strings', async () => {
        await request(app)
          .get('/string/static')
          .expect(200)
          .expect(rewrite({
            'value': rewrite.string(),
          }))
          .expect({
            value: ':string:',
          });
      });

      it('should rewrite strings with modifiers', async () => {
        await request(app)
          .get('/string/everything')
          .expect(200)
          .expect(rewrite({
            lowercase: rewrite.string().lowercase().value('lowercase'),
            uppercase: rewrite.string().uppercase().value('uppercase'),
            email: rewrite.string().email().value('email'),
            url: rewrite.string().url().value('url'),
            value: rewrite.string()
              .matches('something-like-this')
              .startsWith('something-like-')
              .endsWith('-this')
              .in([ 'something-like-this' ])
              .in(new Set([ 'something-like-this' ]))
              .value('value'),
          }))
          .expect({
            lowercase: 'lowercase',
            uppercase: 'uppercase',
            email: 'email',
            url: 'url',
            value: 'value',
          });
      });

      it('should skip rewriting numbers', async () => {
        await request(app)
          .get('/number/static')
          .expect(200)
          .expect(rewrite({ 'value': rewrite.string() }))
          .expect({ value: 42 });
      });
      it('should skip rewriting booleans', async () => {
        await request(app)
          .get('/boolean/static')
          .expect(200)
          .expect(rewrite({ 'value': rewrite.string() }))
          .expect({ value: true });
      });
      it('should rewriting dates (as strings)', async () => {
        await request(app)
          .get('/date/static')
          .expect(200)
          .expect(rewrite({ 'value': rewrite.string() }))
          .expect({ value: ':string:' });
      });
    });

    describe('number', () => {
      const app = createApp(router => {
        staticValueRoutes(router);

        router.get('/number/enum', (req, res) => {
          res.status(200).json({
            value: (enums => enums[Math.floor(Math.random() * enums.length)])([1, 2, 3]),
          });
        });

        router.get('/number/everything', (req, res) => {
          res.status(200).json({
            positive: 100,
            negative: -100,
            values: { xs: 1, sm: 10, md: 50, lg: 80, xl: 99 },
          });
        });
      });

      it('should rewrite numbers', async () => {
        await request(app)
          .get('/number/static')
          .expect(200)
          .expect(rewrite({
            'value': rewrite.number(),
          }))
          .expect({
            value: ':number:',
          });
      });

      it('should rewrite numbers with modifiers', async () => {
        await request(app)
          .get('/number/everything')
          .expect(200)
          .expect(rewrite({
            'positive': rewrite.number().positive().value(0),
            'negative': rewrite.number().negative().value(0),
            'values.xs': rewrite.number().lt(2).value(0),
            'values.sm': rewrite.number().lte(10).value(0),
            'values.md': rewrite.number().gt(40).value(0),
            'values.lg': rewrite.number().gte(50).value(0),
            'values.xl': rewrite.number()
              .in([ 48, 99 ])
              .in(new Set([ 48, 99 ]))
              .value(0),
          }))
          .expect({
            positive: 0,
            negative: 0,
            values: { xs: 0, sm: 0, md: 0, lg: 0, xl: 0 },
          });
      });

      it('should skip rewriting strings', async () => {
        await request(app)
          .get('/string/static')
          .expect(200)
          .expect(rewrite({ 'value': rewrite.number() }))
          .expect({ value: 'some static string' });
      });
      it('should skip rewriting booleans', async () => {
        await request(app)
          .get('/boolean/static')
          .expect(200)
          .expect(rewrite({ 'value': rewrite.number() }))
          .expect({ value: true });
      });
      it('should skip rewriting dates', async () => {
        await request(app)
          .get('/date/static')
          .expect(200)
          .expect(rewrite({ 'value': rewrite.number() }))
          .expect({ value: '2023-07-24T18:00:00.000Z' });
      });
    });

    describe('boolean', () => {
      const app = createApp(router => staticValueRoutes(router));

      it('should rewrite booleans', async () => {
        await request(app)
          .get('/boolean/static')
          .expect(200)
          .expect(rewrite({
            'value': rewrite.boolean(),
          }))
          .expect({
            value: ':boolean:',
          });
      });

      it('should skip rewriting strings', async () => {
        await request(app)
          .get('/string/static')
          .expect(200)
          .expect(rewrite({ 'value': rewrite.boolean() }))
          .expect({ value: 'some static string' });
      });

      it('should skip rewriting numbers', async () => {
        await request(app)
          .get('/number/static')
          .expect(200)
          .expect(rewrite({ 'value': rewrite.boolean() }))
          .expect({ value: 42 });
      });

      it('should skip rewriting dates', async () => {
        await request(app)
          .get('/date/static')
          .expect(200)
          .expect(rewrite({ 'value': rewrite.boolean() }))
          .expect({ value: '2023-07-24T18:00:00.000Z' });
      });
    });

    describe('types > dates', () => {
      const app = createApp(router => {
        staticValueRoutes(router);

        router.get('/date/now', (req, res) => {
          res.status(200).json({
            value: new Date(),
          });
        });

        router.get('/date/everything', (req, res) => {
          res.status(200).json({
            now: new Date(),
            value: new Date('2023-07-24'),
          });
        });
      });

      it('should rewrite dates', async () => {
        await request(app)
          .get('/date/static')
          .expect(200)
          .expect(rewrite({
            'value': rewrite.date(),
          }))
          .expect({
            value: ':date:',
          });
      });

      it('should rewrite dates with modifiers', async () => {
        await request(app)
          .get('/date/everything')
          .expect(200)
          .expect(rewrite({
            'now': rewrite.date().today().within(10).value(new Date('2023-07-24')),
            'value': rewrite.date()
              .lt(new Date('2023-07-25'))
              .lte(new Date('2023-07-25'))
              .gt(new Date('2023-07-23'))
              .gte(new Date('2023-07-23'))
              .value(new Date('2023-07-24')),
          }))
          .expect({
            now: new Date('2023-07-24'),
            value: new Date('2023-07-24'),
          });
      });

      it('should skip rewriting strings that aren\'t dates', async () => {
        await request(app)
          .get('/string/static')
          .expect(200)
          .expect(rewrite({ 'value': rewrite.date() }))
          .expect({ value: 'some static string' });
      });

      it('should rewriting numbers', async () => {
        await request(app)
          .get('/number/static')
          .expect(200)
          .expect(rewrite({ 'value': rewrite.date() }))
          .expect({ value: ':date:' });
      });

      it('should rewriting booleans', async () => {
        await request(app)
          .get('/boolean/static')
          .expect(200)
          .expect(rewrite({ 'value': rewrite.date() }))
          .expect({ value: ':date:' });
      });
    });
  });

  describe('examples', () => {
    const UUID_V4_REGEX = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;

    describe('jsonapi', () => {
      const app = createApp(router => {
        router.get('/things', (req, res) => {
          const [id1, id2] = [
            crypto.randomUUID(),
            crypto.randomUUID(),
          ];

          res.status(200).json({
            data: [
              {
                type: 'things',
                id: id1,
                attributes: { key: 'value' },
                links: { self: `/things/${id1}/` },
                meta: { createdAt: new Date('2023-07-23T19:01:00.000Z') },
              },
              {
                type: 'things',
                id: id2,
                attributes: { key: 'value' },
                links: { self: `/things/${id2}/` },
                meta: { createdAt: new Date('2023-07-23T19:02:00.000Z') },
              },
            ],
          });
        });

        router.post('/things', (req, res) => {
          const id = crypto.randomUUID();

          res.status(201).json({
            data: {
              type: 'things',
              id,
              attributes: { key: 'value' },
              links: { self: `/things/${id}/` },
              meta: { createdAt: new Date() },
            },
          });
        });

        router.get('/things/:id', (req, res) => {
          const { id } = req.params;

          res.status(200).json({
            data: {
              type: 'things',
              id,
              attributes: { key: 'value' },
              links: { self: `/things/${id}/` },
              meta: { createdAt: new Date('2023-07-23T21:00:00.000Z') },
            },
          });
        });
      });

      it('should handle a request to GET /things', async () => {
        await request(app)
          .get('/things')
          .expect(200)
          .expect(rewrite({
            'data.*.id': rewrite.string().matches(UUID_V4_REGEX).value(':thingId'),
            'data.*.links.self': rewrite.string().matches('/things/*-*-*-*/').value('/things/:thingId/'),
            'data.*.meta.createdAt': rewrite.date(),
          }))
          .expect({
            data: [
              {
                type: 'things',
                id: ':thingId',
                attributes: { key: 'value' },
                links: { self: '/things/:thingId/' },
                meta: { createdAt: ':date:' },
              },
              {
                type: 'things',
                id: ':thingId',
                attributes: { key: 'value' },
                links: { self: '/things/:thingId/' },
                meta: { createdAt: ':date:' },
              },
            ],
          });
      });

      it('should handle a request to POST /things', async () => {
        await request(app)
          .post('/things')
          .expect(201)
          .expect(rewrite({
            'data.id': rewrite.string().validate(value => validator.isUUID(value, 4)).value(':thingId'),
            'data.links.self': rewrite.string().matches('/things/*-*-*-*/').value('/things/:thingId/'),
            'data.meta.createdAt': rewrite.date().within(10),
          }))
          .expect({
            data: {
              type: 'things',
              id: ':thingId',
              attributes: { key: 'value' },
              links: { self: '/things/:thingId/' },
              meta: { createdAt: ':date:' },
            },
          });
      });

      it('should handle a request to GET /things/:thingId', async () => {
        await request(app)
          .get('/things/5d5bcc00-6c81-4467-a974-9561646b44e5')
          .expect(200)
          .expect(rewrite({
            'data.attributes.key': rewrite.string().value('value2'),
          }))
          .expect({
            data: {
              type: 'things',
              id: '5d5bcc00-6c81-4467-a974-9561646b44e5',
              attributes: { key: 'value2' },
              links: { self: '/things/5d5bcc00-6c81-4467-a974-9561646b44e5/' },
              meta: { createdAt: '2023-07-23T21:00:00.000Z' },
            },
          });
      });
    });

    describe('homebrew', () => {
      const app = createApp(router => {
        router.get('/things', (req, res) => {
          const [id1, id2] = [
            crypto.randomUUID(),
            crypto.randomUUID(),
          ];

          res.status(200).json([
            {
              type: 'things',
              id: id1,
              attributes: { key: 'value' },
              links: { self: `/things/${id1}/` },
              meta: { createdAt: new Date('2023-07-23T19:01:00.000Z') },
            },
            {
              type: 'things',
              id: id2,
              attributes: { key: 'value' },
              links: { self: `/things/${id2}/` },
              meta: { createdAt: new Date('2023-07-23T19:02:00.000Z') },
            },
          ]);
        });

        router.post('/things', (req, res) => {
          const id = crypto.randomUUID();

          res.status(201).json({
            type: 'things',
            id,
            attributes: { key: 'value' },
            links: { self: `/things/${id}/` },
            meta: { createdAt: new Date() },
          });
        });

        router.get('/things/:id', (req, res) => {
          const { id } = req.params;

          res.status(200).json({
            type: 'things',
            id,
            attributes: { key: 'value' },
            links: { self: `/things/${id}/` },
            meta: { createdAt: new Date('2023-07-23T21:00:00.000Z') },
          });
        });
      });

      it('should handle a request to GET /things', async () => {
        await request(app)
          .get('/things')
          .expect(200)
          .expect(rewrite({
            '*.id': rewrite.string().matches(UUID_V4_REGEX).value(':thingId'),
            '*.links.self': rewrite.string().matches('/things/*-*-*-*/').value('/things/:thingId/'),
            '*.meta.createdAt': rewrite.date(),
          }))
          .expect([
            {
              type: 'things',
              id: ':thingId',
              attributes: { key: 'value' },
              links: { self: '/things/:thingId/' },
              meta: { createdAt: ':date:' },
            },
            {
              type: 'things',
              id: ':thingId',
              attributes: { key: 'value' },
              links: { self: '/things/:thingId/' },
              meta: { createdAt: ':date:' },
            },
          ]);
      });

      it('should handle a request to POST /things', async () => {
        await request(app)
          .post('/things')
          .expect(201)
          .expect(rewrite({
            'id': rewrite.string().matches(UUID_V4_REGEX).value(':thingId'),
            'links.self': rewrite.string().matches('/things/*-*-*-*/').value('/things/:thingId/'),
            'meta.createdAt': rewrite.date().within(10),
          }))
          .expect({
            type: 'things',
            id: ':thingId',
            attributes: { key: 'value' },
            links: { self: '/things/:thingId/' },
            meta: { createdAt: ':date:' },
          });
      });

      it('should handle a request to GET /things/:thingId', async () => {
        await request(app)
          .get('/things/5d5bcc00-6c81-4467-a974-9561646b44e5')
          .expect(200)
          .expect(rewrite({
            'attributes.key': rewrite.string().value('value2'),
          }))
          .expect({
            type: 'things',
            id: '5d5bcc00-6c81-4467-a974-9561646b44e5',
            attributes: { key: 'value2' },
            links: { self: '/things/5d5bcc00-6c81-4467-a974-9561646b44e5/' },
            meta: { createdAt: '2023-07-23T21:00:00.000Z' },
          });
      });
    });
  });

});
