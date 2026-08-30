import {
  Avatar,
  Button,
  Chip,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Table,
  TextField,
  Typography,
  toast,
} from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Envelope, PaperPlane, PersonPencil, PersonPlus, TrashBin } from "@gravity-ui/icons";
import { useState } from "react";
import { ActionDropdown } from "@/components/action-dropdown";
import { DataTable } from "@/components/data-table";
import { FormAlert } from "@/components/form-feedback";
import { ModalTriggerRegistration } from "@/components/overlay-trigger-registration";
import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/states";
import { formatDuration } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { Member, Role } from "@/lib/mock-data";
import { useSimulatedLoad, useStore } from "@/lib/store";

type InviteRole = Exclude<Role, "Owner">;

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team — Time Blossom" },
      { name: "description", content: "Invite teammates, manage roles and track team hours." },
      { property: "og:title", content: "Team — Time Blossom" },
      { property: "og:description", content: "Invite teammates and see tracked hours by member." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const {
    members,
    entries,
    can,
    currentMember,
    inviteMember,
    resendInvite,
    cancelInvite,
    removeMember,
    restoreMember,
    updateMemberRole,
  } = useStore();
  const { locale, t, error } = useI18n();
  const loading = useSimulatedLoad(400);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("Member");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState<Member | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<Member | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const inviteRoles: InviteRole[] = can("manage-admins") ? ["Member", "Admin"] : ["Member"];

  const orderedMembers = [...members].sort((a, b) => {
    const rank = { invited: 0, active: 1, removed: 2 } as const;
    return rank[a.status] - rank[b.status] || a.name.localeCompare(b.name);
  });

  const secondsFor = (id: string) =>
    entries.filter((entry) => entry.userId === id).reduce((sum, entry) => sum + entry.seconds, 0);

  const resetInviteForm = () => {
    setEmail("");
    setRole("Member");
    setInviteError(null);
  };

  const openInvite = () => {
    resetInviteForm();
    setInviteOpen(true);
  };

  const submitInvite = () => {
    const result = inviteMember(email, role);
    if (!result.success) {
      setInviteError(error(result.error));
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    toast(t("Invitation prepared"), {
      description: `${normalizedEmail} · ${role}`,
    });
    resetInviteForm();
    setInviteOpen(false);
  };

  const handleResend = (member: Member) => {
    const result = resendInvite(member.id);
    if (!result.success) {
      toast(t("Could not refresh invitation"), { description: error(result.error) });
      return;
    }
    toast(t("Invitation refreshed"), { description: member.email });
  };

  const confirmCancel = () => {
    if (!pendingCancel) return;
    const result = cancelInvite(pendingCancel.id);
    if (!result.success) {
      setCancelError(error(result.error));
      return;
    }
    toast(t("Invitation canceled"), { description: pendingCancel.email });
    setPendingCancel(null);
    setCancelError(null);
  };

  const handleRestore = (member: Member) => {
    const result = restoreMember(member.id);
    if (!result.success) {
      toast(t("Could not restore access"), { description: error(result.error) });
      return;
    }
    toast(t("Access restored"), { description: member.email });
  };

  const confirmRemove = () => {
    if (!pendingRemove) return;
    const result = removeMember(pendingRemove.id);
    if (!result.success) {
      setRemoveError(error(result.error));
      return;
    }
    toast(t("Member removed"), {
      description: t("{email} no longer has access to the workspace.", {
        email: pendingRemove.email,
      }),
    });
    setPendingRemove(null);
    setRemoveError(null);
  };

  const manageRole = (member: Member) => {
    const nextRole: InviteRole = member.role === "Admin" ? "Member" : "Admin";
    const result = updateMemberRole(member.id, nextRole);
    if (!result.success) {
      toast(t("Could not change role"), { description: error(result.error) });
      return;
    }
    toast(t("Role updated"), { description: `${member.name} · ${t(nextRole)}` });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Team")}
        description={t("Invite teammates, manage roles and tracked hours.")}
        actions={
          can("manage-members") ? (
            <Button onPress={openInvite}>
              <PaperPlane className="size-4" />
              {t("Invite member")}
            </Button>
          ) : null
        }
      />

      {loading ? (
        <TableSkeleton rows={4} />
      ) : (
        <DataTable label={t("Team members")} minWidth="min-w-[680px]">
          <Table.Header>
            <Table.Column isRowHeader>{t("Member")}</Table.Column>
            <Table.Column>{t("Role")}</Table.Column>
            <Table.Column>{t("Status")}</Table.Column>
            <Table.Column>{t("Tracked")}</Table.Column>
            <Table.Column aria-label={t("Actions")}>{""}</Table.Column>
          </Table.Header>
          <Table.Body>
            {orderedMembers.map((member) => {
              const invited = member.status === "invited";
              const removed = member.status === "removed";
              const isCurrentMember = member.id === currentMember?.id;
              const canManageTarget =
                !isCurrentMember &&
                can("manage-members") &&
                (currentMember?.role === "Owner" || member.role === "Member");
              const canChangeRole =
                canManageTarget &&
                (currentMember?.role === "Owner" ||
                  (currentMember?.role === "Admin" && member.status === "active"));
              return (
                <Table.Row key={member.id}>
                  <Table.Cell>
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar size="sm">
                        <Avatar.Fallback>{member.initials}</Avatar.Fallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{invited ? member.email : member.name}</span>
                        <span className="truncate">
                          {invited
                            ? t("Invitation pending")
                            : removed
                              ? t("Access removed")
                              : member.email}
                        </span>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>{t(member.role)}</Table.Cell>
                  <Table.Cell>
                    <Chip
                      color={invited ? "warning" : removed ? "default" : "success"}
                      size="sm"
                      variant="soft"
                    >
                      {invited ? t("Invited") : removed ? t("Removed") : t("Active")}
                    </Chip>
                  </Table.Cell>
                  <Table.Cell>
                    {invited ? "—" : formatDuration(secondsFor(member.id), locale)}
                  </Table.Cell>
                  <Table.Cell>
                    {invited && canManageTarget ? (
                      <div className="flex justify-end">
                        <ActionDropdown
                          ariaLabel={t("Actions for invitation to {email}", {
                            email: member.email,
                          })}
                          items={[
                            ...(canChangeRole
                              ? [
                                  {
                                    id: "role",
                                    label:
                                      member.role === "Admin" ? t("Make member") : t("Make admin"),
                                    icon: <PersonPencil className="size-4" />,
                                  },
                                ]
                              : []),
                            {
                              id: "resend",
                              label: t("Resend invite"),
                              icon: <Envelope className="size-4" />,
                            },
                            {
                              id: "cancel",
                              label: t("Cancel invite"),
                              icon: <TrashBin className="size-4" />,
                              tone: "danger",
                            },
                          ]}
                          onAction={(key) => {
                            if (key === "role") manageRole(member);
                            if (key === "resend") handleResend(member);
                            if (key === "cancel") {
                              setCancelError(null);
                              setPendingCancel(member);
                            }
                          }}
                        />
                      </div>
                    ) : removed && canManageTarget ? (
                      <div className="flex justify-end">
                        <ActionDropdown
                          ariaLabel={t("Actions for {name}", { name: member.name })}
                          items={[
                            {
                              id: "restore",
                              label: t("Restore access"),
                              icon: <PersonPlus className="size-4" />,
                            },
                          ]}
                          onAction={(key) => {
                            if (key === "restore") handleRestore(member);
                          }}
                        />
                      </div>
                    ) : member.status === "active" && canManageTarget ? (
                      <div className="flex justify-end">
                        <ActionDropdown
                          ariaLabel={t("Actions for {name}", { name: member.name })}
                          items={[
                            ...(canChangeRole
                              ? [
                                  {
                                    id: "role",
                                    label:
                                      member.role === "Admin" ? t("Make member") : t("Make admin"),
                                    icon: <PersonPencil className="size-4" />,
                                  },
                                ]
                              : []),
                            {
                              id: "remove",
                              label: t("Remove from team"),
                              icon: <TrashBin className="size-4" />,
                              tone: "danger",
                            },
                          ]}
                          onAction={(key) => {
                            if (key === "role") manageRole(member);
                            if (key === "remove") {
                              setRemoveError(null);
                              setPendingRemove(member);
                            }
                          }}
                        />
                      </div>
                    ) : isCurrentMember ? (
                      <span className="sr-only">{t("No actions available for your account")}</span>
                    ) : null}
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </DataTable>
      )}

      <Modal
        isOpen={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) resetInviteForm();
        }}
      >
        <ModalTriggerRegistration />
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t("Invite member")}</Modal.Heading>
              </Modal.Header>
              <Form
                onSubmit={(event) => {
                  event.preventDefault();
                  submitInvite();
                }}
              >
                <Modal.Body className="flex flex-col gap-4">
                  {inviteError ? (
                    <FormAlert
                      title={t("Could not prepare invitation")}
                      description={inviteError}
                    />
                  ) : null}

                  <TextField
                    isRequired
                    fullWidth
                    name="invite-email"
                    type="email"
                    value={email}
                    validate={(value) => {
                      const normalized = value.trim().toLowerCase();
                      if (!normalized) return t("Email is required");
                      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
                        return t("Enter a valid email address");
                      }
                      if (members.some((member) => member.email.toLowerCase() === normalized)) {
                        return t("This email is already part of the team");
                      }
                      return null;
                    }}
                    onChange={(value) => {
                      setEmail(value);
                      setInviteError(null);
                    }}
                  >
                    <Label>{t("Email")}</Label>
                    <Input variant="secondary" placeholder={t("name@company.com")} />
                    <Description>
                      {t("The invitation will be prepared for future delivery.")}
                    </Description>
                    <FieldError />
                  </TextField>

                  <div className="flex flex-col gap-2">
                    <Label>{t("Role")}</Label>
                    <Select
                      aria-label={t("Invitation role")}
                      fullWidth
                      variant="secondary"
                      value={role}
                      onChange={(key) => setRole(String(key ?? "Member") as InviteRole)}
                    >
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {inviteRoles.map((option) => (
                            <ListBox.Item key={option} id={option} textValue={option}>
                              <Label>{t(option)}</Label>
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    <Description>
                      {t("Owner access is reserved for the workspace owner.")}
                    </Description>
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <Button slot="close" type="button" variant="secondary">
                    {t("Cancel")}
                  </Button>
                  <Button type="submit" isDisabled={!email.trim()}>
                    {t("Prepare invite")}
                  </Button>
                </Modal.Footer>
              </Form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal
        isOpen={pendingCancel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingCancel(null);
            setCancelError(null);
          }
        }}
      >
        <ModalTriggerRegistration />
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t("Cancel invitation?")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4">
                {cancelError ? (
                  <FormAlert title={t("Could not cancel invitation")} description={cancelError} />
                ) : null}
                <Typography type="body-sm" color="muted">
                  {t("The pending invitation for {email} will be removed from the team list.", {
                    email: pendingCancel?.email ?? t("this member"),
                  })}
                </Typography>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  {t("Keep invitation")}
                </Button>
                <Button variant="danger" onPress={confirmCancel}>
                  {t("Cancel invitation")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal
        isOpen={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRemove(null);
            setRemoveError(null);
          }
        }}
      >
        <ModalTriggerRegistration />
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t("Remove member from team?")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4">
                {removeError ? (
                  <FormAlert title={t("Could not remove member")} description={removeError} />
                ) : null}
                <Typography type="body-sm" color="muted">
                  {t(
                    "Removing {name} revokes workspace access and removes them from current project assignments. Their tracked time and reports remain available. Restoring access later will not reassign projects automatically.",
                    {
                      name: pendingRemove?.name ?? t("this member"),
                    },
                  )}
                </Typography>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  {t("Keep member")}
                </Button>
                <Button variant="danger" onPress={confirmRemove}>
                  {t("Remove from team")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
