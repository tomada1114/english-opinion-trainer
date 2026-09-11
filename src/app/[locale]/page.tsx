import { hasLocale, useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { use, type ReactElement } from "react";

import { LOCALES } from "../../i18n/locales";

/**
 * The one page this application ships, translated.
 *
 * @remarks
 * No locale switcher: the app is English-only for now (see
 * `building-the-drill`'s Localization section), and `LOCALES` names one
 * locale. The `/[locale]/` tree and the typed catalogs stay so a future
 * locale can be added by reverting that decision rather than rebuilding it.
 */
export default function HomePage({
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

  const t = useTranslations("HomePage");

  return (
    <main>
      <h1>{t("title")}</h1>
      <p>{t("intro")}</p>
    </main>
  );
}
