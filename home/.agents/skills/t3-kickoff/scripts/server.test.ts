import { describe, expect, test } from "bun:test";
import { authHeaders, parseDarwinCommand, wsUrl } from "./server.ts";

const app = "/Applications/T3 Code (Nightly).app";
const electron = `${app}/Contents/MacOS/T3 Code (Nightly)`;
const script = `${app}/Contents/Resources/app.asar/apps/server/dist/bin.mjs`;

describe("parseDarwinCommand", () => {
  test("keeps the server script of the desktop app, with spaces in both paths", () => {
    expect(parseDarwinCommand(electron, `${electron} ${script} --bootstrap-fd 3`)).toEqual({ command: electron, args: [script] });
  });

  test("passes a native binary through without a script", () => {
    const t3 = "/Users/michael/.t3/runtime/versions/0.0.42/t3";
    expect(parseDarwinCommand(t3, `${t3} serve`)).toEqual({ command: t3, args: [] });
  });

  test("finds the desktop server after Electron's compile-cache preload", () => {
    const cache = `${app}/Contents/Resources/app.asar/apps/desktop/dist-electron/compileCache.cjs`;
    expect(parseDarwinCommand(electron, `${electron} --require ${cache} ${script} --bootstrap-fd 3`)).toEqual({ command: electron, args: [script] });
  });

  test("refuses an unrecognized desktop command instead of launching the app", () => {
    const cache = `${app}/Contents/Resources/app.asar/apps/desktop/dist-electron/compileCache.cjs`;
    expect(() => parseDarwinCommand(electron, `${electron} --require ${cache} --bootstrap-fd 3`)).toThrow("Cannot identify the T3 desktop server script");
  });
});

describe("orchestration protocol", () => {
  test("HTTP requests declare protocol 2 next to the bearer", () => {
    expect(authHeaders("tok")).toEqual({ authorization: "Bearer tok", "x-t3-orchestration-protocol": "2" });
  });

  test("the WebSocket URL declares protocol 2", () => {
    expect(wsUrl("https://t3.example:3773")).toBe("wss://t3.example:3773/ws?orchestrationProtocol=2");
    expect(wsUrl("http://127.0.0.1:3773")).toBe("ws://127.0.0.1:3773/ws?orchestrationProtocol=2");
  });
});
