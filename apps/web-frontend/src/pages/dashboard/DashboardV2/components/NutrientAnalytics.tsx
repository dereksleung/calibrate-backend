import type { ChangeEntry, NutrientAnalyticsModel } from "#/verticals/dashboard/dashboard-v2-model.ts";

import { Card, CardContent } from "#/shared/components/base/Card.tsx";
import { Typography } from "#/shared/components/base/typography/Typography.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/shared/components/tabs/Tabs.tsx";
import { ArrowDown, ArrowDownUp, ArrowUpRight, Info } from "lucide-react";
import { useState } from "react";

const CHANGE_SUBTITLE = "Compares the most recent two weeks with the two weeks before.";
const INSUFFICIENT_HISTORY_COPY =
  "More history is needed to compare changes. Foods logged in the last 7 days are shown as New.";

type NutrientAnalyticsTab = "change" | "total";

type NutrientAnalyticsProps = {
  defaultTab?: NutrientAnalyticsTab;
  model: NutrientAnalyticsModel;
};

function formatAmount(amount: number) {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
}

function formatAmountWithUnit(amount: number, unit: NutrientAnalyticsModel["unit"]) {
  return `${formatAmount(amount)} ${unit}`;
}

function formatShare(share: number) {
  return `${Math.round(share * 100)}%`;
}

function formatChange(change: Exclude<ChangeEntry["change"], "new">) {
  const percent = Math.round(change * 100);

  return `${percent > 0 ? "+" : ""}${percent}%`;
}

function maybeReverse<T>(items: readonly T[], reversed: boolean) {
  return reversed ? [...items].reverse() : items;
}

