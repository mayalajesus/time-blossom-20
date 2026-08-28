type BootLocale = "en-US" | "pt-BR";

type BootCopy = {
  loading: string;
  errorTitle: string;
  errorDescription: string;
  retry: string;
};

const bootCopy: Record<BootLocale, BootCopy> = {
  "en-US": {
    loading: "Loading Time Blossom…",
    errorTitle: "Time Blossom could not load",
    errorDescription: "Something went wrong while preparing the app. Try reloading the page.",
    retry: "Reload page",
  },
  "pt-BR": {
    loading: "Carregando o Time Blossom…",
    errorTitle: "O Time Blossom não pôde carregar",
    errorDescription: "Algo deu errado ao preparar o app. Tente recarregar a página.",
    retry: "Recarregar página",
  },
};

function getBootLocale(): BootLocale {
  return document.documentElement.lang === "pt-BR" ? "pt-BR" : "en-US";
}

function showBootError(rootElement: HTMLElement, copy: BootCopy) {
  rootElement.replaceChildren();

  const screen = document.createElement("main");
  screen.className = "app-boot-screen app-boot-screen--error";
  screen.setAttribute("role", "alert");
  screen.setAttribute("aria-live", "assertive");

  const card = document.createElement("section");
  card.className = "app-boot-card";
  card.setAttribute("aria-labelledby", "app-boot-error-title");

  const mark = document.createElement("img");
  mark.className = "app-boot-mark";
  mark.src = "/brand/orbit-symbol.png";
  mark.alt = "";
  mark.setAttribute("aria-hidden", "true");

  const title = document.createElement("h1");
  title.className = "app-boot-title";
  title.id = "app-boot-error-title";
  title.textContent = copy.errorTitle;

  const description = document.createElement("p");
  description.className = "app-boot-message";
  description.textContent = copy.errorDescription;

  const retry = document.createElement("button");
  retry.className = "app-boot-retry";
  retry.type = "button";
  retry.textContent = copy.retry;
  retry.addEventListener("click", () => window.location.reload());

  card.append(mark, title, description, retry);
  screen.append(card);
  rootElement.append(screen);
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Time Blossom could not find the application root.");
}

const copy = bootCopy[getBootLocale()];
rootElement
  .querySelector<HTMLElement>(".app-boot-spinner")
  ?.setAttribute("aria-label", copy.loading);

Promise.all([
  import("react"),
  import("react-dom/client"),
  import("@heroui/react"),
  import("@tanstack/react-router"),
  import("./router"),
])
  .then(async ([react, reactDom, heroui, routerLib, appRouter]) => {
    const router = appRouter.getRouter();
    const appRoot = reactDom.createRoot(rootElement);

    appRoot.render(
      react.createElement(
        "main",
        {
          className: "app-boot-screen",
        },
        react.createElement(heroui.Spinner, {
          size: "lg",
          "aria-label": copy.loading,
          className: "motion-reduce:animate-none",
        }),
      ),
    );

    await router.load();
    appRoot.render(
      react.createElement(
        react.StrictMode,
        null,
        react.createElement(routerLib.RouterProvider, { router }),
      ),
    );
  })
  .catch((error) => {
    console.error(error);
    showBootError(rootElement, copy);
  });
