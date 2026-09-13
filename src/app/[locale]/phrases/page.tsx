import { hasLocale, useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { use, type ReactElement } from "react";

import { LOCALES } from "../../../i18n/locales";
import { PhraseList } from "./_client/phrase-list";

/** The saved phrases page, with locale validation kept on the server. */
export default function PhrasesPage({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>): ReactElement {
  const { locale } = use(params);
  if (!hasLocale(LOCALES, locale)) {
    notFound();
  }
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- required by next-intl's legacy static-rendering API
  setRequestLocale(locale);

  const t = useTranslations("Phrases");

  return (
    <main>
      <h1>{t("title")}</h1>
      <PhraseList />
    </main>
  );
}
