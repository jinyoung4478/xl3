import { useEffect, useState } from 'react';
import {
  getConsentStatus,
  onPostHogReady,
  subscribeConsent,
  type ConsentStatus,
} from './posthog';

/**
 * Current consent status, kept in sync across every component that reads it.
 *
 * Returns `null` while the SDK is still loading, and permanently on builds
 * with no API key — callers should render nothing in that case.
 */
export default function useConsentStatus(): ConsentStatus | null {
  // Always null on the first render so the server and client markup agree;
  // the effects below fill it in after hydration.
  const [status, setStatus] = useState<ConsentStatus | null>(null);

  useEffect(() => onPostHogReady(() => setStatus(getConsentStatus())), []);
  useEffect(() => subscribeConsent(() => setStatus(getConsentStatus())), []);

  return status;
}
