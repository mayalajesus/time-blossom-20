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
  Typography,
  toast,
} from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Person, Plus, TrashBin } from "@gravity-ui/icons";
import { useState } from "react";
import { ActionDropdown } from "@/components/action-dropdown";
import { DataTable } from "@/components/data-table";
import { FormAlert } from "@/components/form-feedback";
import { ModalTriggerRegistration } from "@/components/overlay-trigger-registration";
import { PageHeader } from "@/components/page-header";
import { EmptyBlock, TableSkeleton } from "@/components/states";
import { formatDuration } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
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
  const { clients, projects, entries, can, addClient, deleteClient } = useStore();
  const { locale, t, error } = useI18n();
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
      setCreateError(error(result.error));
      return;
    }
    toast(t("Client created"), { description: name.trim() });
    resetCreateForm();
    setNewOpen(false);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const result = deleteClient(pendingDelete.id);
    if (!result.success) {
      setDeleteError(error(result.error));
      return;
    }
    toast(t("Client removed"), { description: pendingDelete.name });
    setPendingDelete(null);
    setDeleteError(null);
  };

  const pendingProjectCount = pendingDelete ? projectCountFor(pendingDelete.id) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Clients")}
        description={t("Manage the people and companies connected to your projects.")}
        actions={
          can("manage-clients") ? (
            <Button
              onPress={() => {
                resetCreateForm();
                setNewOpen(true);
              }}
            >
              <Plus className="size-4" />
              {t("New client")}
            </Button>
          ) : null
        }
      />

      {loading ? (
        <TableSkeleton rows={4} />
      ) : clients.length === 0 ? (
        <EmptyBlock
          icon={<Person className="size-5" />}
          title={t("No clients yet")}
          description={t("Add a client to connect projects and organize tracked time.")}
          action={
            can("manage-clients") ? (
              <Button size="sm" variant="secondary" onPress={() => setNewOpen(true)}>
                {t("New client")}
              </Button>
            ) : null
          }
        />
      ) : (
        <DataTable label={t("Clients")} minWidth="min-w-[640px]">
          <Table.Header>
            <Table.Column isRowHeader>{t("Client")}</Table.Column>
            <Table.Column>{t("Contact")}</Table.Column>
            <Table.Column>{t("Projects")}</Table.Column>
            <Table.Column>{t("Tracked")}</Table.Column>
            <Table.Column aria-label={t("Actions")}>{""}</Table.Column>
          </Table.Header>
          <Table.Body>
            {clients.map((client) => (
              <Table.Row key={client.id}>
                <Table.Cell>{client.name}</Table.Cell>
                <Table.Cell>{client.contact || "—"}</Table.Cell>
                <Table.Cell>{projectCountFor(client.id)}</Table.Cell>
                <Table.Cell>{formatDuration(secondsFor(client.id), locale)}</Table.Cell>
                <Table.Cell>
                  {can("manage-clients") ? (
                    <div className="flex justify-end">
                      <ActionDropdown
                        ariaLabel={t("Actions for {name}", { name: client.name })}
                        items={[
                          {
                            id: "delete",
                            label: t("Delete client"),
                            icon: <TrashBin className="size-4" />,
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
                  ) : null}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </DataTable>
      )}

      <Modal
        isOpen={newOpen}
        onOpenChange={(open) => {
          setNewOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <ModalTriggerRegistration />
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t("New client")}</Modal.Heading>
              </Modal.Header>
              <Form
                onSubmit={(event) => {
                  event.preventDefault();
                  create();
                }}
              >
                <Modal.Body className="flex flex-col gap-4">
                  {createError ? (
                    <FormAlert title={t("Could not create client")} description={createError} />
                  ) : null}

                  <TextField
                    isRequired
                    fullWidth
                    name="client-name"
                    value={name}
                    validate={(value) => (value.trim() ? null : t("Client name is required"))}
                    onChange={(value) => {
                      setName(value);
                      setCreateError(null);
                    }}
                  >
                    <Label>{t("Name")}</Label>
                    <Input placeholder={t("e.g. Northwind Coffee")} />
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
                        : t("Enter a valid email address")
                    }
                    onChange={(value) => {
                      setContact(value);
                      setCreateError(null);
                    }}
                  >
                    <Label>{t("Contact")}</Label>
                    <Input placeholder={t("name@company.com")} />
                    <Description>{t("Optional")}</Description>
                    <FieldError />
                  </TextField>
                </Modal.Body>
                <Modal.Footer>
                  <Button slot="close" type="button" variant="secondary">
                    {t("Cancel")}
                  </Button>
                  <Button type="submit" isDisabled={!name.trim()}>
                    {t("Create client")}
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
        <ModalTriggerRegistration />
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t("Delete client?")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4">
                {deleteError ? (
                  <FormAlert title={t("Could not delete client")} description={deleteError} />
                ) : null}
                {pendingProjectCount > 0 ? (
                  <FormAlert
                    status="warning"
                    title={t("Client cannot be deleted")}
                    description={t(
                      "{name} is connected to {count} project{suffix}. Remove or reassign those projects first.",
                      {
                        name: pendingDelete?.name ?? t("This client"),
                        count: pendingProjectCount,
                        suffix: pendingProjectCount === 1 ? "" : "s",
                      },
                    )}
                  />
                ) : (
                  <Typography type="body-sm" color="muted">
                    {t(
                      "This permanently removes {name}. Tracked time entries without a direct client relationship remain unchanged.",
                      {
                        name: pendingDelete?.name ?? t("this client"),
                      },
                    )}
                  </Typography>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  {t("Cancel")}
                </Button>
                <Button
                  variant="danger"
                  isDisabled={pendingProjectCount > 0}
                  onPress={confirmDelete}
                >
                  {t("Delete client")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
