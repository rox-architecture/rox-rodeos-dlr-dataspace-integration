#!/usr/bin/env node
/**
 * Launch the RODEOS Semantic Model Generator as a local kiosk app:
 * starts the production Next.js server and opens a Chromium-based browser
 * in fullscreen kiosk mode on macOS, Windows and Linux.
 *
 * Usage:
 *   npm run build      (once, or after changes)
 *   npm run kiosk
 *
 * Options via env:
 *   PORT=3000              server port
 *   KIOSK_BROWSER=/path    explicit browser binary
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const PORT = process.env.PORT || "3000";
const URL = `http://localhost:${PORT}`;

function findBrowser() {
  if (process.env.KIOSK_BROWSER) return { cmd: process.env.KIOSK_BROWSER, args: [] };

  const platform = os.platform();
  const candidates =
    platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
          "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
          "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        ]
      : platform === "win32"
        ? [
            path.join(process.env["ProgramFiles"] ?? "C:\\Program Files", "Google/Chrome/Application/chrome.exe"),
            path.join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Google/Chrome/Application/chrome.exe"),
            path.join(process.env["ProgramFiles"] ?? "C:\\Program Files", "Microsoft/Edge/Application/msedge.exe"),
            path.join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Microsoft/Edge/Application/msedge.exe"),
          ]
        : []; // linux: resolved via PATH below

  for (const c of candidates) if (existsSync(c)) return { cmd: c, args: [] };

  // Fall back to PATH lookup (covers Linux and package-manager installs)
  const names =
    platform === "win32"
      ? ["chrome", "msedge"]
      : ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "brave-browser"];
  const probe = platform === "win32" ? "where" : "which";
  for (const name of names) {
    const res = spawnSync(probe, [name], { encoding: "utf8" });
    if (res.status === 0 && res.stdout.trim()) {
      return { cmd: res.stdout.trim().split(/\r?\n/)[0], args: [] };
    }
  }
  return null;
}

function waitForServer(url, timeoutMs = 30_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Server did not start within ${timeoutMs / 1000}s`));
        } else {
          setTimeout(tick, 400);
        }
      });
    };
    tick();
  });
}

async function main() {
  console.log(`▶ Starting RODEOS server on ${URL} …`);
  const isWin = os.platform() === "win32";
  const server = spawn(isWin ? "npx.cmd" : "npx", ["next", "start", "-p", PORT], {
    stdio: "inherit",
    shell: isWin,
  });

  const shutdown = () => {
    if (!server.killed) server.kill("SIGTERM");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  server.on("exit", (code) => {
    console.log(`Server exited (${code ?? "signal"}).`);
    process.exit(code ?? 0);
  });

  try {
    await waitForServer(URL);
  } catch (err) {
    console.error(`✖ ${err.message} — did you run "npm run build" first?`);
    server.kill("SIGTERM");
    process.exit(1);
  }

  const browser = findBrowser();
  if (!browser) {
    console.log(
      `⚠ No Chromium-based browser found. Open ${URL} manually and press the fullscreen button in the app,\n  or set KIOSK_BROWSER=/path/to/browser.`
    );
    return;
  }

  console.log(`▶ Opening kiosk window (${path.basename(browser.cmd)}) …`);
  const kioskProfile = path.join(os.tmpdir(), "rodeos-kiosk-profile");
  spawn(
    browser.cmd,
    [
      `--app=${URL}`,
      "--kiosk",
      "--start-fullscreen",
      `--user-data-dir=${kioskProfile}`,
      "--no-first-run",
      "--disable-session-crashed-bubble",
      ...browser.args,
    ],
    { stdio: "ignore", detached: false }
  );
  console.log("  Exit kiosk mode with Cmd+Q / Alt+F4; stop the server with Ctrl+C.");
}

main();
