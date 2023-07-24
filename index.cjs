const _set = require('lodash.set');
const micromatch = require('micromatch');
const { flatten } = require('flat');

/**
 * @param {*} value
 * @param {Error} err
 * @throws {Error}
 * @returns {void}
 */
function assert(value, err) {
  /* istanbul ignore if */
  if (Boolean(value) === false) {
    throw err;
  }
}
/**
 * @param {*} input
 * @returns {boolean}
 */
function isPlainObject(input) {
  return Object.prototype.toString.call(input) === '[object Object]';
}

/**
 * @template T
 * @param {T} initialValue
 * @param {(T): boolean} initialValidator
 * @param {(any): T} [transformInput]
 * @param {(T): any} [transformOutput]
 * @returns {Object}
 */
function createRewriteValue(initialValue, initialValidator, transformInput = undefined) {
  assert(initialValue !== null && initialValue !== undefined, new TypeError('Expected initial value to be set'));
  assert(typeof initialValidator === 'function', new TypeError('Expected initial validator to be a function'));

  return Object.create({}, {
    returnValue: {
      enumerable: true,
      value: initialValue,
      writable: true,
    },
    validators: {
      enumerable: true,
      value: [['type', initialValidator]],
    },
    transformInput: {
      enumerable: true,
      value: typeof transformInput === 'function' ? transformInput : undefined,
      writable: true,
    },

    add: {
      enumerable: true,
      value: function (key, validator) {
        assert(typeof key === 'string', new TypeError('Expected first argument to be a function'));
        assert(typeof validator === 'function', new TypeError('Expected second argument to be a function'));

        Object.defineProperty(this, key, {
          enumerable: true,
          value: function (...args) {
            this.validators.push([key, validator, ...args]);
            return this;
          },
        });

        return this;
      },
    },
    // transform: {
    //   enumerable: true,
    //   value: function (transformInput) {
    //     assert(typeof transformInput === 'function', new TypeError('Expected argument to be a function'));
    //     this.transformInput = transformInput;
    //     return this;
    //   },
    // },
    validate: {
      enumerable: true,
      value: function (validator) {
        assert(typeof validator === 'function', new TypeError('Expected argument to be a function'));
        this.validators.push(['custom', validator]);
        return this;
      },
    },
    value: {
      enumerable: true,
      value: function (newValue) {
        assert(initialValidator(newValue), new TypeError('Expected argument to be a valid type'));
        this.returnValue = newValue;
        return this;
      },
    },
  });
}

/**
 * @param {Record<string, ReturnType<createRewriteValue>>} rewrite
 * @param {Object} [opts]
 * @param {boolean} [opts.log]
 * @returns {(res: import('supertest').Response): void}
 */
function rewriteBody(rewrite, opts = {}) {
  assert(isPlainObject(rewrite), new TypeError('Expected argument to be a plain object'));
  const { log } = {
    log: false,
    ...opts,
  }

  return function (res) {
    if (res.body && (isPlainObject(res.body) || Array.isArray(res.body))) {
      const flat = flatten(res.body);
      const flatKeys = Object.keys(flat);

      Object.entries(rewrite).forEach(([rewriteKey, rewrite]) => micromatch(flatKeys, rewriteKey).forEach(matchedKey => {
        const value = typeof rewrite.transformInput === 'function'
          ? rewrite.transformInput(flat[matchedKey])
          : flat[matchedKey];

        const isMatched = rewrite.validators.reduce((isMatch, [key, validate, ...args]) => {
          if (isMatch === true) {
            try {
              let result = validate(value, ...args);
              result = isMatch && (typeof result === 'boolean' ? result : false);
              /* istanbul ignore next */
              log && console.log('Validator %s on %s (%s) returned', key, rewriteKey, matchedKey, result);
              return result;
            } catch (err) /* istanbul ignore next */ {
              log && console.warn('Validator %s on %s (%s) threw', key, rewriteKey, matchedKey, err);
              return false;
            }
          } else {
            return isMatch;
          }
        }, true);

        if (isMatched) {
          /* istanbul ignore next */
          log && console.log('Setting %s to %s (%s)', rewriteKey, matchedKey, rewrite.returnValue);
          _set(res.body, matchedKey, rewrite.returnValue);
        }
      }));
    }
  };
}

