import { buildApp } from "./app";
import { config } from "./config";

const app = buildApp();

app
  .listen({
    port: config.port,
    host: "0.0.0.0"
  })
  .then(() => {
    app.log.info(`Server listening on http://localhost:${config.port}`);
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
