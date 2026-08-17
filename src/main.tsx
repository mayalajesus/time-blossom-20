const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Time Blossom could not find the application root.");
}

rootElement.textContent = "Loading Time Blossom…";

Promise.all([
  import("react"),
  import("react-dom/client"),
  import("@tanstack/react-router"),
  import("./router"),
])
  .then(async ([react, reactDom, routerLib, appRouter]) => {
    const router = appRouter.getRouter();
    rootElement.textContent = "Preparing your workspace…";
    await router.load();
    reactDom
      .createRoot(rootElement)
      .render(
        react.createElement(
          react.StrictMode,
          null,
          react.createElement(routerLib.RouterProvider, { router }),
        ),
      );
  })
  .catch((error) => {
    console.error(error);
    rootElement.textContent = `Time Blossom could not load: ${String(error)}`;
  });
