import { test as base, expect } from '@playwright/test';

/**
 * Saving a Link verifies its Destination with a real HEAD request, and a
 * request that hangs past its timeout asks the user to confirm, which
 * Playwright dismisses. The specs' made-up Destinations are mostly registered
 * domains whose addresses accept no connection, so left alone, whether a spec
 * passed depended on what happened to sit at those names. Every off-origin HEAD
 * is answered here instead, on the context so pages a spec opens itself are
 * covered too; other requests go out as normal.
 */
export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    const appOrigin = new URL(baseURL).origin;
    await context.route(
      url => url.origin !== appOrigin,
      route => (route.request().method() === 'HEAD'
        ? route.fulfill({ status: 200 })
        : route.fallback()),
    );
    await use(context);
  },
});

export { expect };
