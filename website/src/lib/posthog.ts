/**
 * Single owner of the PostHog client.
 *
 * src/theme/Root.tsx calls initPostHog() with the key from siteConfig; anything
 * else that needs the client subscribes via onPostHogReady(). The indirection
 * exists because React runs child effects before parent effects — a component
 * further down the tree cannot assume Root has started the load yet, and
 * posthog-js does not reliably publish itself on `window` when imported as an
 * ES module rather than through the CDN snippet.
 */

// Type-only, so this does not pull posthog-js into the main bundle.
export type PostHogClient = (typeof import('posthog-js'))['default'];

// PostHog Cloud EU (Frankfurt), not US Cloud: visitor data never leaves the
// EU, so GDPR is satisfied by a processor agreement rather than a transfer
// mechanism, and IP capture is off by default. The region is fixed when the
// PostHog project is created — changing it later means a data migration.
const POSTHOG_HOST = 'https://eu.i.posthog.com';

let client: PostHogClient | undefined;
let clientPromise: Promise<PostHogClient> | undefined;
const waiters = new Set<(client: PostHogClient) => void>();

/**
 * Load and initialise posthog-js. Idempotent — repeated calls return the same
 * in-flight promise, so a remount can never re-init the SDK.
 */
export function initPostHog(apiKey: string): Promise<PostHogClient> {
  if (!clientPromise) {
    clientPromise = import(/* webpackChunkName: 'posthog' */ 'posthog-js').then(
      ({ default: posthog }) => {
        posthog.init(apiKey, {
          api_host: POSTHOG_HOST,
          // Opts into the current default set. The one that matters here:
          // `capture_pageview` becomes 'history_change', so Docusaurus's
          // client-side route changes are captured off the History API and no
          // manual onRouteUpdate hook is needed.
          defaults: '2026-06-25',
          // ePrivacy 5(3) requires prior consent to store anything on the
          // visitor's device, and analytics does not qualify as "strictly
          // necessary". 'on_reject' holds all capture until the banner is
          // answered: accept → cookies + full analytics; decline → a
          // server-side daily hash that touches no device storage.
          //
          // This REQUIRES "Cookieless server hash mode" to be enabled under
          // Project settings → Web analytics. Without it PostHog silently
          // drops every event from visitors who declined.
          cookieless_mode: 'on_reject',
          // xl3.io has no login, so nobody is ever identified. Without this
          // every anonymous docs reader would burn a person profile against
          // the plan quota for no analytical gain.
          person_profiles: 'identified_only',
          // Neither can run cookielessly, and neither is worth the extra
          // weight on the consent notice for a documentation site.
          disable_session_recording: true,
          disable_surveys: true,
          // Off by default in posthog-js. Turning it on makes a browser-level
          // Do Not Track signal resolve as a decline, so those visitors go
          // straight to the cookieless path without being asked.
          respect_dnt: true,
        });
        client = posthog;
        waiters.forEach((notify) => notify(posthog));
        waiters.clear();
        return posthog;
      },
    );
  }
  return clientPromise;
}

/**
 * Run `callback` once the client is live. Fires synchronously if it already is.
 * Returns an unsubscribe function for effect cleanup.
 */
export function onPostHogReady(callback: (client: PostHogClient) => void): () => void {
  if (client) {
    callback(client);
    return () => {};
  }
  waiters.add(callback);
  return () => {
    waiters.delete(callback);
  };
}

export type ConsentStatus = 'granted' | 'denied' | 'pending';

// posthog-js has no change event for consent, so the banner and the privacy
// page would otherwise hold independent stale copies of it — declining in the
// banner would leave the privacy page still offering to withdraw. Every
// mutation goes through the helpers below, which notify both.
const consentListeners = new Set<() => void>();

export function subscribeConsent(listener: () => void): () => void {
  consentListeners.add(listener);
  return () => {
    consentListeners.delete(listener);
  };
}

/** Null until the SDK has loaded, or forever when no API key is configured. */
export function getConsentStatus(): ConsentStatus | null {
  return client ? client.get_explicit_consent_status() : null;
}

function mutateConsent(mutate: (client: PostHogClient) => void): void {
  if (!client) {
    return;
  }
  mutate(client);
  consentListeners.forEach((listener) => listener());
}

export function acceptConsent(): void {
  mutateConsent((c) => c.opt_in_capturing());
}

export function declineConsent(): void {
  // Not "stop measuring" — with cookieless_mode: 'on_reject' this moves
  // PostHog onto the path that writes nothing to the device.
  mutateConsent((c) => c.opt_out_capturing());
}

export function resetConsent(): void {
  mutateConsent((c) => c.clear_opt_in_out_capturing());
}
