export function resolveRequestedPrimaryViewFromUrl(input?: string | URL | Location | null): string | null {
  if (!input) {
    return null;
  }

  let url: URL;
  if (typeof input === 'string') {
    url = new URL(input, 'http://127.0.0.1');
  } else if (input instanceof URL) {
    url = input;
  } else {
    url = new URL(input.href);
  }

  const pathname = url.pathname.trim().toLowerCase();
  if (pathname === '/chat') {
    return 'chat';
  }
  return null;
}

export function resolveInitialPrimaryView(input: {
  persistedPrimaryView?: string | null;
  fallbackPrimaryView: string;
  availablePrimaryViews: string[];
  location?: string | URL | Location | null;
}): string {
  const requestedPrimaryView = resolveRequestedPrimaryViewFromUrl(input.location);
  if (requestedPrimaryView && input.availablePrimaryViews.includes(requestedPrimaryView)) {
    return requestedPrimaryView;
  }

  const normalizedPersistedPrimaryView =
    typeof input.persistedPrimaryView === 'string' && input.persistedPrimaryView.trim()
      ? input.persistedPrimaryView.trim()
      : null;
  if (normalizedPersistedPrimaryView && input.availablePrimaryViews.includes(normalizedPersistedPrimaryView)) {
    return normalizedPersistedPrimaryView;
  }

  return input.fallbackPrimaryView;
}
