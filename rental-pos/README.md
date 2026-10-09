# Rental POS (Next.js)

Hardware rental billing system: items with number + photo, customer ID (front + back photo),
bills with discount, a "Return Items" tab (find the customer by NIC and close the bill),
cash / bank / card payments with change, a dashboard with charts and stock, return alerts and
WhatsApp messages. English / සිංහල, light / dark mode, works on phones.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

For real use on the shop computer:

```bash
npm run build
npm start
```

## Put it online (GitHub + Netlify + Supabase)

The app works in two modes: with no settings it stores everything in `data/` on your computer;
when the Supabase settings below are present it stores everything in Supabase (database + photos).

**1. Supabase (database + photo storage)**
1. supabase.com -> New project (pick a region near Sri Lanka, e.g. Singapore). Save the database password.
2. *SQL Editor -> New query* -> paste the whole of `supabase/schema.sql` -> **Run**. (Creates the data table and a private `uploads` bucket.)
3. *Project Settings -> API*: copy the **Project URL** and the **service_role** key (secret - never put it in the code or share it).

**2. GitHub**
1. Create a new **private** repository on github.com (it will hold customer-related code only, but keep it private anyway).
2. Unzip this project, then in that folder:
   ```bash
   git init
   git add .
   git commit -m "Rental POS"
   git branch -M main
   git remote add origin https://github.com/<your-name>/<repo>.git
   git push -u origin main
   ```
   (`.gitignore` already keeps `data/`, `node_modules/` and `.env*` out of GitHub.)

**3. Netlify**
1. app.netlify.com -> *Add new site -> Import an existing project -> GitHub* -> pick the repo. Build settings are read from `netlify.toml`.
2. *Site configuration -> Environment variables* - add:
   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | the Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role key |
   | `APP_PASSWORD` | a strong password of your choice |
3. *Deploys -> Trigger deploy*. Open the site: the browser asks for a password (any user name, the password = `APP_PASSWORD`).

Every `git push` to `main` redeploys automatically.

**Important**
- The site refuses to open if Supabase is connected but `APP_PASSWORD` is missing - customer NIC / ID photos must never be public.
- Photos are stored in a *private* bucket and are only served through the password-protected app.
- If two people save at the same moment, the second one sees "Someone else saved a change a moment ago. Please try again." - just repeat the action.
- Optional: to move the data you already entered locally, run
  `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-to-supabase.mjs` in the project folder (needs Node 18+).
- Supabase free projects pause after about a week without use; opening the dashboard in Supabase wakes it up.

## Where data is stored

- `data/db.json`  - items, bills, payments, settings (`db.json.bak` = copy of the previous save)
- `data/uploads/` - customer ID photos and item photos

Back up the whole `data/` folder regularly. When you replace the project with a newer
zip, keep your old `data/` folder (old bills and items are upgraded automatically).

## How a rental works

1. **Items** - give every item a *number* (the number written on the tool, e.g. `M-001`; it must be
   different for each item), a category, a rate per day, an optional **half-day rate** (lower than the day rate, for up to 12 hours), the stock quantity and a photo.
   Several pieces with different numbers: add each piece as its own item with stock 1, or one item
   with stock 3 and a number like `M-001 to M-003`.
2. **New Bill** - pick items (search by name or number), customer (find a returning customer by
   NIC / phone / name and everything incl. the ID photos is filled in), upload ID front + back,
   choose date & time, number of days, optional discount, advance payment (and how it was paid).
   The total shown is an *estimate*.
3. **Return Items tab** - when the customer brings the items back, type the NIC number, press
   *Return / Close*. (The same button is on the Dashboard, Bill History and the bill.)
   The app works out the time really used (days + hours), then you can:
   - choose to charge the **actual time used** or the **booked days**
   - give a **discount** at this point
   - add an **extra charge** (damage, cleaning)
   - pick the **payment method** (cash, bank transfer, card, online)
   - enter the **amount received** - if the customer hands over more (e.g. 5,000 for a 2,000 bill)
     the app shows the **change to give back**; only the real bill amount is counted as income
   Anything not paid stays as an *unpaid balance* (shown on the Dashboard; use *Record payment* on
   the bill when the customer pays later).
4. **WhatsApp** buttons open `wa.me/<number>` with the message already written - you press Send.
   Messages: bill (when created), reminder (active rental), final bill (after closing: time used,
   charges, discount, payment method, received, change, unpaid). They follow the language you
   selected in the app.

### Charging rules (Settings page)

- *Exact days + hours*: 2 days 5 hours is charged as 2 days + 5 hours (pro-rata per hour).
- *Round up to full days*: 2 days 5 hours is charged as 3 days.
- *Grace minutes*: a short delay that is not charged (default 15 min).
- A rental is always charged for at least 1 day - except for items that have a **half-day rate**:
  - In *New Bill* choose **Rental period -> Half day (12 hrs)**; the bill is charged at the half-day rate.
  - When closing with *actual time used*, anything returned within 12 hours (+ grace minutes) is charged
    at the half-day rate; after that the normal day rate applies.
  - Items without a half-day rate keep the minimum of 1 day. In a bill with mixed items, each item
    uses its own rate.

## Dashboard

- Live **Sri Lanka** date and time (whatever time zone the phone / PC is set to). The page
  refreshes itself every minute and when you come back to the tab; after midnight (Sri Lanka)
  "today" starts again from zero and the 7-day chart moves on by itself.
- Income received today / this month (split by cash, bank, card), active, overdue, due soon, unpaid.
- Charts: income of the last 7 days, **most rented items** (7 days / 30 days / all time).
- **Stock overview**: for every item the total, how many are out on rent, how many are left,
  and a status (OK / running low / out of stock); a "low / out only" filter and a list of the items
  that are running low.

## Pages

| Page | Purpose |
| --- | --- |
| `/` | Dashboard |
| `/billing` | New bill |
| `/returns` | Return Items: find the rental by NIC / phone / name / bill no and close it |
| `/bills` | Bill history: search, filter, WhatsApp, return/close, edit, delete, re-open |
| `/bills/[id]` | Bill / final bill: print, WhatsApp, payments, ID photos |
| `/bills/[id]/edit` | Edit a bill (a closed bill: customer details, photos, notes only) |
| `/items` | Items: number, photo, category, day rate, half-day rate, stock |
| `/settings` | Shop name, phone, charging rules |

## Notes

- Stock cannot be lowered below what is rented out; deleting a bill or an item also deletes its
  photos (unless another bill / item uses the same file).
- Locally data is a JSON file; online (Netlify) it is Supabase - see the section above. Do not host the
  local-file mode on Netlify/Vercel (temporary disk).
- Login is a single shop password (`APP_PASSWORD`), not per-user accounts.
