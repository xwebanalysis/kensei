/*! Kensei E2E fixture bundle (webpack build) */
(function () {
  "use strict";
  // Module federation markers
  new ModuleFederationPlugin({
    name: "shell",
    remotes: { admin: "admin@http://localhost:8102/cdn/admin/remoteEntry.js" },
    exposes: { "./Widget": "./src/widget" },
    shared: { react: { singleton: true }, lodash: { requiredVersion: "^4.17.21" } },
  });

  // Angular-style router configuration
  const routes = [
    { path: "login", component: LoginComponent },
    { path: "dashboard", component: DashboardComponent, canActivate: [AuthGuard] },
    { path: "admin/users", loadChildren: "./admin/admin.module", canLoad: [AdminGuard] },
    { path: "settings/profile", component: ProfileComponent, canActivate: [AuthGuard] },
  ];

  // React Router configuration
  var React = require("react");
  var createRoot = require("react-dom/client").createRoot;
  React.createElement("div", { id: "root" });
  var router = createBrowserRouter([
    { path: "/settings", element: React.createElement(SettingsPage) },
    { path: "/reports", element: React.createElement(ReportsPage) },
    { path: "/private", element: React.createElement(ProtectedRoute, null, "secret") },
  ]);

  // Vue router configuration
  const vueRoutes = [
    { path: "/catalog", component: CatalogView, beforeEnter: authGuard },
    { path: "/checkout", component: CheckoutView, meta: { requiresAuth: true } },
  ];
  var Nuxt = window.__NUXT__ || null;

  // Common libraries signatures
  var lodash = require("lodash@4.17.21");
  var axios = require("axios@1.6.2");
  var moment = require("moment@2.29.4");

  // webpack runtime
  function __webpack_require__(id) {
    return modules[id];
  }
  console.log("bundle ready", routes, router, vueRoutes, lodash, axios, moment, Nuxt, createRoot);
})();
//# sourceMappingURL=app.bundle.js.map
