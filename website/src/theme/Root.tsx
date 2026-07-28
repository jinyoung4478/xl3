import React, { useEffect, type ReactNode } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import ConsentBanner from '@site/src/components/ConsentBanner';
import { initPostHog } from '@site/src/lib/posthog';

export default function Root({ children }: { children: ReactNode }): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  const apiKey = siteConfig.customFields?.posthogApiKey as string | undefined;

  useEffect(() => {
    // Unset on local builds and on forks — which is exactly what keeps their
    // pageviews out of the production project.
    if (apiKey) {
      void initPostHog(apiKey);
    }
  }, [apiKey]);

  // Renders nothing until the SDK is live and consent is actually 'pending'.
  return (
    <>
      {children}
      <ConsentBanner />
    </>
  );
}
