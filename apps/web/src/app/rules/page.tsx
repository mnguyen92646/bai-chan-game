"use client";
import Link from "next/link";
import { RulesGuide } from "@/components/RulesGuide";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/lib/useLanguage";
export default function RulesPage() {
  const { t } = useLanguage();
  return <main className="rules-page"><header><Link className="back-link" href="/">{t("← Home")}</Link><LanguageToggle /></header><h1>{t("How to play")}</h1><p><a href="/hoi-luat-chan.txt" download>{t("Download family rules questions (Vietnamese)")}</a></p><RulesGuide /></main>;
}
