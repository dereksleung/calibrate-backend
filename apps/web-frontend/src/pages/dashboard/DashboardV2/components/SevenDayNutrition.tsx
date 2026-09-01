import type { SevenDayNutritionRowModel } from "#/verticals/dashboard/dashboard-v2-model.ts";

import { Flame } from "lucide-react";
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";

const ROW_COLORS = {
  calories: "var(--color-calories-stone)",
  proteinGrams: "var(--color-protein-vibrant-rose)",
  totalFatGrams: "var(--color-fats-vibrant-violet)",
  totalCarbohydrateGrams: "var(--color-carbs-vibrant-azure)",
} as const;

type SevenDayNutritionProps = {
  rows: SevenDayNutritionRowModel[];
};

type SevenDayNutritionRowProps = {
  row: SevenDayNutritionRowModel;
  showDayLabels: boolean;
};

function formatAmount(amount: number) {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
}

function SevenDaySummaryStat({ row }: { row: SevenDayNutritionRowModel }) {
  const daysWithData = row.days.filter(({ hasData }) => hasData ?? true);
  const amount =
    daysWithData.length === 0
      ? 0
      : daysWithData.reduce((total, day) => total + day.amount, 0) / daysWithData.length;
  const color = ROW_COLORS[row.metric];

  return (
    <div className="flex min-w-0 flex-col justify-center">
      <div className="flex items-center gap-1">
        <span
          className="font-heading text-xl font-semibold leading-none tracking-[-0.035em]"
          style={{ color }}
        >
          {formatAmount(amount)}
          {row.metric === "proteinGrams"
            ? " P"
            : row.metric === "totalFatGrams"
              ? " F"
              : row.metric === "totalCarbohydrateGrams"
                ? " C"
                : ""}
        </span>
        {row.metric === "calories" ? (
          <Flame aria-label="Calories" className="size-4 text-on-surface-variant" />
        ) : null}
      </div>
      <span className="mt-1 text-xs text-on-surface-variant">of {formatAmount(row.target)}</span>
    </div>
  );
}

function DayLabels({ row }: { row: SevenDayNutritionRowModel }) {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-7 pt-1 text-center text-xs font-semibold leading-3 text-on-surface-variant"
    >
      {row.days.map(({ date, label }) => (
        <span key={date}>{label}</span>
      ))}
    </div>
  );
}

function SevenDayBarChart({ row, showDayLabels }: SevenDayNutritionRowProps) {
  const color = ROW_COLORS[row.metric];
  const domainMaximum = Math.max(row.target, ...row.days.map(({ amount }) => amount)) * 1.15;

  return (
    <div className="relative h-12 min-w-0 sm:h-20">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={row.days} margin={{ bottom: 0, left: 0, right: 0, top: 0 }}>
          <XAxis
            dataKey="label"
            axisLine={false}
            className={showDayLabels ? undefined : "hidden"}
            hide
            interval={0}
            tick={{ fill: "var(--color-on-surface-variant)", fontSize: 12, fontWeight: 600 }}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis domain={[0, domainMaximum]} hide />
          <ReferenceLine
            stroke={color}
            strokeDasharray="3 3"
            strokeOpacity={0.32}
            strokeWidth={1}
            y={row.target}
          />
          <Bar
            background={{ fill: "rgba(26, 28, 28, 0.055)", radius: 7 }}
            barSize={12}
            dataKey="amount"
            fill={color}
            radius={[7, 7, 7, 7]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Row({ row, showDayLabels }: SevenDayNutritionRowProps) {
  return (
    <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-2 border-b border-black/[0.06] py-2 first:pt-0 last:pb-0 last:border-b-0">
      <SevenDaySummaryStat row={row} />
      <SevenDayBarChart row={row} showDayLabels={showDayLabels} />
      {showDayLabels ? (
        <>
          <span aria-hidden="true" />
          <DayLabels row={row} />
        </>
      ) : null}
    </div>
  );
}

function SevenDayNutrition({ rows }: SevenDayNutritionProps) {
  const activeDayIndex = Math.max((rows[0]?.days.length ?? 1) - 1, 0);

  return (
    <section aria-label="Seven-day nutrition overview" className="glass-card rounded-xl p-3">
      <div aria-hidden="true" className="relative isolate">
        <div className="pointer-events-none absolute inset-y-0 left-[calc(4.75rem+0.5rem)] right-0 z-0 grid grid-cols-7">
          <span
            className="rounded-xl border border-black/[0.04] bg-white/65 shadow-[0_2px_5px_rgba(27,38,29,0.06)]"
            style={{ gridColumnStart: activeDayIndex + 1 }}
          />
        </div>

        <div className="relative z-10">
          {rows.map((row, index) => (
            <Row key={row.metric} row={row} showDayLabels={index === rows.length - 1} />
          ))}
        </div>
      </div>
      <div className="sr-only">
        <table>
          <caption>Seven-day nutrition summary</caption>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              {rows[0]?.days.map(({ date, label }) => (
                <th key={date} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.metric}>
                <th scope="row">{row.title}</th>
                {row.days.map(({ amount, date }) => (
                  <td key={date}>
                    {formatAmount(amount)} {row.unit}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

SevenDayNutrition.Row = Row;

export { SevenDayBarChart, SevenDayNutrition, SevenDaySummaryStat };
