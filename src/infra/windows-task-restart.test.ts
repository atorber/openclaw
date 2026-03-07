import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { captureFullEnv } from "../test-utils/env.js";

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

import { relaunchGatewayScheduledTask } from "./windows-task-restart.js";

const envSnapshot = captureFullEnv();
const createdScriptPaths = new Set<string>();

afterEach(() => {
  envSnapshot.restore();
  spawnMock.mockReset();
  for (const scriptPath of createdScriptPaths) {
    try {
      fs.unlinkSync(scriptPath);
    } catch {
      // Best-effort cleanup for temp helper scripts created in tests.
    }
  }
  createdScriptPaths.clear();
});

describe("relaunchGatewayScheduledTask", () => {
  it("writes a detached schtasks relaunch helper", () => {
    const unref = vi.fn();
    spawnMock.mockImplementation((_file: string, args: string[]) => {
      createdScriptPaths.add(args[2]);
      return { unref };
    });

    const result = relaunchGatewayScheduledTask({ OPENCLAW_PROFILE: "work" });

    expect(result).toMatchObject({
      ok: true,
      method: "schtasks",
      tried: expect.arrayContaining(['schtasks /Run /TN "OpenClaw Gateway (work)"']),
    });
    expect(spawnMock).toHaveBeenCalledWith(
      "cmd.exe",
      ["/d", "/c", expect.any(String)],
      expect.objectContaining({
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }),
    );
    expect(unref).toHaveBeenCalledOnce();

    const scriptPath = [...createdScriptPaths][0];
    expect(scriptPath).toBeTruthy();
    const script = fs.readFileSync(scriptPath, "utf8");
    expect(script).toContain("timeout /t 1 /nobreak >nul");
    expect(script).toContain('schtasks /Run /TN "OpenClaw Gateway (work)" >nul 2>&1');
    expect(script).toContain('del "%~f0" >nul 2>&1');
  });

  it("prefers OPENCLAW_WINDOWS_TASK_NAME overrides", () => {
    spawnMock.mockImplementation((_file: string, args: string[]) => {
      createdScriptPaths.add(args[2]);
      return { unref: vi.fn() };
    });

    relaunchGatewayScheduledTask({
      OPENCLAW_PROFILE: "work",
      OPENCLAW_WINDOWS_TASK_NAME: "OpenClaw Gateway (custom)",
    });

    const scriptPath = [...createdScriptPaths][0];
    const script = fs.readFileSync(scriptPath, "utf8");
    expect(script).toContain('schtasks /Run /TN "OpenClaw Gateway (custom)" >nul 2>&1');
  });

  it("returns failed when the helper cannot be spawned", () => {
    spawnMock.mockImplementation(() => {
      throw new Error("spawn failed");
    });

    const result = relaunchGatewayScheduledTask({ OPENCLAW_PROFILE: "work" });

    expect(result.ok).toBe(false);
    expect(result.method).toBe("schtasks");
    expect(result.detail).toContain("spawn failed");
  });
});
