import { Button, Chip } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Trello } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { formatLocalDateTime } from "@/lib/format";
import { trelloBoards, trelloCards, trelloLists, trelloWorkspaces } from "@/lib/mock-data";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations — Time Blossom" },
      {
        name: "description",
        content: "Connect Time Blossom to Trello and sync cards into tracked tasks.",
      },
      { property: "og:title", content: "Integrations — Time Blossom" },
      { property: "og:description", content: "Simulated Trello sync for your time tracking." },
    ],
  }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const { trello, can, setTrello } = useStore();
  const canManageIntegrations = can("manage-integrations");
  const connected = trello.status === "connected" || trello.status === "synced";
  const toggleSelected = connected || trello.status === "connecting";

  const connect = (on: boolean) => {
    if (!on) {
      setTrello({ status: "disconnected", workspace: null, board: null, lists: [], cards: [] });
      return;
    }
    setTrello({ status: "connecting" });
    setTimeout(() => {
      setTrello({
        status: "connected",
        workspace: trelloWorkspaces[0] ?? null,
        board: trelloBoards["Agency"]?.[0] ?? null,
        lists: trelloLists.slice(0, 2),
        cards: trelloCards.slice(0, 4),
      });
    }, 700);
  };

  const sync = () => {
    setTrello({ status: "syncing" });
    setTimeout(
      () =>
        setTrello({
          status: "synced",
          cards: trelloCards,
          lastSync: formatLocalDateTime(),
        }),
      900,
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" description="Bring tasks from the tools you already use." />

      <div className="rounded-2xl border border-default bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-default p-2">
              <Trello className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">Trello</p>
              <p className="text-sm text-muted">
                Import cards from your boards and start timers straight from a card.
              </p>
              <Chip color={connected ? "success" : "default"} size="sm" variant="soft">
                {trello.status}
              </Chip>
            </div>
          </div>
          {canManageIntegrations ? (
            <Button
              aria-label="Connect Trello"
              aria-pressed={toggleSelected}
              className="h-7 w-12 min-w-12 justify-start rounded-full p-1 data-[pressed=true]:justify-end"
              isIconOnly
              variant="tertiary"
              onPress={() => connect(!toggleSelected)}
            >
              <span className="size-5 rounded-full bg-foreground shadow-sm" />
            </Button>
          ) : null}
        </div>

        {connected ? (
          <div className="mt-6 space-y-4 border-t border-default pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-muted">
                {trello.workspace} · {trello.board} · last sync {trello.lastSync ?? "never"}
              </span>
              {canManageIntegrations ? (
                <Button
                  size="sm"
                  variant="secondary"
                  isPending={trello.status === "syncing"}
                  onPress={sync}
                >
                  Sync now
                </Button>
              ) : null}
            </div>
            <ul className="divide-y divide-default rounded-xl border border-default">
              {trello.cards.map((card) => (
                <li key={card} className="flex items-center justify-between gap-3 px-4 py-3">
                  <p className="text-sm text-foreground">{card}</p>
                  <Chip size="sm" variant="soft">
                    {trello.board}
                  </Chip>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
