"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { CronJob } from "@/lib/types";

export default function SettingsPage() {
  const [crons, setCrons] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadCrons = async () => {
    try {
      const data = await api.crons();
      setCrons(data.crons);
    } catch {
      // keep stale
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCrons();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleRunCron = async (name: string) => {
    try {
      const res = await api.runCron(name);
      showToast(res.success ? `Triggered ${name}` : "Failed");
      await loadCrons();
    } catch {
      showToast("Error triggering cron");
    }
  };

  const handleConfigSync = async () => {
    setSyncing(true);
    try {
      const res = await api.configSync();
      showToast(
        res.success
          ? "Config sync broadcast sent"
          : "Config sync failed"
      );
    } catch {
      showToast("Error sending config sync");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {toast && (
        <div className="bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-md text-sm">
          {toast}
        </div>
      )}

      {/* Config sync */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold mb-2">Config Sync</h2>
        <p className="text-sm text-zinc-400 mb-4">
          Broadcast a config update to all connected agents, prompting them to
          re-validate their gateway configuration.
        </p>
        <button
          onClick={handleConfigSync}
          disabled={syncing}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          {syncing ? "Broadcasting..." : "Broadcast Config Sync"}
        </button>
      </section>

      {/* Cron jobs */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Cron Jobs</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-zinc-500 uppercase border-b border-zinc-800">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Schedule</th>
                <th className="px-4 py-3 text-left">Enabled</th>
                <th className="px-4 py-3 text-left">Last Run</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    Loading...
                  </td>
                </tr>
              ) : crons.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    No cron jobs
                  </td>
                </tr>
              ) : (
                crons.map((cron) => (
                  <tr key={cron.id} className="hover:bg-zinc-800/30">
                    <td className="px-4 py-3 text-sm font-medium">
                      {cron.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400 font-mono">
                      {cron.schedule}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium ${
                          cron.enabled ? "text-emerald-400" : "text-zinc-500"
                        }`}
                      >
                        {cron.enabled ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {cron.last_run_at
                        ? new Date(cron.last_run_at).toLocaleString()
                        : "--"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs ${
                          cron.last_status === "ok"
                            ? "text-emerald-400"
                            : cron.last_status === "error"
                            ? "text-red-400"
                            : "text-zinc-500"
                        }`}
                      >
                        {cron.last_status || "--"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleRunCron(cron.name)}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Run Now
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* System info */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold mb-2">System Info</h2>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500">King URL</span>
            <span className="text-zinc-300 font-mono">
              {process.env.NEXT_PUBLIC_KING_URL || "(same origin)"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Dashboard</span>
            <span className="text-zinc-300">evo-dashboard v0.1.0</span>
          </div>
        </div>
      </section>
    </div>
  );
}
