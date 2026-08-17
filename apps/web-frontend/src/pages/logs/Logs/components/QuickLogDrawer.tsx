import { Button } from "#/shared/components/base/Button.tsx";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "#/shared/components/base/drawer.tsx";
import { Plus, Scale, Search } from "lucide-react";

type QuickLogDrawerProps = {
  onSearchFood: () => void;
};

export function QuickLogDrawer({ onSearchFood }: QuickLogDrawerProps) {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button
          size="icon-lg"
          aria-label="Open quick log actions"
          className="fixed bottom-24 right-6 z-40 size-16 rounded-full bg-primary text-on-primary shadow-[0_18px_35px_-16px_rgba(26,28,28,0.55)] hover:bg-primary-container md:bottom-10 md:right-10"
        >
          <Plus aria-hidden className="size-9" strokeWidth={1.5} />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="mx-auto max-w-xl rounded-t-[2rem] border-outline-variant bg-surface-container-lowest">
        <DrawerHeader className="px-8 pb-2 pt-6 text-left">
          <DrawerTitle>Quick log</DrawerTitle>
          <DrawerDescription>Choose what you want to add to this day.</DrawerDescription>
        </DrawerHeader>
        <div className="grid gap-3 px-8 pb-8 pt-3">
          <Button
            variant="ghost"
            className="h-14 justify-start gap-3 rounded-xl text-base"
            onClick={onSearchFood}
          >
            <Search aria-hidden className="size-5 text-primary" />
            Search food
          </Button>
          <Button variant="ghost" className="h-14 justify-start gap-3 rounded-xl text-base">
            <Scale aria-hidden className="size-5 text-primary" />
            Log weight
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
