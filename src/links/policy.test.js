import { describe, it, expect } from 'vitest';
import { createPolicy } from './index.js';

describe('a Policy with no Rules', () => {
  it('applies the workspace space character when normalising', () => {
    const policy = createPolicy({ spaceChar: 'hyphen' });

    expect(policy.normalize({ campaign: 'Summer Sale' })).toEqual({
      campaign: 'Summer-Sale',
    });
  });

  it('drops UTM fields a stored Link never set', () => {
    const policy = createPolicy({ spaceChar: 'hyphen' });

    expect(
      policy.normalize({ campaign: 'summer', term: null, content: undefined }),
    ).toEqual({ campaign: 'summer' });
  });

  it('lowercases every UTM value when the workspace says so', () => {
    const policy = createPolicy({ spaceChar: 'hyphen', forceLowercase: true });

    expect(policy.normalize({ campaign: 'Summer SALE', source: 'Facebook' })).toEqual({
      campaign: 'summer-sale',
      source: 'facebook',
    });
  });
});

/** A Rule config carrying only the settings a test cares about. */
function rule(config, id = 1) {
  return { id, name: `Rule ${id}`, config };
}

describe('a Rule', () => {
  it('lowercases only the fields it names', () => {
    const policy = createPolicy({ spaceChar: 'hyphen' }, [
      rule({ campaign: { forceLowercase: true } }),
    ]);

    expect(policy.normalize({ campaign: 'Summer SALE', source: 'Facebook' })).toEqual({
      campaign: 'summer-sale',
      source: 'Facebook',
    });
  });
});

describe('validating a Link Intent', () => {
  it('reports a Violation when a required field is empty', () => {
    const policy = createPolicy({}, [rule({ campaign: { required: true } })]);

    expect(policy.validate({ utm: { campaign: '' } })).toEqual([
      { field: 'campaign', message: 'Campaign is required.' },
    ]);
  });

  it('raises no Violation when a required field is filled', () => {
    const policy = createPolicy({}, [rule({ campaign: { required: true } })]);

    expect(policy.validate({ utm: { campaign: 'summer' } })).toEqual([]);
  });

  it('reports a Violation when a blocked field carries a value', () => {
    const policy = createPolicy({}, [rule({ term: { blocked: true } })]);

    expect(policy.validate({ utm: { term: 'shoes' } })).toEqual([
      { field: 'term', message: 'Term may not be used.' },
    ]);
  });

  it('lets blocked win over required when two Rules disagree', () => {
    const policy = createPolicy({}, [
      rule({ campaign: { required: true } }, 1),
      rule({ campaign: { blocked: true } }, 2),
    ]);

    expect(policy.validate({ utm: { campaign: '' } })).toEqual([]);
    expect(policy.validate({ utm: { campaign: 'summer' } })).toEqual([
      { field: 'campaign', message: 'Campaign may not be used.' },
    ]);
  });

  it('reports a Violation when a value is longer than its maximum', () => {
    const policy = createPolicy({}, [rule({ campaign: { maxChars: '6' } })]);

    expect(policy.validate({ utm: { campaign: 'summer-sale' } })).toEqual([
      { field: 'campaign', message: 'Campaign must be 6 characters or fewer.' },
    ]);
  });

  it('takes the smallest maximum any Rule sets', () => {
    const policy = createPolicy({}, [
      rule({ campaign: { maxChars: '20' } }, 1),
      rule({ campaign: { maxChars: '6' } }, 2),
    ]);

    expect(policy.validate({ utm: { campaign: 'summer7' } })).toEqual([
      { field: 'campaign', message: 'Campaign must be 6 characters or fewer.' },
    ]);
  });

  it('ignores a maximum left blank on the Rules page', () => {
    const policy = createPolicy({}, [rule({ campaign: { maxChars: '' } })]);

    expect(policy.validate({ utm: { campaign: 'a'.repeat(200) } })).toEqual([]);
  });

  it('reports a Violation for a prohibited value, whatever its case', () => {
    const policy = createPolicy({}, [
      rule({ source: { prohibitedValues: 'facebook, twitter' } }),
    ]);

    expect(policy.validate({ utm: { source: 'Facebook' } })).toEqual([
      { field: 'source', message: 'Source may not be "Facebook".' },
    ]);
    expect(policy.validate({ utm: { source: 'linkedin' } })).toEqual([]);
  });

  it('unions the prohibited values of every Rule', () => {
    const policy = createPolicy({}, [
      rule({ source: { prohibitedValues: 'facebook' } }, 1),
      rule({ source: { prohibitedValues: 'twitter' } }, 2),
    ]);

    expect(policy.validate({ utm: { source: 'twitter' } })).toHaveLength(1);
    expect(policy.validate({ utm: { source: 'facebook' } })).toHaveLength(1);
  });

  it('reports a Violation for a character the workspace prohibits', () => {
    const policy = createPolicy({ prohibitedChars: '!, ?' });

    expect(policy.validate({ utm: { campaign: 'summer!' } })).toEqual([
      { field: 'campaign', message: 'Campaign may not contain "!".' },
    ]);
    expect(policy.validate({ utm: { campaign: 'summer' } })).toEqual([]);
  });

  it('never prohibits the space character it inserts itself', () => {
    const policy = createPolicy({ spaceChar: 'plus', prohibitedChars: '+, !' });

    // 'summer+sale' is what normalising made of 'summer sale'.
    expect(policy.validate({ utm: { campaign: 'summer+sale' } })).toEqual([]);
    expect(policy.validate({ utm: { campaign: 'summer!' } })).toHaveLength(1);
  });

  it('reports one Violation per offending field', () => {
    const policy = createPolicy({}, [
      rule({ campaign: { required: true }, source: { required: true } }),
    ]);

    expect(policy.validate({ utm: {} })).toEqual([
      { field: 'campaign', message: 'Campaign is required.' },
      { field: 'source', message: 'Source is required.' },
    ]);
  });
});
