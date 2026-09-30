import { describe as _describe, it as _it, beforeEach as _beforeEach, test as _test, afterEach as _afterEach, before as _beforeAll, after as _afterAll } from 'node:test';
import assert from 'node:assert';

export const describe = _describe;
export const it = _it;
export const test = _test;
export const beforeEach = _beforeEach;
export const afterEach = _afterEach;
export const beforeAll = _beforeAll;
export const afterAll = _afterAll;

export function expect(actual: any) {
  const base = {
    toBe(expected: any) { assert.strictEqual(actual, expected); },
    toEqual(expected: any) { assert.deepStrictEqual(actual, expected); },
    toBeGreaterThanOrEqual(expected: any) { assert.ok(actual >= expected); },
    toBeGreaterThan(expected: any) { assert.ok(actual > expected); },
    toMatch(regex: RegExp) { assert.match(String(actual), regex); },
    toContain(expected: any) { assert.ok(actual?.includes ? actual.includes(expected) : false); },
    toBeTruthy() { assert.ok(actual); },
    toBeFalsy() { assert.ok(!actual); },
    toBeDefined() { assert.ok(actual !== undefined); },
    toBeNull() { assert.strictEqual(actual, null); },
    toHaveLength(len: number) { assert.strictEqual(actual?.length, len); },
    toThrow(msg?: string | RegExp) { 
      if (typeof actual !== 'function') throw new Error('expect().toThrow requires a function');
      assert.throws(actual, msg as any);
    },
    rejects: {
      async toThrow(msg?: string | RegExp) {
        if (msg instanceof RegExp) {
          await assert.rejects(async () => await actual, msg);
        } else {
          await assert.rejects(async () => await actual, msg ? new Error(msg) : undefined);
        }
      }
    },
    resolves: {
      async toBe(expected: any) {
        assert.strictEqual(await actual, expected);
      },
      async toEqual(expected: any) {
        assert.deepStrictEqual(await actual, expected);
      }
    }
  };

  const not = {
    toBe(expected: any) { assert.notStrictEqual(actual, expected); },
    toEqual(expected: any) { assert.notDeepStrictEqual(actual, expected); },
    toBeNull() { assert.notStrictEqual(actual, null); },
    toBeTruthy() { assert.ok(!actual); },
    toBeFalsy() { assert.ok(actual); },
    toBeDefined() { assert.ok(actual === undefined); },
    toContain(expected: any) { assert.ok(actual?.includes ? !actual.includes(expected) : true); },
    toThrow(msg?: string | RegExp) {
      if (typeof actual !== 'function') throw new Error('expect().not.toThrow requires a function');
      assert.doesNotThrow(actual, msg as any);
    }
  };

  return { ...base, not };
}
