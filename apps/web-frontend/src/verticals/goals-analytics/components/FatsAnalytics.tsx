import { cn } from "#/lib/utils.ts";
import { Card, CardContent } from "#/shared/components/base/Card.tsx";
import { Typography } from "#/shared/components/base/typography/Typography.tsx";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { useState } from "react";

const fatSources = [
  {
    amount: "200 g",
    imageAlt: "Tofu",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBH7QJ8mutlQ5egk_lviZTtpNw8u_9IaQUuhPzEvOwdojqJ8-dfYTMpBZUj9S9rjXboy4_69FBRoiMEYzXaK9NWCXKWRKph6M-8HRHA6know6KDZne3BB8fbYeOmbGBIw8YKBMsuRwyzZOnTQQXwuLgrGhTLwy4ZG1wvXxjXo18bhNARi7BmXjXaudh2nI8qV596yu5StwwSPrcKyUaV4ujgKgyZb3pGBYYYGN7CgQwR0m0OBWpu1davlKiR7dcbMbLuy6_nA0GDSE",
    name: "Tofu, Extra Firm (1/4 Block)",
    percent: 80,
  },
  {
    amount: "49 g",
    imageAlt: "Crackers",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCfQ2pqI4FvaPQoIZsQTqMpyMNA8DlFvUI8fshEhQ5gL3RFhBdbYJQ80ACsx1VIoLbUHyv4Ir7qXefPsWUoy2UtLBUo7_6dxz6YoZBuvwt39EfIGiwrLVJ2UlMLb4EeZLrakKgQJA3R-JL8ybgbEJMgbQVT9sKEBShAPIZqGX6GsaC1pFjcDTASBdSf2Gt1ZK-Yq5yudVpNU54-WmjOBV46U-PMT5ywxYqxKtPvRhY7b81bviRGWMS9lbevf64WzUwg8vsGQ0X6Pkk",
    name: "Black Grains Thin Cracker Che...",
    percent: 25,
  },
  {
    amount: "41 g",
    imageAlt: "Oat milk",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBjQ8daKr6veLuvKNwVNlphSxtm5POfFbarYOFMWW8wsHr22fXSB1QKewo-kRhificTgQiE0FJU9ZgEAlclQ0evcsVqXTmekXbIQwv1_IvRlP1NR3e3TzOgqr-viu42DkosX9iM_RnozcI6GRqCmQklW2Fl5j1Vv6ey55H2ICC7tZKAEQNo5GWR9smQK_BN5dX2lrSkjbGJpaiJ8XlIt2TMFBq_rbV7ylpU3iALjxv1ItpqWKuaV89daR9owdyErfIpiiwrZrdjUJE",
    name: "Oat Milk",
    percent: 20,
  },
  {
    amount: "34 g",
    imageAlt: "Sprouted rolled oats",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCVcLznPVQlujYMLs3_98C6v_xdIF7KFQ8KCo5UU1JNNaq9jh54cwYek_PP8HINswB2uGwJVGTGC-fgj7VNs2WDi1AQMyYZZLm5IB7mDoXqoXgtK2iovdAWm25WqGnw4bnwAx8w5ATGrU0hDSSAN0R77AcDM6lU8gu-9c_4NLuCpzzEc1vFLQ4_wdi-4MoO2Uy5LhIXT0iAiarM3bk0UqaVhADDITw9-mPeAeR1mRrAuI-E7RyoPzguAQlwGD5NZLTSRH1eoike5KE",
    name: "Sprouted Rolled Oats",
    percent: 17,
  },
  {
    amount: "27 g",
    imageAlt: "Organic oats",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCEuCn8WwkvFsp6y6Tn_bhaymk9AWfwMivE9Vvt42eBuSBPZMaKea8q9AkbsAlDgUf2RnxgP_VRvTFi4afT89osbCfz2uGqIsIBw46vU3UvrpI70bv2vXb3bIDXugGLyzxiiIZVsOEa3Dwq-RP7hFeWUPz0PTJlxyrpOnV1e8U-f8zwFDJhrhO5C1Dg39bBjHY9erWSDh0r4BiLDCUk4Ab3tzBN8-lZlAY6hHU5ZK3I2t1ctJ1ypgeR6nq1IYmSqODMkkgDSb0zK6U",
    name: "Oats, Organic",
    percent: 14,
  },
  {
    amount: "21 g",
    imageAlt: "Almond snack",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBD49BxM60HwkF8KGfEL6SzuKkIefUFBPvNTok8w9e1fIEhGWpTHSk1t-3mYUbJBgzdKs1X6QOcv6k2OEVG7TqnNxDVZa21SA5GvslE-szeCaH37PW1BLsBM1iGAXvxGWVTpA4Ffs0i3gZe_lwPnxrrio3HwfoRwxvRfTcYNhIvfBTXZ_F79nEVaqthWXlA4TH3lBKhD0FmKASnhx3u5CwInK_05p6l-LsGJdeK7eFPb3mbhWu-m3LQEz1vszwjAmcj_t_bpdiLgZQ",
    name: "Cranberry Almond ThinAddict...",
    percent: 10,
  },
] as const;

