import { useCallback, useEffect, useState, type JSX } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  PageContent,
  AppBreadcrumbs,
  Grid,
  Card,
  CardHeader,
  CardContent,
  Typography,
  TextField,
  MenuItem,
  Chip,
  type ChipProps,
  Button,
  Stack,
  List,
  ListItem,
  ListItemText,
  formatRelativeTime,
} from "@wso2/oxygen-ui";
import { ticketApi } from "../api";
import { Can } from "../authz/gates";
import type { components } from "../generated/ticket-api";

type Ticket = components["schemas"]["Ticket"];
type TicketEvent = components["schemas"]["TicketEvent"];
type Urgency = components["schemas"]["Urgency"];

const URGENCIES: Urgency[] = ["Low", "Medium", "High", "Critical"];

function urgencyColor(urgency: Urgency): ChipProps["color"] {
  if (urgency === "Critical" || urgency === "High") return "error";
  if (urgency === "Medium") return "warning";
  return "default";
}

function eventLabel(event: TicketEvent): string {
  return event.detail && event.detail.length > 0 ? event.detail : event.type;
}

// TicketDetail — a ticket's urgency, drafted reply and history (wireframes.dsl).
// Backed by GET /tickets/{id} + GET /tickets/{id}/events, and every write this
// screen offers: override urgency, edit the draft, approve, reject. Neither
// the urgency select nor the draft textarea has a separate "Save" button in
// the wireframe, so each persists on interaction — the select on change, the
// textarea on blur — rather than inventing a control the DSL does not draw.
export function TicketDetailPage(): JSX.Element {
  const { ticketId = "" } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [events, setEvents] = useState<TicketEvent[] | null>(null);
  const [draftText, setDraftText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setNotFound(false);
    const [ticketResult, eventsResult] = await Promise.all([
      ticketApi.GET("/tickets/{ticketId}", { params: { path: { ticketId } } }),
      ticketApi.GET("/tickets/{ticketId}/events", { params: { path: { ticketId } } }),
    ]);
    if (ticketResult.response.status === 404) {
      setNotFound(true);
      return;
    }
    if (ticketResult.error || !ticketResult.data) {
      setError("Could not load this ticket.");
      return;
    }
    setTicket(ticketResult.data);
    setDraftText(ticketResult.data.draftReply ?? "");
    setEvents(eventsResult.data?.data ?? []);
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUrgencyChange(urgency: Urgency) {
    setActionError(null);
    const { data, error: apiError } = await ticketApi.POST("/tickets/{ticketId}/urgency", {
      params: { path: { ticketId } },
      body: { urgency },
    });
    if (apiError || !data) {
      setActionError("Could not override the urgency.");
      return;
    }
    setTicket(data);
    void load();
  }

  async function handleDraftBlur() {
    if (!ticket || draftText === (ticket.draftReply ?? "")) return;
    setActionError(null);
    const { data, error: apiError } = await ticketApi.PUT("/tickets/{ticketId}/draft-reply", {
      params: { path: { ticketId } },
      body: { draftReply: draftText },
    });
    if (apiError || !data) {
      setActionError("Could not save the drafted reply.");
      return;
    }
    setTicket(data);
    void load();
  }

  async function handleApprove() {
    setActionError(null);
    const { error: apiError } = await ticketApi.POST("/tickets/{ticketId}/approve", {
      params: { path: { ticketId } },
    });
    if (apiError) {
      setActionError("Could not approve this ticket.");
      return;
    }
    navigate("/queue");
  }

  async function handleReject() {
    setActionError(null);
    const { error: apiError } = await ticketApi.POST("/tickets/{ticketId}/reject", {
      params: { path: { ticketId } },
    });
    if (apiError) {
      setActionError("Could not reject this ticket.");
      return;
    }
    navigate("/queue");
  }

  if (notFound) {
    return (
      <PageContent>
        <Typography variant="h6">No such ticket</Typography>
      </PageContent>
    );
  }

  if (error) {
    return (
      <PageContent>
        <Typography variant="h6" color="error">
          {error}
        </Typography>
      </PageContent>
    );
  }

  if (!ticket) {
    return (
      <PageContent>
        <Typography>Loading…</Typography>
      </PageContent>
    );
  }

  return (
    <PageContent>
      <AppBreadcrumbs
        items={[
          { key: "queue", label: "Queue", onClick: () => navigate("/queue") },
          { key: "ticket", label: ticket.subject },
        ]}
      />

      {actionError ? (
        <Typography color="error" sx={{ mb: 2 }}>
          {actionError}
        </Typography>
      ) : null}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={3}>
            <Card>
              <CardHeader title={ticket.subject} />
              <CardContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  From: {ticket.sourceSystem ?? "unknown"} | Submitted{" "}
                  {formatRelativeTime(new Date(ticket.createdAt))}
                </Typography>
                <Typography variant="body1">{ticket.body}</Typography>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Drafted Reply" />
              <CardContent>
                <Can
                  op="PUT /tickets/{ticketId}/draft-reply"
                  fallback={
                    <TextField
                      multiline
                      minRows={6}
                      fullWidth
                      label="Edit the drafted reply"
                      value={draftText}
                      slotProps={{ input: { readOnly: true } }}
                    />
                  }
                >
                  <TextField
                    multiline
                    minRows={6}
                    fullWidth
                    label="Edit the drafted reply"
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    onBlur={() => void handleDraftBlur()}
                  />
                </Can>
                <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ mt: 2 }}>
                  <Can op="POST /tickets/{ticketId}/reject">
                    <Button variant="outlined" color="error" onClick={() => void handleReject()}>
                      Reject
                    </Button>
                  </Can>
                  <Can op="POST /tickets/{ticketId}/approve">
                    <Button variant="contained" onClick={() => void handleApprove()}>
                      Approve
                    </Button>
                  </Can>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={3}>
            <Card>
              <CardHeader title="Urgency" />
              <CardContent>
                <Chip
                  label={ticket.urgency}
                  color={urgencyColor(ticket.urgency)}
                  sx={{ mb: 2 }}
                />
                <Can
                  op="POST /tickets/{ticketId}/urgency"
                  fallback={
                    <TextField select label="Override urgency" value={ticket.urgency} fullWidth disabled>
                      {URGENCIES.map((u) => (
                        <MenuItem key={u} value={u}>
                          {u}
                        </MenuItem>
                      ))}
                    </TextField>
                  }
                >
                  <TextField
                    select
                    label="Override urgency"
                    value={ticket.urgency}
                    fullWidth
                    onChange={(e) => void handleUrgencyChange(e.target.value as Urgency)}
                  >
                    {URGENCIES.map((u) => (
                      <MenuItem key={u} value={u}>
                        {u}
                      </MenuItem>
                    ))}
                  </TextField>
                </Can>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="History" />
              <CardContent>
                {events === null ? (
                  <Typography color="text.secondary">Loading…</Typography>
                ) : events.length === 0 ? (
                  <Typography color="text.secondary">No history yet.</Typography>
                ) : (
                  <List disablePadding>
                    {events.map((event) => (
                      <ListItem key={event.id} disableGutters>
                        <ListItemText
                          primary={eventLabel(event)}
                          secondary={formatRelativeTime(new Date(event.createdAt))}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </PageContent>
  );
}
