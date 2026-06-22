# SubSqueeze — Shared Expense & Subscription Ledger

SubSqueeze is a household ledger web application designed for dormmates, apartment co-tenants, and student peer groups to split recurring subscription charges and general living expenses. It lets users track outstanding balances (who owes whom) and log settlements.

## Tech Stack
- **Framework**: Next.js 15 (App Router, TypeScript)
- **Styling**: Tailwind CSS v4
- **Primitives**: shadcn/ui (Base Nova style)
- **Backend / Database**: Supabase (Auth, Postgres, and Row Level Security)
- **Forms & Validation**: React Hook Form + Zod
- **Package Manager**: pnpm

---

## Local Setup Instructions

### 1. Prerequisites
Ensure you have the following installed locally:
- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Git

### 2. Install Dependencies
Run the following command in the project root:
```bash
pnpm install
```

> **Note**: This project has been configured with `ignore-scripts true` in the pnpm configuration to skip third-party build checks during installation.

### 3. Database Setup (Supabase)
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) and create a new project.
2. Open the **SQL Editor** in the Supabase Dashboard, create a **New Query**, paste the entire contents of the `supabase_schema.sql` file in this repository, and click **Run**.
3. Go to **Project Settings → API** and fetch your Project URL and Anon Public Key.
4. (Optional) Go to **Authentication → Settings** and toggle off **Confirm Email** so you can sign up test accounts immediately without email verification.

### 4. Configure Environment Variables
Copy `.env.local.example` to `.env.local`:
```bash
cp .env.local.example .env.local
```
Open `.env.local` and fill in your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Run the Development Server
Start the Next.js development server:
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Testing & QA Scenarios (Using Two Accounts)
To fully test the ledger flows:
1. Open a regular browser tab and go to `http://localhost:3000/signup`. Register a user named `UserA`.
2. Open an incognito browser window (or a different browser profile) and go to `/signup`. Register a user named `UserB`.
3. In `UserA`'s dashboard, click **Create Cohort** and name it "Apartment 101".
4. Copy the 8-character invite code shown in `UserA`'s cohort details page.
5. In `UserB`'s dashboard, click **Join Cohort**, enter the copied invite code, and confirm.
6. Under `UserA`'s view:
   - Click **Add Expense**.
   - Log an expense of `₱100.00` split **Equally** between both members.
   - You will see the balance card update to show `UserB owes UserA ₱50.00`.
7. Under `UserB`'s view:
   - Go to the cohort page.
   - You will see a repayment channel prompting: `You owe UserA ₱50.00`.
   - Click **Settle Up**, verify the suggested amount of `₱50.00`, review the immutability warning, and click **Confirm**.
   - Verify that the balances return to `₱0.00` immediately.
8. Verify **Settlement Immutability**:
   - Inspect the DOM or UI elements. There are **no Edit or Delete buttons** anywhere for settlement records, conforming to database triggers.
9. Verify **Cascade Deletes**:
   - `UserA` can delete their own expense. Verify that deleting the expense cascades and removes its liability fractions, while leaving settlements and unrelated expenses intact.
