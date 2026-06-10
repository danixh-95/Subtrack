# SubTrack 💳 – Subscription Tracker Dashboard

SubTrack is a premium, modern, and beautiful subscription tracking web application. Built with Vanilla JS, modern CSS, and Supabase, it allows users to create accounts, manage their subscription expenses, define monthly budgets, visualize insights via interactive charts, and keep track of payment renewals on a dynamic calendar.

🔗 **Live Demo**: [subtrack-keep.vercel.app](https://subtrack-keep.vercel.app/)

![SubTrack Dashboard](https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&h=600&q=80) *(Placeholder image representing modern UI dashboards)*

---

## ✨ Features

- **🔒 Secure Authentication**: Multi-user registration, login, and password resets powered by Supabase Auth.
- **📊 Real-time Dashboard Metrics**: Tracks monthly SaaS/streaming expenses, active subscriptions splits (monthly/yearly), highest premium services, and upcoming bills.
- **📈 Visual Analytics & Insights**: Interactive visualizations using Chart.js:
  - **Budget Comparison**: A line chart comparing cumulative monthly outflow against your budget limit.
  - **Category Distribution**: A doughnut chart illustrating the cost share per category.
  - **Cash Flow Projections**: A bar chart mapping out expense timelines over the calendar months.
- **📅 Interactive Renewal Calendar**: Rendered calendar with colored badges mapping out payment renewal dates. Clicking a badge lets you edit details on the fly.
- **🔔 Smart Notifications & Budget Guard**: Receives alerts when approaching or breaching budget caps, or when bills are due today/tomorrow.
- **⚙️ Advanced Settings**:
  - Light/Dark mode toggling.
  - Custom budget setting.
  - Pre-populated premium demo data seeding.
  - Account profile edit (name, email, avatar URL).
  - Data backup configurations (Export as CSV or JSON).
  - Complete application cache wipe.

---

## 🛠️ Tech Stack

- **Core**: Vanilla HTML5, Vanilla JavaScript (ES Modules), Custom CSS3 variables & animations
- **Backend & DB**: Supabase (PostgreSQL, Realtime, Row-Level Security)
- **Charts Engine**: Chart.js (via CDN)
- **Icons**: FontAwesome v6 (via CDN)
- **Dev Tooling**: Vite (for fast local dev server & production bundling)

---

## 🗄️ Database Setup (Supabase)

SubTrack uses three PostgreSQL tables under the `public` schema. Row Level Security (RLS) is enabled on all tables with policies restricting reads & writes to `auth.uid() = user_id`.

### 1. `public.subscriptions`
Stores subscription metadata.
```sql
create table public.subscriptions (
  id text primary key,
  user_id uuid references auth.users not null,
  name text not null,
  price numeric(10,2) not null,
  billing_cycle text not null, -- 'monthly' or 'yearly'
  start_date date not null,
  renewal_date date not null,
  category text not null,
  color text not null,
  icon_class text not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.subscriptions enable row level security;
create policy "Allow CRUD for owners" on public.subscriptions
  for all using (auth.uid() = user_id);
```

### 2. `public.user_settings`
Stores user-specific limits and preferences.
```sql
create table public.user_settings (
  user_id uuid primary key references auth.users,
  budget_limit numeric(10,2) default 50000.00 not null,
  theme text default 'dark' not null,
  notifications jsonb default '[]'::jsonb not null
);

alter table public.user_settings enable row level security;
create policy "Allow CRUD for owners" on public.user_settings
  for all using (auth.uid() = user_id);
```

### 3. `public.profiles`
Stores display names and avatar links.
```sql
create table public.profiles (
  user_id uuid primary key references auth.users,
  name text not null,
  email text not null,
  avatar text
);

alter table public.profiles enable row level security;
create policy "Allow CRUD for owners" on public.profiles
  for all using (auth.uid() = user_id);
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js & npm installed on your machine.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/subtrack.git
   cd subtrack
   ```

2. **Install the dependencies**:
   ```bash
   npm install
   ```

3. **Start the local development server**:
   ```bash
   npm run dev
   ```

4. **Open the App**:
   Visit [subtrack-keep.vercel.app](https://subtrack-keep.vercel.app/) in your browser. Since you are not logged in, you will be redirected to the secure login page (`auth.html`).

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
