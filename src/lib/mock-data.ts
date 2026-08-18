export type Role = "Owner" | "Admin" | "Member";
export type ProjectStatus = "active" | "on-hold" | "archived";

export interface Client {
  id: string;
  name: string;
  contact: string;
  billable: boolean;
  archived: boolean;
}

export interface Project {
  id: string;
  name: string;
  clientId: string;
  status: ProjectStatus;
  color: string;
  lastActivity: string; // ISO date
  memberIds: string[];
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "invited";
  initials: string;
}

export interface TimeEntry {
  id: string;
  date: string; // yyyy-mm-dd
  start: string; // HH:mm
  end: string; // HH:mm
  seconds: number;
  userId: string;
  projectId: string | null;
  task: string;
  description?: string | undefined;
  billable: boolean;
}

export type TrelloStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "syncing"
  | "synced"
  | "error"
  | "reconnect-required";

export interface TrelloState {
  status: TrelloStatus;
  workspace: string | null;
  board: string | null;
  lists: string[];
  cards: string[];
  rule: "all" | "lists" | "cards";
  lastSync: string | null;
}

export const trelloWorkspaces = ["Agency", "Internal Studio", "Client Success"];

export const trelloBoards: Record<string, string[]> = {
  Agency: ["Client A", "Client B", "Retainers"],
  "Internal Studio": ["Internal Product", "Design System"],
  "Client Success": ["Onboarding", "Support"],
};

export const trelloLists = ["Backlog", "Doing", "Review", "Done"];

export const trelloCards = [
  "Landing Page",
  "Checkout",
  "Blog",
  "Pricing Page",
  "Onboarding Emails",
];

export const members: Member[] = [
  {
    id: "u1",
    name: "Marina Duarte",
    email: "marina@studio.co",
    role: "Owner",
    status: "active",
    initials: "MD",
  },
  {
    id: "u2",
    name: "Caio Ferreira",
    email: "caio@studio.co",
    role: "Admin",
    status: "active",
    initials: "CF",
  },
  {
    id: "u3",
    name: "Helena Prado",
    email: "helena@studio.co",
    role: "Member",
    status: "active",
    initials: "HP",
  },
  {
    id: "u4",
    name: "Tomás Lima",
    email: "tomas@studio.co",
    role: "Member",
    status: "invited",
    initials: "TL",
  },
];

export const currentUserId = "u1";

export const clients: Client[] = [
  {
    id: "c1",
    name: "Northwind Coffee",
    contact: "ana@northwind.co",
    billable: true,
    archived: false,
  },
  {
    id: "c2",
    name: "Basalt Studio",
    contact: "leo@basalt.design",
    billable: true,
    archived: false,
  },
  {
    id: "c3",
    name: "Vela Health",
    contact: "dr.reis@velahealth.com",
    billable: true,
    archived: false,
  },
  { id: "c4", name: "Internal", contact: "ops@studio.co", billable: false, archived: false },
];

export const projects: Project[] = [
  {
    id: "p1",
    name: "Landing Page",
    clientId: "c1",
    status: "active",
    color: "bg-accent",
    lastActivity: "2026-08-17",
    memberIds: ["u1", "u2", "u3"],
  },
  {
    id: "p2",
    name: "Checkout Redesign",
    clientId: "c1",
    status: "active",
    color: "bg-success",
    lastActivity: "2026-08-16",
    memberIds: ["u1", "u3"],
  },
  {
    id: "p3",
    name: "Marketing Campaign",
    clientId: "c2",
    status: "active",
    color: "bg-warning",
    lastActivity: "2026-08-15",
    memberIds: ["u2"],
  },
  {
    id: "p4",
    name: "Website Redesign",
    clientId: "c3",
    status: "on-hold",
    color: "bg-danger",
    lastActivity: "2026-08-11",
    memberIds: ["u1", "u2"],
  },
  {
    id: "p5",
    name: "Client Onboarding",
    clientId: "c3",
    status: "active",
    color: "bg-accent",
    lastActivity: "2026-08-14",
    memberIds: ["u3"],
  },
  {
    id: "p6",
    name: "Internal Product",
    clientId: "c4",
    status: "archived",
    color: "bg-foreground",
    lastActivity: "2026-07-30",
    memberIds: ["u1", "u2", "u3"],
  },
];

