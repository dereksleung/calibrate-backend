import { Card } from "#/shared/components/base/Card.tsx";
import { Typography } from "#/shared/components/base/typography/Typography.tsx";
import { ChartColumnIncreasing } from "lucide-react";

/* TODO: Make text dynamic.
  Just showing judgment presenting the most important metrics and data for a normal user trying to stay on track 
  with new habits and weight loss for now. */
export const ConsistencyScore = () => {
  return (
    <Card className="p-4 lg:p-8 gap-4">
      <div className="flex gap-3 text-primary">
        <ChartColumnIncreasing className="mt-1" />
        <Typography as="h2" variant="cardTitle" color="primary">
          Consistency Score
        </Typography>
      </div>
      <div className="flex items-end gap-2">
        <Typography as="span" variant="display" color="primary">
          94%
        </Typography>
      </div>
      <Typography as="p" color="onSurfaceVariant" size="sm" weight="light">
        You stayed inside your calorie limit 94% of the last 30 days. Great job!
      </Typography>
    </Card>
  );
};
