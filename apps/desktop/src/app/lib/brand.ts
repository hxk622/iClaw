import { BRAND } from './brand.generated';

export { BRAND };

export function applyBrandTheme() {
  const root = document.documentElement;
  root.style.setProperty('--brand-primary-light', BRAND.theme.light.primary);
  root.style.setProperty('--brand-primary-light-hover', BRAND.theme.light.primaryHover);
  root.style.setProperty('--brand-on-primary-light', BRAND.theme.light.onPrimary);
  root.style.setProperty('--brand-primary-dark', BRAND.theme.dark.primary);
  root.style.setProperty('--brand-primary-dark-hover', BRAND.theme.dark.primaryHover);
  root.style.setProperty('--brand-on-primary-dark', BRAND.theme.dark.onPrimary);
}
