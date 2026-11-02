import { Suspense, lazy } from 'react';
import type { ReactNode } from 'react';
import {
  Navigate,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Permission } from '@h-os/contracts';
import { hasPermission, useSession } from '@h-os/web-client';
import {
  AppShell,
  BootScreen,
  ForbiddenScreen,
  NotFoundScreen,
  SessionErrorScreen,
} from './shell/app-shell.js';
import { HomeScreen } from './screens/home.js';
import { LoginScreen } from './screens/login.js';

/**
 * App screens are split per route so the shell stays small. `React.lazy` is used instead of the
 * router's `lazyRouteComponent` because the latter re-enters `use()` across renders in React 19
 * and logs a dev warning; `Suspense` below renders the fallback while a chunk loads.
 */
const EmployeesListScreen = lazy(() =>
  import('@h-os/hr-web/screens/employees-list').then((module) => ({
    default: module.EmployeesListScreen,
  })),
);
const EmployeeNewScreen = lazy(() =>
  import('@h-os/hr-web/screens/employee-new').then((module) => ({
    default: module.EmployeeNewScreen,
  })),
);
const EmployeeProfileScreen = lazy(() =>
  import('@h-os/hr-web/screens/employee-profile').then((module) => ({
    default: module.EmployeeProfileScreen,
  })),
);
const OrganizationScreen = lazy(() =>
  import('@h-os/hr-web/screens/organization').then((module) => ({
    default: module.OrganizationScreen,
  })),
);
const MyProfileScreen = lazy(() =>
  import('@h-os/hr-web/screens/my-profile').then((module) => ({
    default: module.MyProfileScreen,
  })),
);

/** Fallback shown inside the shell while a route chunk is still downloading. */
function ScreenFallback(): ReactNode {
  const { t } = useTranslation();
  return (
    <p role="status" className="py-10 text-center text-sm text-ink-muted">
      {t('common.loading')}
    </p>
  );
}

/**
 * Shell frame. While the session is unknown the shell renders a neutral boot state; an anonymous
 * caller sees the sign-in screen, never a private screen (UX-008). App routes stay mounted behind
 * one authentication boundary, so switching apps never reloads the page (UX-003).
 */
function RootLayout(): ReactNode {
  const session = useSession();

  if (session.status === 'loading') return <BootScreen />;
  if (session.status === 'error') {
    return <SessionErrorScreen onRetry={() => void session.reload()} />;
  }
  if (session.status === 'anonymous') return <LoginScreen />;

  return (
    <AppShell>
      <Suspense fallback={<ScreenFallback />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}

/**
 * Route-level permission gate. It is a usability boundary only: every API call is authorized
 * again on the server with the caller's data scope (SEC-002, UX-002).
 */
function Guarded({
  permission,
  children,
}: {
  readonly permission: Permission;
  readonly children: ReactNode;
}): ReactNode {
  const { user } = useSession();
  if (!hasPermission(user, permission)) return <ForbiddenScreen />;
  return <>{children}</>;
}

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundScreen,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomeScreen,
});

/** Redirect /apps/hr to the main HR module screen */
const appsHrRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/apps/hr',
  component: () => <Navigate to="/employees" replace />,
});

const employeesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/employees',
  component: () => (
    <Guarded permission={Permission.HR_EMPLOYEE_READ}>
      <EmployeesListScreen />
    </Guarded>
  ),
});

const employeeNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/employees/new',
  component: () => (
    <Guarded permission={Permission.HR_EMPLOYEE_CREATE}>
      <EmployeeNewScreen />
    </Guarded>
  ),
});

const employeeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/employees/$employeeId',
  component: EmployeeProfileRoute,
});

function EmployeeProfileRoute(): ReactNode {
  const { employeeId } = employeeRoute.useParams();
  return (
    <Guarded permission={Permission.HR_EMPLOYEE_READ}>
      <EmployeeProfileScreen employeeId={employeeId} />
    </Guarded>
  );
}

const organizationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/organization',
  component: () => (
    <Guarded permission={Permission.HR_ORGANIZATION_READ}>
      <OrganizationScreen />
    </Guarded>
  ),
});

const meRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/me',
  component: () => (
    <Guarded permission={Permission.HR_EMPLOYEE_READ}>
      <MyProfileScreen />
    </Guarded>
  ),
});

/**
 * `/login` exists as a stable deep link, but the shell already shows the sign-in screen to an
 * anonymous caller. An authenticated visit is not a second login; it returns home (UX-001).
 */
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: () => <Navigate to="/" replace />,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  appsHrRoute,
  employeesRoute,
  employeeNewRoute,
  employeeRoute,
  organizationRoute,
  meRoute,
  loginRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
