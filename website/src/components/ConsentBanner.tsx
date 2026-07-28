import React from 'react';
import Link from '@docusaurus/Link';
import Translate, { translate } from '@docusaurus/Translate';
import { acceptConsent, declineConsent } from '@site/src/lib/posthog';
import useConsentStatus from '@site/src/lib/useConsent';
import styles from './ConsentBanner.module.css';

/**
 * Cookie consent notice for the PostHog integration.
 *
 * Only shown while consent is 'pending' — a returning visitor who already
 * chose is not asked again, and withdrawing on /privacy puts the status back
 * to 'pending' so this reappears without a reload.
 *
 * Declining is not "stop measuring": `cookieless_mode: 'on_reject'` (see
 * src/lib/posthog.ts) switches PostHog to a server-side hash that writes
 * nothing to the device, which needs no consent under ePrivacy. The copy says
 * so rather than implying an opt-out.
 */
export default function ConsentBanner(): React.ReactNode {
  const status = useConsentStatus();

  if (status !== 'pending') {
    return null;
  }

  return (
    <div
      className={styles.banner}
      role="dialog"
      aria-label={translate({
        id: 'consent.ariaLabel',
        message: 'Cookie consent',
        description: 'Accessible name for the cookie consent dialog',
      })}
    >
      <div className={styles.inner}>
        <p className={styles.text}>
          <Translate id="consent.body" description="Body text of the cookie consent banner">
            {
              'xl3.io measures which documentation pages get read. Accept to allow analytics cookies. Decline and measurement continues without identifying your device.'
            }
          </Translate>{' '}
          <Link to="/privacy" className={styles.link}>
            <Translate
              id="consent.privacyLink"
              description="Link from the consent banner to the privacy page"
            >
              Details
            </Translate>
          </Link>
        </p>
        <div className={styles.actions}>
          {/* Decline is listed first and styled at the same weight as accept:
              ePrivacy guidance requires refusing to be as easy as consenting. */}
          <button type="button" className={styles.decline} onClick={declineConsent}>
            <Translate id="consent.decline" description="Consent banner decline button">
              Decline
            </Translate>
          </button>
          <button type="button" className={styles.accept} onClick={acceptConsent}>
            <Translate id="consent.accept" description="Consent banner accept button">
              Accept
            </Translate>
          </button>
        </div>
      </div>
    </div>
  );
}
