import { Input } from "@heroui/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyBlock } from "@/components/states";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search["q"] === "string" ? search["q"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Search — Time Blossom" },
      { name: "description", content: "Search projects, clients, teammates and time entries." },
      { property: "og:title", content: "Search — Time Blossom" },
      { property: "og:description", content: "Find anything in your workspace." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const { projects, clients, members, entries } = useStore();
  const term = q.trim().toLowerCase();

  const match = (value: string) => term.length > 0 && value.toLowerCase().includes(term);
  const p = projects.filter((x) => match(x.name));
  const c = clients.filter((x) => match(x.name));
  const m = members.filter((x) => match(x.name) || match(x.email));
  const e = entries.filter((x) => match(x.task));
  const empty = p.length + c.length + m.length + e.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Search" description="Look across projects, clients, team and entries." />

      <Input
        fullWidth
        aria-label="Search workspace"
        placeholder="Search…"
        value={q}
        onChange={(ev) => navigate({ to: "/search", search: { q: ev.target.value } })}
      />

      {empty ? (
        <EmptyBlock
          icon={<SearchIcon className="size-5" />}
          title={term ? "No matches" : "Start typing"}
          description={
            term ? "Try another keyword or check the spelling." : "Results appear as you type."
          }
        />
      ) : (
        <div className="space-y-6">
          {p.length > 0 && (
            <Section title="Projects">
              {p.map((item) => (
                <Link
                  key={item.id}
                  to="/projects/$projectId"
                  params={{ projectId: item.id }}
                  className="block px-4 py-3 text-sm hover:bg-surface-secondary"
                >
                  {item.name}
                </Link>
              ))}
            </Section>
          )}
          {c.length > 0 && (
            <Section title="Clients">
              {c.map((item) => (
                <Link
                  key={item.id}
                  to="/clients"
                  className="block px-4 py-3 text-sm hover:bg-surface-secondary"
                >
                  {item.name}
                </Link>
              ))}
            </Section>
          )}
          {m.length > 0 && (
            <Section title="Team">
              {m.map((item) => (
                <Link
                  key={item.id}
                  to="/team"
                  className="block px-4 py-3 text-sm hover:bg-surface-secondary"
                >
                  {item.name}
                </Link>
              ))}
            </Section>
          )}
          {e.length > 0 && (
            <Section title="Time entries">
              {e.slice(0, 10).map((item) => (
                <Link
                  key={item.id}
                  to="/timesheet"
                  className="block px-4 py-3 text-sm hover:bg-surface-secondary"
                >
                  {item.task}
                </Link>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      <div className="divide-y divide-default overflow-hidden rounded-xl border border-default bg-surface">
        {children}
      </div>
    </div>
  );
}
