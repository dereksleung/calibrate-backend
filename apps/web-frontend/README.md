# Calibrate Web Frontend

This project is a calorie tracking app prototype for someone trying to lose weight to become more fit or build healthier habits. I happened to get into healthier eating, jogging, and calisthenics myself, so this domain holds interest for me.

The first goal right now is to demonstrate product judgment: take what could easily become dense, data-heavy areas in the Dashboard and Goals pages, and keep them simple enough to be useful. The target user is not an expert mathematician or nutrition analyst, rather they are people wanting to change themselves, who may need help building new habits, and need to understand what to do next, and what is working or not working. The most important product work is surfacing actions and actionable insights that help them keep momentum with new habits, while suggesting small tweaks they may not have realized they can do that will help them get results.

The current UI is built with mock data, most things are not actually functional, pages do not load live data yet. That is intentional. It lets the product direction, information hierarchy, and interaction patterns come first before backend contracts or analytics plumbing harden too early.

Charts and data stay at overview level by default. When a user chooses to drill deeper, the app should still be selective about what it shows. More data is only useful when it creates a clearer insight, a better decision, or a practical adjustment the user can actually make.

## Tech Stack Notes

TanStack Router was chosen because it gives the app fully-typed routing with room to grow into route loaders for high network performance for mobile users taking time of their busy day to jot down meal entries.

shadcn/ui is useful here for helping build battle-tested, accessible, polished UI quickly while still allowing keeping ownership over styling.

## Running Locally

Start the dev server:

```bash
npx nx run web:dev
```

The app runs at:

```text
http://localhost:3000
```

## Screenshots

### Dashboard page

Initial page:
<br></br>
<img width="1820" height="932" alt="Screenshot 2026-05-03 at 6 17 09 PM" src="https://github.com/user-attachments/assets/97d5fe74-0583-4620-bf64-446ff2f40127" />
<br></br>
On clicking the High Impact Swap card's Learn More link -> panel with actionable insights:
<br></br>
<img width="1829" height="930" alt="Screenshot 2026-05-03 at 6 17 44 PM" src="https://github.com/user-attachments/assets/ae5fc0c5-0525-4192-8d08-4e9c8576dc4c" />

<br></br>
Hovering over the Dashboard's Fats chart will show a tooltip saying you can click the chart to go to [a panel on the Goals page](#fats-analytics-panel), making that discoverable. Only the fats detail view mock UI is built right now.
<br></br>

### Goals page

Allows deeper drilling into stats and progress.

Initial view:
<br></br>
<img width="1242" height="949" alt="Screenshot 2026-05-03 at 6 18 50 PM" src="https://github.com/user-attachments/assets/1427dd89-c3a7-4362-8860-d784edea9306" />
<br></br>
Scrolling down - can see encouragement about journey, as well as charts about macros (fats only for now):
<br></br>
<img width="1232" height="950" alt="Screenshot 2026-05-03 at 6 19 11 PM" src="https://github.com/user-attachments/assets/2bb2a236-c1fe-41c8-be1b-c3bbad402cd0" />
<br></br>

#### Fats Analytics panel

Clicking the Fats bar chart opens a panel with deeper data the user can find trends with.
<br></br>
Greatest sources of fat by food in the last month:
<br></br>
<img width="1228" height="940" alt="Screenshot 2026-05-03 at 7 31 07 PM" src="https://github.com/user-attachments/assets/bf3d56cb-9d9b-485e-958a-30bfc1c6c6d8" />
<br></br>
Largest changes in fat contributions from food between last month to this month:
<br></br>
<img width="1264" height="959" alt="Screenshot 2026-05-24 at 2 17 08 PM" src="https://github.com/user-attachments/assets/6f09793e-acd6-49f2-a8d1-a18b118ee441" />
