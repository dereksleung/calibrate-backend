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
  activeDayIndex: number;
  row: SevenDayNutritionRowModel;
  showDayLabels: boolean;
};

function formatAmount(amount: number) {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
}

function SevenDaySummaryStat({ row }: { row: SevenDayNutritionRowModel }) {
  const amount = row.days.at(-1)?.amount ?? 0;
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

function SevenDayBarChart({ activeDayIndex, row, showDayLabels }: SevenDayNutritionRowProps) {
  const color = ROW_COLORS[row.metric];
  const domainMaximum = Math.max(row.target, ...row.days.map(({ amount }) => amount)) * 1.15;

  return (
    <div className={showDayLabels ? "relative h-24 min-w-0" : "relative h-20 min-w-0"}>
      <div
        aria-hidden="true"
        className={
          showDayLabels
            ? "absolute inset-x-0 top-0 bottom-5 grid grid-cols-7"
            : "absolute inset-0 grid grid-cols-7"
        }
      >
        <span
          className="rounded-xl border border-black/[0.04] bg-white/65 shadow-[0_2px_5px_rgba(27,38,29,0.06)]"
          style={{ gridColumnStart: activeDayIndex + 1 }}
        />
      </div>
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={row.days} margin={{ bottom: 0, left: 0, right: 0, top: 0 }}>
          <XAxis
            dataKey="label"
            axisLine={false}
            className={showDayLabels ? undefined : "hidden"}
            hide={!showDayLabels}
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

function Row({ activeDayIndex, row, showDayLabels }: SevenDayNutritionRowProps) {
  return (
    <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-2 border-b border-black/[0.06] py-2 last:border-b-0">
      <SevenDaySummaryStat row={row} />
      <SevenDayBarChart activeDayIndex={activeDayIndex} row={row} showDayLabels={showDayLabels} />
    </div>
  );
}

function SevenDayNutrition({ rows }: SevenDayNutritionProps) {
  const activeDayIndex = Math.max((rows[0]?.days.length ?? 1) - 1, 0);

  return (
    <section aria-label="Seven-day nutrition overview" className="glass-card rounded-xl p-3">
      <div aria-hidden="true">
        {rows.map((row, index) => (
          <Row
            activeDayIndex={activeDayIndex}
            key={row.metric}
            row={row}
            showDayLabels={index === rows.length - 1}
          />
        ))}
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
