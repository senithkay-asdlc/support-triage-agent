import { useEffect, useMemo, useState, type JSX } from "react";
import { useNavigate } from "react-router-dom";
import {
  PageContent,
  PageTitle,
  ListingTable,
  TextField,
  MenuItem,
  Chip,
  type ChipProps,
  formatRelativeTime,
} from "@wso2/oxygen-ui";
import { ticketApi } from "../api";
import type { components } from "../generated/ticket-api";

type Ticket = components["schemas"]["Ticket"];
type Urgency = components["schemas"]["Urgency"];
type TicketStatus = components["schemas"]["TicketStatus"];

const URGENCIES: Urgency[] = ["Low", "Medium", "High", "Critical"];
const STATUSES: TicketStatus[] = ["new", "triaged", "approved", "rejected"];

function urgencyColor(urgency: Urgency): ChipProps["color"] {
  if (urgency === "Critical" || urgency === "High") return "error";
  if (urgency === "Medium") return "warning";
  return "default";
}

function statusColor(status: TicketStatus): ChipProps["color"] {
  if (status === "approved") return "success";
  if (status === "rejected") return "error";
  if (status === "triaged") return "info";
  return "default";
}

function statusLabel(status: TicketStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// TicketQueue — the shared queue of incoming tickets, newest first
// (wireframes.dsl). Backed by GET /tickets, filterable server-side by
// urgency/status. The contract has no separate `search` query param, so the
// subject search box filters the already-fetched page client-side rather than
// inventing one the API does not declare.
export function TicketQueuePage(): JSX.Element {
  const navigate = useNavigate();
  const [urgency, setUrgency] = useState<Urgency | "">("");
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [search, setSearch] = useState("");
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setTickets(null);
    setError(null);
    void ticketApi
      .GET("/tickets", {
        params: {
          query: {
            ...(urgency ? { urgency } : {}),
            ...(status ? { status } : {}),
          },
        },
      })
      .then(({ data, error: apiError }) => {
        if (!live) return;
        if (apiError) {
          setError("Could not load the ticket queue.");
          return;
        }
        setTickets(data?.data ?? []);
      })
      .catch(() => {
        if (live) setError("Could not load the ticket queue.");
      });
    return () => {
      live = false;
    };
  }, [urgency, status]);

  const filtered = useMemo(() => {
    if (!tickets) return null;
    const needle = search.trim().toLowerCase();
    if (!needle) return tickets;
    return tickets.filter((t) => t.subject.toLowerCase().includes(needle));
  }, [tickets, search]);

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Ticket Queue</PageTitle.Header>
      </PageTitle>

      <ListingTable.Container>
        <ListingTable.Toolbar
          showSearch
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search tickets"
          actions={
            <>
              <TextField
                select
                label="Filter by urgency"
                size="small"
                sx={{ minWidth: 180 }}
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as Urgency | "")}
              >
                <MenuItem value="">All urgencies</MenuItem>
                {URGENCIES.map((u) => (
                  <MenuItem key={u} value={u}>
                    {u}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Filter by status"
                size="small"
                sx={{ minWidth: 180 }}
                value={status}
                onChange={(e) => setStatus(e.target.value as TicketStatus | "")}
              >
                <MenuItem value="">All statuses</MenuItem>
                {STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {statusLabel(s)}
                  </MenuItem>
                ))}
              </TextField>
            </>
          }
        />
        <ListingTable>
          <ListingTable.Head>
            <ListingTable.Row>
              <ListingTable.Cell>Subject</ListingTable.Cell>
              <ListingTable.Cell>Urgency</ListingTable.Cell>
              <ListingTable.Cell>Status</ListingTable.Cell>
              <ListingTable.Cell>Submitted</ListingTable.Cell>
            </ListingTable.Row>
          </ListingTable.Head>
          <ListingTable.Body>
            {error ? (
              <ListingTable.Row>
                <ListingTable.Cell colSpan={4}>
                  <ListingTable.EmptyState title="Could not load tickets" description={error} />
                </ListingTable.Cell>
              </ListingTable.Row>
            ) : filtered === null ? (
              <ListingTable.Row>
                <ListingTable.Cell colSpan={4}>
                  <ListingTable.EmptyState title="Loading…" description="Fetching the ticket queue" />
                </ListingTable.Cell>
              </ListingTable.Row>
            ) : filtered.length === 0 ? (
              <ListingTable.Row>
                <ListingTable.Cell colSpan={4}>
                  <ListingTable.EmptyState
                    title="No tickets"
                    description="No tickets match these filters."
                  />
                </ListingTable.Cell>
              </ListingTable.Row>
            ) : (
              filtered.map((ticket) => (
                <ListingTable.Row
                  key={ticket.id}
                  clickable
                  onClick={() => navigate(`/tickets/${ticket.id}`)}
                >
                  <ListingTable.Cell>{ticket.subject}</ListingTable.Cell>
                  <ListingTable.Cell>
                    <Chip label={ticket.urgency} color={urgencyColor(ticket.urgency)} size="small" />
                  </ListingTable.Cell>
                  <ListingTable.Cell>
                    <Chip label={statusLabel(ticket.status)} color={statusColor(ticket.status)} size="small" />
                  </ListingTable.Cell>
                  <ListingTable.Cell>{formatRelativeTime(new Date(ticket.createdAt))}</ListingTable.Cell>
                </ListingTable.Row>
              ))
            )}
          </ListingTable.Body>
        </ListingTable>
      </ListingTable.Container>
    </PageContent>
  );
}
