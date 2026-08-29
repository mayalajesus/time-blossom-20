import { Button, Card, Chip, Typography } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Trello } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { formatLocalDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
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
      { property: "og:description", content: "Trello sync for your time tracking." },
    ],
  }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const { trello, can, setTrello } = useStore();
  const { locale, t } = useI18n();
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
          lastSync: formatLocalDateTime(new Date(), locale),
        }),
      900,
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Integrations")}
        description={t("Bring tasks from the tools you already use.")}
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center p-2">
              <Trello className="size-5" />
            </div>
            <div className="space-y-1">
              <Typography type="body-sm" weight="semibold">
                Trello
              </Typography>
              <Typography type="body-sm" color="muted">
                {t("Import cards from your boards and start timers straight from a card.")}
              </Typography>
              <Chip color={connected ? "success" : "default"} size="sm" variant="soft">
                {t(trello.status)}
              </Chip>
            </div>
          </div>
          {canManageIntegrations ? (
            <Button
              aria-label={t("Connect Trello")}
              aria-pressed={toggleSelected}
              className="h-7 w-12 min-w-12 justify-start p-1"
              isIconOnly
              variant="tertiary"
              onPress={() => connect(!toggleSelected)}
            >
              <span className="size-5" />
            </Button>
          ) : null}
        </div>

        {connected ? (
          <div className="mt-6 space-y-4 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Typography type="body-xs" color="muted">
                {trello.workspace} · {trello.board} · {t("last sync")}{" "}
                {trello.lastSync ?? t("never")}
              </Typography>
              {canManageIntegrations ? (
                <Button
                  size="sm"
                  variant="secondary"
                  isPending={trello.status === "syncing"}
                  onPress={sync}
                >
                  {t("Sync now")}
                </Button>
              ) : null}
            </div>
            <ul className="overflow-hidden">
              {trello.cards.map((card) => (
                <li key={card} className="flex items-center justify-between gap-3 px-4 py-3">
                  <Typography type="body-sm" weight="medium">
                    {card}
                  </Typography>
                  <Chip size="sm" variant="soft">
                    {trello.board}
                  </Chip>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