const fatTrendSources = [
  {
    change: "500%",
    imageAlt: "Cranberry Almond Thin",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCyr7w194ireVt_a2SopECkhBA3ZBepDW10yHYSwZDAj51kiwXlNcAVKwL0S3JQazK2kfPv6cQowcaM_L_9351Hy60otlm5TMcbLmSyuvQG6019F7-su-8EanoWbFCkbQll4kjaqwFi57PlWzXunkvVWlIbaYzF6NCg0wOFKj_uiOI9fznSecN0hBjfAHwwKCw-ee-xLKlFHyhid6JHS0olhWq2x4c2jr4e83CmRi7YCbzogBtvUIAbQH7a7JpKcZmF9_7frL3r6Ag",
    name: "Cranberry Almond Thin",
  },
  {
    change: "312%",
    imageAlt: "Oat Milk",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAQ5nDjKdDk-KOhGgmirVL5UNXZrmqtMMlhMb90QycF-cpiGcjC4oYef95gcEinmvw8ddvJYBZ8XawY8m07F20c8jEE6a4rlPUHniGByCPGSu56s0TG2cvT8mZYz-JesZF0-C4EOPxdZI-ANe3jSzLcB9ywUgELIco9mu8Sdnw5PEib5iKYaLrJWzW1JysjK3B9TYpEM2pWFF4mjZWgpB2QbHOdQnhQ5UjKLozg3hHGFL-qu94qoGG5Fjc6cno5tlQVATGoSSZ0BVc",
    name: "Oat Milk",
  },
  {
    change: "50%",
    imageAlt: "Black Sesame Cookies",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBVbTQ4HkXJwd-N_jjCRlcjIIRSkozBE8nu0MqQnq6Jv6Bh8kgb6lblmRQt8feS0F0cDTfBxWWHJxcizc6u6uncxNw9C7E9BC2ZfuMWwEnQ-9k1jdaNp-V3uX5jid2Y002CHoWpQUDyoDOEAGxA3j1Fs7xZVhHG9dS9cVOcmXFNlxiA6aKEq33jYlgRIjit-DWLJwqVI9beVcBzQE9G-3Sn0bJZs5nO37x-k69bWPG8n83yxKR-g_NMzJwIGfW0pbOQCFTfwnuQdMo",
    name: "Black Sesame Cookies",
  },
  {
    change: "50%",
    imageAlt: "Oats, Organic",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBX_AhsbK50tLy1CJmEUtFWjsUkEPrtnKxHii0TqreIhX7ogSc7nu_Z2xjGzkZAUwQm66T4qsqtvzHhxneskfUfIr2OjDduEIC5_x23aK-0zATuuKDUq3pTOXX9myY1WG9ojVBfFjYL30YST9tSdZa1A1eVXDKXtKfV0wXEzxVDb6H8qSLcFVLoaRF0ZzDhgpPvwvFUpZAI3jU5gqVS2jeeKiIeVweHtzpi5wKe2AaM_-9Abn57ixvKCN-IutvtdvYnlOeTkEkkmVo",
    name: "Oats, Organic",
  },
] as const;

type FatAnalyticsTab = "total" | "trend";

