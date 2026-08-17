import { Avatar, Chip, Table } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/states";
import { formatDuration } from "@/lib/format";
import { useSimulatedLoad, useStore } from "@/lib/store";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team — Time Blossom" },
      { name: "description", content: "Members, roles and hours tracked by each teammate." },
      { property: "og:title", content: "Team — Time Blossom" },
      { property: "og:description", content: "See who tracked what across the workspace." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { members, entries } = useStore();
  const loading = useSimulatedLoad(400);
  const secondsFor = (id: string) =>
    entries.filter((e) => e.userId === id).reduce((s, e) => s + e.seconds, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Team" description="Roles, access and tracked hours." />
      {loading ? (
        <TableSkeleton rows={4} />
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Team members" className="min-w-[600px]">
              <Table.Header>
                <Table.Column isRowHeader>Member</Table.Column>
                <Table.Column>Role</Table.Column>
                <Table.Column>Status</Table.Column>
                <Table.Column>Tracked</Table.Column>
              </Table.Header>
              <Table.Body>
                {members.map((member) => (
                  <Table.Row key={member.id}>
                    <Table.Cell>
                      <div className="flex items-center gap-3">
                        <Avatar size="sm">
                          <Avatar.Fallback>{member.initials}</Avatar.Fallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{member.name}</span>
                          <span className="text-xs text-muted">{member.email}</span>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>{member.role}</Table.Cell>
                    <Table.Cell>
                      <Chip
                        color={member.status === "active" ? "success" : "warning"}
                        size="sm"
                        variant="soft"
                      >
                        {member.status}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell className="tabular-nums">
                      {formatDuration(secondsFor(member.id))}
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