function NutrientAnalytics({ defaultTab = "total", model }: NutrientAnalyticsProps) {
  const [reversed, setReversed] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-surface-container-low">
      <Tabs className="flex min-h-0 flex-1 flex-col gap-0" defaultValue={defaultTab}>
        <div className="flex shrink-0 flex-col gap-6 px-5 pb-4 pt-6">
          <Card className="rounded-3xl border-white/70 bg-white/80 py-0 shadow-[0_20px_40px_-28px_rgba(0,0,0,0.5)]">
            <CardContent className="flex flex-col gap-2 px-5 py-5">
              <Typography as="p" color="muted" variant="label">
                Last 7 days
              </Typography>
              <Typography as="p" className="leading-none tracking-normal" variant="headline">
                {model.title}
              </Typography>
              <div className="flex items-baseline gap-1">
                <Typography as="span" className="leading-none tracking-normal" variant="display">
                  {formatAmount(model.total.amount)}
                </Typography>
                <Typography as="span" color="muted" variant="bodyLg">
                  {model.unit}
                </Typography>
              </div>
            </CardContent>
          </Card>

          <TabsList aria-label={`${model.title} analytics views`}>
            <TabsTrigger value="total">Total</TabsTrigger>
            <TabsTrigger value="change">Change</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-2" value="total">
          <TotalContributions model={model} />
        </TabsContent>

        <TabsContent className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-2" value="change">
          <ContributionChange
            model={model}
            onReverse={() => setReversed((current) => !current)}
            reversed={reversed}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TotalContributions({ model }: { model: NutrientAnalyticsModel }) {
  return (
    <section className="flex flex-col gap-4">
      <Typography as="h2" className="text-center tracking-[0.18em]" color="muted" variant="label">
        {`Total ${model.title} by food for last 7 days`}
      </Typography>

      <Card className="rounded-3xl border-white/70 bg-white/80 py-0 shadow-[0_24px_52px_-34px_rgba(0,0,0,0.55)]">
        <CardContent className="px-5 py-6">
          {model.total.contributions.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No food contributions in the last 7 days.</p>
          ) : (
            <ul className="flex flex-col gap-7">
              {model.total.contributions.map((contribution) => (
                <li className="flex flex-col gap-3" key={contribution.name}>
                  <div className="flex items-center justify-between gap-3">
                    <Typography as="p" className="truncate" variant="bodyLg">
                      {contribution.name}
                    </Typography>
                    <Typography as="p" className="whitespace-nowrap" variant="bodyLg" weight="medium">
                      {formatAmountWithUnit(contribution.amount, model.unit)}
                    </Typography>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-container-low">
                      <div
                        className="h-full rounded-full bg-primary-fixed-dim"
                        style={{ width: `${Math.min(contribution.share * 100, 100)}%` }}
                      />
                    </div>
                    <Typography as="p" className="w-10 shrink-0 text-right" color="muted" variant="body">
                      {formatShare(contribution.share)}
                    </Typography>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function ContributionChange({
  model,
  onReverse,
  reversed,
}: {
  model: NutrientAnalyticsModel;
  onReverse: () => void;
  reversed: boolean;
}) {
  const { increases, newFoods, reductions } = model.change.sections;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Typography as="h2" variant="cardTitle">
            Food contribution change
          </Typography>
          <Typography as="p" color="muted" variant="body">
            {CHANGE_SUBTITLE}
          </Typography>
        </div>
        <button
          aria-label="Reverse contribution change order"
          aria-pressed={reversed}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={onReverse}
          type="button"
        >
          <ArrowDownUp aria-hidden="true" className="size-5" />
        </button>
      </div>

      {model.change.showInsufficientHistoryBanner ? (
        <div
          className="flex items-start gap-2 rounded-xl border border-carbs-vibrant-azure/40 bg-carbs-vibrant-azure/15 px-4 py-3 text-sm text-on-surface"
          role="status"
        >
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-carbs-vibrant-azure" />
          <span>{INSUFFICIENT_HISTORY_COPY}</span>
        </div>
      ) : null}

      <ChangeSection
        emptyLabel="No reductions"
        rows={maybeReverse(reductions, reversed)}
        title="Reductions"
        unit={model.unit}
      />
      <ChangeSection
        emptyLabel="No increases"
        rows={maybeReverse(increases, reversed)}
        title="Increases"
        unit={model.unit}
      />
      <ChangeSection
        emptyLabel="No new foods"
        rows={maybeReverse(newFoods, reversed)}
        title="New Foods"
        unit={model.unit}
      />
    </section>
  );
}

function ChangeSection({
  emptyLabel,
  rows,
  title,
  unit,
}: {
  emptyLabel: string;
  rows: readonly ChangeEntry[];
  title: "Increases" | "New Foods" | "Reductions";
  unit: NutrientAnalyticsModel["unit"];
}) {
  const headingId = `${title.toLowerCase().replaceAll(" ", "-")}-heading`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <Typography as="h3" className="tracking-[0.12em]" color="muted" id={headingId} variant="label">
        {title}
      </Typography>
      {rows.length === 0 ? (
        <p className="text-sm text-on-surface-variant">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((entry) => (
            <li key={entry.name}>
              <Card className="rounded-3xl border-white/70 bg-white/80 py-0 shadow-[0_20px_40px_-30px_rgba(0,0,0,0.55)]">
                <CardContent className="flex items-center justify-between gap-4 px-4 py-4">
                  <Typography as="p" className="min-w-0 truncate" variant="body">
                    {entry.name}
                  </Typography>
                  <ChangeValue entry={entry} unit={unit} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ChangeValue({ entry, unit }: { entry: ChangeEntry; unit: NutrientAnalyticsModel["unit"] }) {
  if (entry.change === "new") {
    return (
      <div className="flex items-center gap-2">
        <Typography as="p" className="whitespace-nowrap" variant="body">
          {formatAmountWithUnit(entry.amount, unit)}
        </Typography>
        <span className="rounded-full border border-outline-variant px-2 py-0.5 text-xs font-medium text-on-surface">
          New
        </span>
      </div>
    );
  }

  const Icon = entry.change < 0 ? ArrowDown : ArrowUpRight;

  return (
    <div className="flex items-center gap-2 text-on-surface">
      <Icon aria-hidden="true" className="size-4" />
      <Typography as="p" className="whitespace-nowrap" variant="bodyLg">
        {formatChange(entry.change)}
      </Typography>
    </div>
  );
}

export { NutrientAnalytics };
export type { NutrientAnalyticsProps };