export function FatsAnalytics() {
  const [activeTab, setActiveTab] = useState<FatAnalyticsTab>("total");

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-surface-container-low">
      <div className="flex shrink-0 flex-col gap-6 px-5 pb-4 pt-6">
        <Card className="rounded-3xl border-white/70 bg-white/80 py-0 shadow-[0_20px_40px_-28px_rgba(0,0,0,0.5)]">
          <CardContent className="grid grid-cols-2 gap-4 px-5 py-5 sm:gap-6 sm:px-6 sm:py-6">
            <div className="flex min-w-0 flex-col gap-2">
              <Typography
                as="p"
                variant="label"
                color="muted"
                className="tracking-[0.06em] sm:tracking-[0.08em]"
              >
                Since Apr 5
              </Typography>
              <div className="flex items-baseline gap-1">
                <Typography
                  as="span"
                  variant="display"
                  color="default"
                  className="leading-none tracking-normal"
                >
                  563
                </Typography>
                <Typography as="span" variant="bodyLg" color="muted">
                  g
                </Typography>
              </div>
            </div>

            <div className="flex min-w-0 flex-col items-end gap-2 text-right">
              <Typography
                as="p"
                variant="label"
                color="muted"
                className="tracking-[0.06em] sm:tracking-[0.08em]"
              >
                Versus Prev 28 Days
              </Typography>
              <div className="flex items-center justify-end gap-2 text-primary">
                <Typography
                  as="span"
                  variant="display"
                  color="default"
                  className="leading-none tracking-normal"
                >
                  27%
                </Typography>
                <ArrowDown aria-hidden="true" className="size-8 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-full bg-surface-container-high p-1">
          <div className="grid grid-cols-2">
            <button
              type="button"
              aria-pressed={activeTab === "total"}
              className={cn(
                "rounded-full px-6 py-3 text-on-surface-variant focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                activeTab === "total" && "bg-white text-primary shadow-[0_12px_24px_-20px_rgba(0,0,0,0.65)]",
              )}
              onClick={() => setActiveTab("total")}
            >
              <Typography
                as="span"
                variant="bodyLg"
                color={activeTab === "total" ? "primary" : "onSurfaceVariant"}
                weight={activeTab === "total" ? "medium" : "normal"}
              >
                Total
              </Typography>
            </button>
            <button
              type="button"
              aria-pressed={activeTab === "trend"}
              className={cn(
                "rounded-full px-6 py-3 text-on-surface-variant focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                activeTab === "trend" && "bg-white text-primary shadow-[0_12px_24px_-20px_rgba(0,0,0,0.65)]",
              )}
              onClick={() => setActiveTab("trend")}
            >
              <Typography
                as="span"
                variant="bodyLg"
                color={activeTab === "trend" ? "primary" : "onSurfaceVariant"}
                weight={activeTab === "trend" ? "medium" : "normal"}
              >
                Change
              </Typography>
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-2">
        {activeTab === "total" ? (
          <section className="flex flex-col gap-4">
            <Typography as="h2" variant="label" color="muted" className="text-center tracking-[0.18em]">
              Total Fat By Food For Last 28 Days
            </Typography>

            <Card className="rounded-3xl border-white/70 bg-white/80 py-0 shadow-[0_24px_52px_-34px_rgba(0,0,0,0.55)]">
              <CardContent className="flex flex-col gap-7 px-5 py-6">
                {fatSources.map((source) => (
                  <div key={source.name} className="flex flex-col gap-3">
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                      <div className="size-12 overflow-hidden rounded-xl bg-surface-container-low">
                        <img alt={source.imageAlt} className="size-full object-cover" src={source.imageUrl} />
                      </div>
                      <Typography as="p" variant="bodyLg" color="default" className="truncate">
                        {source.name}
                      </Typography>
                      <Typography
                        as="p"
                        variant="bodyLg"
                        color="default"
                        weight="medium"
                        className="whitespace-nowrap"
                      >
                        {source.amount}
                      </Typography>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-container-low">
                      <div
                        className="h-full rounded-full bg-primary-fixed-dim"
                        style={{ width: `${source.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        ) : (
          <section className="flex flex-col gap-4">
            <Typography as="h2" variant="label" color="muted" className="text-center tracking-[0.18em]">
              Fats by food from last month to this month
            </Typography>

            <div className="flex flex-col gap-4">
              {fatTrendSources.map((source) => (
                <Card
                  key={source.name}
                  className="rounded-3xl border-white/70 bg-white/80 py-0 shadow-[0_20px_40px_-30px_rgba(0,0,0,0.55)]"
                >
                  <CardContent className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 py-4">
                    <div className="size-12 overflow-hidden rounded-xl bg-surface-container-low ring-1 ring-outline-variant/40">
                      <img alt={source.imageAlt} className="size-full object-cover" src={source.imageUrl} />
                    </div>
                    <Typography as="p" variant="body" color="default" className="truncate">
                      {source.name}
                    </Typography>
                    <div className="flex items-center justify-end gap-2 text-primary">
                      <ArrowUpRight aria-hidden="true" className="size-4" />
                      <Typography as="p" variant="bodyLg" color="primary" className="whitespace-nowrap">
                        {source.change}
                      </Typography>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
