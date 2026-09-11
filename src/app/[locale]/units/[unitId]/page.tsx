import { hasLocale, useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { use, type ReactElement } from "react";

import { getTopicsForUnit } from "../../../../core/content/index";
import { parseUnitId, UNIT_IDS } from "../../../../core/drill";
import { LOCALES } from "../../../../i18n/locales";
import { UnitDrill } from "./_client/unit-drill";

interface UnitPageParams {
  readonly locale: string;
  readonly unitId: string;
}

/** Prerender every unit; any other segment still reaches the page and 404s. */
export function generateStaticParams(): { unitId: string }[] {
  return UNIT_IDS.map((unit) => ({ unitId: String(unit) }));
}

export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<UnitPageParams> }>): Promise<Metadata> {
  const { locale, unitId } = await params;
  const unit = parseUnitId(unitId);
  if (!hasLocale(LOCALES, locale) || unit === undefined) {
    notFound();
  }

  // The locale layout's canonical names `/${locale}`; without this, every unit
  // page would declare itself a duplicate of the home page.
  return { alternates: { canonical: `/${locale}/units/${String(unit)}` } };
}

/**
 * The drill for one unit.
 *
 * @remarks
 * A Server Component: it validates the segments and hands the unit's topics to
 * the client leaf, which owns everything interactive. An unknown locale or
 * unit is the same 404 — there is no separate "unit not found" page.
 */
export default function UnitPage({
  params,
}: Readonly<{ params: Promise<UnitPageParams> }>): ReactElement {
  const { locale, unitId } = use(params);
  if (!hasLocale(LOCALES, locale)) {
    notFound();
  }
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- required by next-intl's legacy static-rendering API
  setRequestLocale(locale);

  const unit = parseUnitId(unitId);
  if (unit === undefined) {
    notFound();
  }

  const t = useTranslations("Drill");

  return (
    <main>
      <h1>{t("title", { unit })}</h1>
      <UnitDrill unit={unit} topics={getTopicsForUnit(unit)} />
    </main>
  );
}
