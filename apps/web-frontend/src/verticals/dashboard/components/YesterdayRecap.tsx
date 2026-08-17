import { Card } from "#/shared/components/base/Card.tsx";
import { Typography } from "#/shared/components/base/typography/Typography.tsx";
import { History } from "lucide-react";

export const YesterdayRecap = () => {
  return (
    <Card className="p-4 lg:p-8 gap-4">
      <div className="flex gap-3 text-primary">
        <History className="text-primary mt-1" />
        <Typography as="h2" variant="cardTitle" color="primary">
          Yesterday Recap
        </Typography>
        {/* <h3 className="font-semibold text-lg">Yesterday Recap</h3> */}
      </div>
      {/* TODO: Make text dynamic.
      Just showing judgment presenting the most important metrics and data for a normal user trying to stay on track 
      with new habits and weight loss for now. */}
      <Typography size="sm" weight="light" color="onSurfaceVariant">
        You stayed 150 cal under budget!
      </Typography>
    </Card>
  );
};
