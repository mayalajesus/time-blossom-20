import { Button, Chip, Table } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyBlock, TableSkeleton } from "@/components/states";
import { formatDuration } from "@/lib/format";
import { useSimulatedLoad, useStore } from "@/lib/store";

export const Route = createFileRoute("/clients")({
  head: () => ({
    meta: [
      { title: "Clients — Time Blossom" },
      {
        name: "description",
        content: "Manage clients, billing status and hours tracked for each.",
      },
      { property: "og:title", content: "Clients — Time Blossom" },
      { property: "og:description", content: "Client list with billable hours and contacts." },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const { clients, projects, entries, updateClient } = useStore();
  const loading = useSimulatedLoad(400);

  const secondsFor = (clientId: string) => {
    const ids = projects.filter((p) => p.clientId === clientId).map((p) => p.id);
    return entries.filter((e) => ids.includes(e.projectId)).reduce((s, e) => s + e.seconds, 0);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Clients" description="Who you work for and how much time they take." />

      {loading ? (
        <TableSkeleton rows={4} />
      ) : clients.length === 0 ? (
        <EmptyBlock
          icon={<Building2 className="size-5" />}
          title="No clients yet"
          description="Add a client to group projects and billable hours."
        />
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Clients" className="min-w-[640px]">
              <Table.Header>
                <Table.Column isRowHeader>Client</Table.Column>
                <Table.Column>Contact</Table.Column>
                <Table.Column>Projects</Table.Column>
                <Table.Column>Tracked</Table.Column>
                <Table.Column>Status</Table.Column>
                <Table.Column aria-label="Actions">{""}</Table.Column>
              </Table.Header>
              <Table.Body>
                {clients.map((client) => (
                  <Table.Row key={client.id}>
                    <Table.Cell className="font-medium">{client.name}</Table.Cell>
                    <Table.Cell className="text-muted">{client.contact}</Table.Cell>
                    <Table.Cell>
                      {projects.filter((p) => p.clientId === client.id).length}
                    </Table.Cell>
                    <Table.Cell className="tabular-nums">
                      {formatDuration(secondsFor(client.id))}
                    </Table.Cell>
                    <Table.Cell>
                      <Chip
                        color={client.billable ? "success" : "default"}
                        size="sm"
                        variant="soft"
                      >
                        {client.billable ? "Billable" : "Internal"}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="tertiary"
                          onPress={() => updateClient(client.id, { billable: !client.billable })}
                        >
                          Toggle billing
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}
    </div>
  );
}
