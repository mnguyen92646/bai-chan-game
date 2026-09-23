"use client";
import { useLanguage } from "@/lib/useLanguage";

/** Keep the document language in React's tree, with the same initial locale as SSR. */
export function LanguageDocument({ children, className }: { children: React.ReactNode; className: string }) {
  const { locale } = useLanguage();
  return <html lang={locale}><body className={className}>{children}</body></html>;
}