rewriteBody.string = () => {
  const validator = createRewriteValue(':string:', value => typeof value === 'string');

  validator.add('lowercase', value => value.toLowerCase() === value);
  validator.add('uppercase', value => value.toUpperCase() === value);
  validator.add('email', value => value.includes('@'));
  validator.add('url', value => value.includes('http://') || value.includes('https://'));

  validator.add('matches', (value, match) => {
    assert(typeof match === 'string' || Array.isArray(match) || match instanceof RegExp,
      new TypeError('Expected matches argument to be a string, array of strings or RegExp'));
    return match instanceof RegExp ? match.test(value) : micromatch.isMatch(value, match);
  });

  validator.add('startsWith', (value, prefix) => {
    assert(typeof prefix === 'string', new TypeError('Expected startsWith argument to be a string'));
    return value.startsWith(prefix);
  });
  validator.add('endsWith', (value, suffix) => {
    assert(typeof suffix === 'string', new TypeError('Expected endsWith argument to be a string'));
    return value.endsWith(suffix);
  });

  validator.add('in', (value, values) => {
    assert(Array.isArray(values) || values instanceof Set,
      new TypeError('Expected in argument to be an array of strings or a set of strings'));
    return Array.isArray(values) ? values.includes(value) : values.has(value);
  });

  return validator;
};

rewriteBody.number = () => {
  const validator = createRewriteValue(':number:', value => typeof value === 'number')

  validator.add('positive', value => value >= 0);
  validator.add('negative', value => value <= 0);

  validator.add('lt', (value, lt) => {
    assert(typeof lt === 'number', new TypeError('Expected lt argument to be a number'));
    return value < lt;
  });
  validator.add('lte', (value, lte) => {
    assert(typeof lte === 'number', new TypeError('Expected lte argument to be a number'));
    return value <= lte;
  });
  validator.add('gt', (value, gt) => {
    assert(typeof gt === 'number', new TypeError('Expected gt argument to be a number'));
    return value > gt;
  });
  validator.add('gte', (value, gte) => {
    assert(typeof gte === 'number', new TypeError('Expected gte argument to be a number'));
    return value >= gte;
  });

  validator.add('in', (value, values) => {
    assert(Array.isArray(values) || values instanceof Set,
      new TypeError('Expected in argument to be an array of strings or a set of strings'));
    return Array.isArray(values) ? values.includes(value) : values.has(value);
  });

  return validator;
};

rewriteBody.boolean = () => createRewriteValue(':boolean:', value => typeof value === 'boolean');

rewriteBody.date = () => {
  const isDate = value => value instanceof Date && !isNaN(value.getTime());

  const validator = createRewriteValue(':date:', isDate, input => {
    const date = input instanceof Date ? input : new Date(input);
    return isDate(date) ? date : undefined;
  });

  validator.add('today', value => {
    const getDate = date => date.toISOString().split('T').shift();
    return getDate(new Date()) === getDate(value);
  });

  validator.add('lt', (value, lt) => {
    assert(isDate(lt), new TypeError('Expected lt argument to be a Date'));
    return value < lt;
  });
  validator.add('lte', (value, lte) => {
    assert(isDate(lte), new TypeError('Expected lte argument to be a Date'));
    return value <= lte;
  });
  validator.add('gt', (value, gt) => {
    assert(isDate(gt), new TypeError('Expected gt argument to be a Date'));
    return value > gt;
  });
  validator.add('gte', (value, gte) => {
    assert(isDate(gte), new TypeError('Expected gte argument to be a Date'));
    return value >= gte;
  });

  validator.add('within', (value, ms) => {
    assert(typeof ms === 'number', new TypeError('Expected within argument to be a number'));
    return value.getTime() > (Date.now() - ms);
  });

  return validator;
};

module.exports = rewriteBody;
