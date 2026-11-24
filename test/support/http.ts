import express, { Router } from "express";
import http from "http";
import { AddressInfo } from "net";
import { errorHandler } from "../../src";

// Mount a router on a real express app, listen on a random port and return a small HTTP client.
// The client uses a fresh connection per request (no keep-alive), so a socket from an earlier
// test's server can never be reused when the OS hands out the same port again.
export const startApp = async (router: Router, mountPath = "/api") => {
  const app = express();
  app.use(express.json());
  app.use(mountPath, router);
  app.use(errorHandler);

  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;

  const request = (method: string, path: string, body?: unknown) =>
    new Promise<{ status: number; body: any }>((resolve, reject) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          path,
          method,
          agent: false,
          headers: payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {},
        },
        (res) => {
          let text = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => (text += chunk));
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body: text ? JSON.parse(text) : null }));
        },
      );
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });

  const close = () =>
    new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });

  return { request, close };
};
