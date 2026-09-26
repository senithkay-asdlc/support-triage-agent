import type { JSX } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  AppShell as OxygenAppShell,
  Header,
  Sidebar,
  Footer,
  UserMenu,
  ColorSchemeToggle,
  Divider,
} from "@wso2/oxygen-ui";
import { LogOut, Ticket } from "@wso2/oxygen-ui-icons-react";
import { APP_NAME } from "../appName";
import { Can, useAuthz } from "../authz/gates";
import { signOut } from "../authz/session";

// The sample's AppLayout, adapted to this app's one wireframe screen family:
// navbar "Support Triage" + sidebar "Queue -> TicketQueue" on every screen
// (wireframes.dsl). TicketDetail is reached only by clicking a queue row, so
// it carries no sidebar item of its own — the rail is one item, gated on the
// operation it loads.
export function AppShell(): JSX.Element {
  const { pathname } = useLocation();
  const { username } = useAuthz();
  const active = pathname.startsWith("/queue") || pathname.startsWith("/tickets") ? "queue" : "";

  return (
    <OxygenAppShell>
      <OxygenAppShell.Navbar>
        <Header>
          <Header.Toggle />
          <Header.Brand>
            <Header.BrandTitle>{APP_NAME}</Header.BrandTitle>
          </Header.Brand>
          <Header.Spacer />
          <Header.Actions>
            <ColorSchemeToggle />
            <Divider orientation="vertical" flexItem sx={{ mx: 2 }} />
            <UserMenu>
              <UserMenu.Trigger name={username || "Signed in"} />
              <UserMenu.Header name={username || "Signed in"} email={username} />
              <UserMenu.Item icon={<LogOut />} label="Sign out" onClick={() => void signOut()} />
            </UserMenu>
          </Header.Actions>
        </Header>
      </OxygenAppShell.Navbar>

      <OxygenAppShell.Sidebar>
        <Sidebar activeItem={active}>
          <Sidebar.Nav>
            <Sidebar.Category>
              <Can op="GET /tickets">
                <Sidebar.Item id="queue" link={<Link to="/queue" />}>
                  <Sidebar.ItemIcon>
                    <Ticket />
                  </Sidebar.ItemIcon>
                  <Sidebar.ItemLabel>Queue</Sidebar.ItemLabel>
                </Sidebar.Item>
              </Can>
            </Sidebar.Category>
          </Sidebar.Nav>
        </Sidebar>
      </OxygenAppShell.Sidebar>

      <OxygenAppShell.Main>
        <Outlet />
      </OxygenAppShell.Main>

      <OxygenAppShell.Footer>
        <Footer>
          <Footer.Copyright>© WSO2 LLC.</Footer.Copyright>
        </Footer>
      </OxygenAppShell.Footer>
    </OxygenAppShell>
  );
}
