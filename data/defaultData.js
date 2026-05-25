export const defaultSubscriptions = [
  {
    id: "netflix-id",
    name: "Netflix",
    price: 15.49,
    billingCycle: "monthly",
    startDate: "2024-01-15",
    renewalDate: "2026-05-26", // Expiring in 3 days
    category: "Entertainment",
    notes: "Standard HD Plan. Shared with family.",
    iconClass: "fa-solid fa-play",
    color: "#E50914"
  },
  {
    id: "spotify-id",
    name: "Spotify Premium",
    price: 10.99,
    billingCycle: "monthly",
    startDate: "2023-06-10",
    renewalDate: "2026-05-28", // Expiring in 5 days
    category: "Music",
    notes: "Duo plan for offline music and podcasts.",
    iconClass: "fa-solid fa-music",
    color: "#1DB954"
  },
  {
    id: "chatgpt-id",
    name: "ChatGPT Plus",
    price: 20.00,
    billingCycle: "monthly",
    startDate: "2024-03-01",
    renewalDate: "2026-06-15",
    category: "SaaS",
    notes: "AI coding and writing assistance.",
    iconClass: "fa-solid fa-robot",
    color: "#10A37F"
  },
  {
    id: "adobe-id",
    name: "Adobe Creative Cloud",
    price: 54.99,
    billingCycle: "monthly",
    startDate: "2023-11-20",
    renewalDate: "2026-05-24", // Expiring tomorrow!
    category: "Work",
    notes: "Creative suite for video and graphics design.",
    iconClass: "fa-solid fa-palette",
    color: "#FF0000"
  },
  {
    id: "youtube-id",
    name: "YouTube Premium",
    price: 13.99,
    billingCycle: "monthly",
    startDate: "2024-02-14",
    renewalDate: "2026-05-30", // Expiring in 7 days
    category: "Entertainment",
    notes: "No ads and background play on mobile.",
    iconClass: "fa-solid fa-video",
    color: "#FF0000"
  },
  {
    id: "aws-id",
    name: "Amazon Web Services",
    price: 45.00,
    billingCycle: "monthly",
    startDate: "2024-05-01",
    renewalDate: "2026-06-02",
    category: "SaaS",
    notes: "Hosting for portfolio applications.",
    iconClass: "fa-brands fa-aws",
    color: "#FF9900"
  },
  {
    id: "copilot-id",
    name: "GitHub Copilot",
    price: 10.00,
    billingCycle: "monthly",
    startDate: "2024-04-10",
    renewalDate: "2026-06-10",
    category: "SaaS",
    notes: "Autocompletion for IDE development.",
    iconClass: "fa-brands fa-github",
    color: "#24292F"
  },
  {
    id: "ms365-id",
    name: "Microsoft 365",
    price: 99.99,
    billingCycle: "yearly",
    startDate: "2023-11-12",
    renewalDate: "2026-11-12",
    category: "Work",
    notes: "Yearly license for Office apps and 1TB OneDrive.",
    iconClass: "fa-solid fa-windows",
    color: "#0078D4"
  }
];

export const defaultBudget = 200;
