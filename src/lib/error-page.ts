export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>We couldn't load this page</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <main>
      <h1>We couldn't load this page</h1>
      <p>Try again, or go back to the home page.</p>
      <div>
        <button type="button" onclick="location.reload()">Try again</button>
        <a href="/">Go home</a>
      </div>
    </main>
  </body>
</html>`;
}
