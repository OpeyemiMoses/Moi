'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function ScrollRevealProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    // If client prefers reduced motion, immediately reveal everything
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      document
        .querySelectorAll('.reveal-on-scroll, .reveal-pop, .reveal-pop-subtle, [data-reveal]')
        .forEach((el) => el.classList.add('is-revealed'));
      return;
    }

    const observerCallback: IntersectionObserverCallback = (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          // Once revealed, keep it visible
          obs.unobserve(entry.target);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, {
      rootMargin: '0px 0px -30px 0px',
      threshold: 0.05,
    });

    const observeElements = () => {
      const elements = document.querySelectorAll(
        '.reveal-on-scroll:not(.is-revealed), .reveal-pop:not(.is-revealed), .reveal-pop-subtle:not(.is-revealed), [data-reveal]:not(.is-revealed)'
      );
      elements.forEach((el) => {
        observer.observe(el);
      });
    };

    // Initial observation
    observeElements();

    // Secondary scan to catch any lazily rendered items
    const timer = setTimeout(observeElements, 250);
    const secondaryTimer = setTimeout(observeElements, 800);

    // Watch for DOM mutations (e.g., tab switches, dynamic card lists)
    const mutationObserver = new MutationObserver(() => {
      observeElements();
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      clearTimeout(timer);
      clearTimeout(secondaryTimer);
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [pathname]);

  return <>{children}</>;
}

