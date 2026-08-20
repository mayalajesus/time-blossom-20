import {
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  Modal,
  Table,
  TextField,
  toast,
} from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ActionDropdown } from "@/components/action-dropdown";
import { FormAlert } from "@/components/form-feedback";
import { PageHeader } from "@/components/page-header";
import { EmptyBlock, TableSkeleton } from "@/components/states";
import { formatDuration } from "@/lib/format";
import type { Client } from "@/lib/mock-data";
import { useSimulatedLoad, useStore } from "@/lib/store";

export const Route = createFileRoute("/clients")({
  head: () => ({
    meta: [
      { title: "Clients — Time Blossom" },
      {
        name: "description",
        content: "Manage clients, contacts and the projects connected to each client.",
      },
      { property: "og:title", content: "Clients — Time Blossom" },
      { property: "og:description", content: "Client list with contacts and tracked time." },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const { clients, projects, entries, addClient, deleteClient } = useStore();
  const loading = useSimulatedLoad(400);
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const projectCountFor = (clientId: string) =>
    projects.filter((project) => project.clientId === clientId).length;

  const secondsFor = (clientId: string) => {
    const ids = projects
      .filter((project) => project.clientId === clientId)
      .map((project) => project.id);
    return entries
      .filter((entry) => entry.projectId !== null && ids.includes(entry.projectId))
      .reduce((sum, entry) => sum + entry.seconds, 0);
  };

  const resetCreateForm = () => {
    setName("");
    setContact("");
    setCreateError(null);
  };

  const create = () => {
    if (!name.trim()) return;
    const result = addClient({ name: name.trim(), contact: contact.trim() });
    if (!result.success) {
      setCreateError(result.error);
      return;
    }
    toast("Client created", { description: name.trim() });
    resetCreateForm();
    setNewOpen(false);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const result = deleteClient(pendingDelete.id);
    if (!result.success) {
      setDeleteError(result.error);
      return;
    }
    toast("Client removed", { description: pendingDelete.name });
    setPendingDelete(null);
    setDeleteError(null);
  };

  const pendingProjectCount = pendingDelete ? projectCountFor(pendingDelete.id) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Manage the people and companies connected to your projects."
        actions={
          <Button
            onPress={() => {
              resetCreateForm();
              setNewOpen(true);
            }}
          >
            <Plus className="size-4" />
            New client
          </Button>
        }
      />

      {loading ? (
        <TableSkeleton rows={4} />
      ) : clients.length === 0 ? (
        <EmptyBlock
          icon={<Building2 className="size-5" />}
          title="No clients yet"
          description="Add a client to connect projects and organize tracked time."
          action={
            <Button size="sm" variant="secondary" onPress={() => setNewOpen(true)}>
              New client
            </Button>
          }
        />
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Clients" className="min-w-[640px]">
              <Table.Header>
                <Table.Column isRowHeader>Client</Table.Column>
                <Table.Column>Contact</Table.Column>
                <Table.Column className="text-center">Projects</Table.Column>
                <Table.Column className="text-center">Tracked</Table.Column>
                <Table.Column aria-label="Actions">{""}</Table.Column>
              </Table.Header>
              <Table.Body>
                {clients.map((client) => (
                  <Table.Row key={client.id}>
                    <Table.Cell className="font-medium">{client.name}</Table.Cell>
                    <Table.Cell className="text-muted">{client.contact || "—"}</Table.Cell>
                    <Table.Cell className="text-center">{projectCountFor(client.id)}</Table.Cell>
                    <Table.Cell className="text-center tabular-nums">
                      {formatDuration(secondsFor(client.id))}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex justify-end">
                        <ActionDropdown
                          ariaLabel={`Actions for ${client.name}`}
                          items={[
                            {
                              id: "delete",
                              label: "Delete client",
                              icon: <Trash2 className="size-4" />,
                              tone: "danger",
                            },
                          ]}
                          onAction={(key) => {
                            if (key === "delete") {
                              setDeleteError(null);
                              setPendingDelete(client);
                            }
                          }}
                        />
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}

      <Modal
        isOpen={newOpen}
        onOpenChange={(open) => {
          setNewOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>New client</Modal.Heading>
              </Modal.Header>
              <Form
                onSubmit={(event) => {
                  event.preventDefault();
                  create();
                }}
              >
                <Modal.Body className="flex flex-col gap-4">
                  {createError ? (
                    <FormAlert title="Could not create client" description={createError} />
                  ) : null}

                  <TextField
                    isRequired
                    fullWidth
                    name="client-name"
                    value={name}
                    validate={(value) => (value.trim() ? null : "Client name is required")}
                    onChange={(value) => {
                      setName(value);
                      setCreateError(null);
                    }}
                  >
                    <Label>Name</Label>
                    <Input placeholder="e.g. Northwind Coffee" />
                    <FieldError />
                  </TextField>

                  <TextField
                    fullWidth
                    name="client-contact"
                    type="email"
                    value={contact}
                    validate={(value) =>
                      !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
                        ? null
                        : "Enter a valid email address"
                    }
                    onChange={(value) => {
                      setContact(value);
                      setCreateError(null);
                    }}
                  >
                    <Label>Contact</Label>
                    <Input placeholder="name@company.com" />
                    <Description>Optional</Description>
                    <FieldError />
                  </TextField>
                </Modal.Body>
                <Modal.Footer>
                  <Button slot="close" type="button" variant="secondary">
                    Cancel
                  </Button>
                  <Button type="submit" isDisabled={!name.trim()}>
                    Create client
                  </Button>
                </Modal.Footer>
              </Form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal
        isOpen={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Delete client?</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4">
                {deleteError ? (
                  <FormAlert title="Could not delete client" description={deleteError} />
                ) : null}
                {pendingProjectCount > 0 ? (
                  <FormAlert
                    status="warning"
                    title="Client cannot be deleted"
                    description={`${pendingDelete?.name ?? "This client"} is connected to ${pendingProjectCount} project${pendingProjectCount === 1 ? "" : "s"}. Remove or reassign those projects first.`}
                  />
                ) : (
                  <p className="text-sm text-muted">
                    This permanently removes {pendingDelete?.name ?? "this client"}. Tracked time
                    entries without a direct client relationship remain unchanged.
                  </p>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  isDisabled={pendingProjectCount > 0}
                  onPress={confirmDelete}
                >
                  Delete client
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