const today = "2026-08-21";
const yesterday = "2026-08-20";
const twoDaysAgo = "2026-08-19";
const threeDaysAgo = "2026-08-18";
const fourDaysAgo = "2026-08-17";
const lastWeekStart = "2026-08-10";
const lastWeek = "2026-08-11";

export const timeEntries: TimeEntry[] = [
  {
    id: "t1",
    date: today,
    start: "09:00",
    end: "10:32",
    seconds: 5520,
    userId: "u1",
    projectId: "p1",
    task: "Landing Page",
    description: "Hero section and responsive pass",
    billable: true,
  },
  {
    id: "t2",
    date: today,
    start: "11:20",
    end: "12:05",
    seconds: 2700,
    userId: "u1",
    projectId: "p3",
    task: "Meeting",
    description: "Weekly sync with Basalt Studio",
    billable: false,
  },
  {
    id: "t3",
    date: today,
    start: "13:10",
    end: "15:25",
    seconds: 8100,
    userId: "u1",
    projectId: "p2",
    task: "Development",
    description: "Payment step refactor",
    billable: true,
  },
  {
    id: "t4",
    date: today,
    start: "15:40",
    end: "17:25",
    seconds: 6300,
    userId: "u1",
    projectId: "p1",
    task: "Design review",
    billable: true,
  },
  {
    id: "t5",
    date: yesterday,
    start: "09:15",
    end: "12:00",
    seconds: 9900,
    userId: "u2",
    projectId: "p2",
    task: "Checkout flow QA",
    billable: true,
  },
  {
    id: "t6",
    date: yesterday,
    start: "13:00",
    end: "16:30",
    seconds: 12600,
    userId: "u3",
    projectId: "p5",
    task: "Onboarding docs",
    billable: true,
  },
  {
    id: "t7",
    date: twoDaysAgo,
    start: "10:00",
    end: "12:30",
    seconds: 9000,
    userId: "u2",
    projectId: "p3",
    task: "Campaign assets",
    billable: true,
  },
  {
    id: "t8",
    date: twoDaysAgo,
    start: "14:00",
    end: "15:00",
    seconds: 3600,
    userId: "u1",
    projectId: "p6",
    task: "Internal roadmap",
    billable: false,
  },
  {
    id: "t9",
    date: lastWeek,
    start: "09:30",
    end: "13:00",
    seconds: 12600,
    userId: "u3",
    projectId: "p4",
    task: "Website audit",
    billable: true,
  },
  {
    id: "t10",
    date: lastWeek,
    start: "14:30",
    end: "17:00",
    seconds: 9000,
    userId: "u1",
    projectId: "p4",
    task: "Content migration",
    billable: true,
  },
  {
    id: "t11",
    date: threeDaysAgo,
    start: "09:30",
    end: "11:10",
    seconds: 6000,
    userId: "u1",
    projectId: "p1",
    task: "Content structure",
    description: "Prepared the page sections for handoff",
    billable: true,
  },
  {
    id: "t12",
    date: fourDaysAgo,
    start: "14:00",
    end: "15:20",
    seconds: 4800,
    userId: "u1",
    projectId: "p2",
    task: "Checkout notes",
    billable: true,
  },
  {
    id: "t13",
    date: lastWeekStart,
    start: "09:00",
    end: "10:45",
    seconds: 6300,
    userId: "u1",
    projectId: "p1",
    task: "Weekly planning",
    description: "Prioritized the next delivery milestone",
    billable: false,
  },
  {
    id: "t14",
    date: "2026-08-07",
    start: "13:15",
    end: "16:00",
    seconds: 9900,
    userId: "u1",
    projectId: "p3",
    task: "Campaign review",
    billable: true,
  },
  {
    id: "t15",
    date: yesterday,
    start: "17:00",
    end: "17:35",
    seconds: 2100,
    userId: "u1",
    projectId: null,
    task: "Inbox and planning",
    description: "Unassigned workspace time",
    billable: false,
  },
  {
    id: "t16",
    date: "2026-08-12",
    start: "08:45",
    end: "09:30",
    seconds: 2700,
    userId: "u1",
    projectId: null,
    task: "Weekly admin",
    billable: false,
  },
];

export const TODAY = today;
