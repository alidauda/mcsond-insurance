"use client";

import { useActionState, useState, useTransition } from "react";
import { Card, SectionTitle, Button, Badge, cx } from "@/components/ui";
import { saveNemCredentials, testNemConnection, type SettingsResult } from "./actions";
import type { NemSettings } from "@/lib/settings";

const fieldLabel =
  "mb-2 block font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted";
const fieldInput =
  "h-12 w-full rounded-[10px] border border-line bg-surface px-3.5 font-mono text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-navy";

const SOURCE_TONE = {
  "Admin settings": "success",
  Environment: "neutral",
  "Not set": "warning",
} as const;

/** NEM eInsurance broker credentials. Password and API key are write-only. */
export function NemSettingsForm({ settings }: { settings: NemSettings }) {
  const [state, formAction, pending] = useActionState<SettingsResult, FormData>(saveNemCredentials, null);
  const [testing, startTest] = useTransition();
  const [testResult, setTestResult] = useState<SettingsResult>(null);

  return (
    <Card className="p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle className="text-xl">NEM Insurance API</SectionTitle>
        <Badge tone={SOURCE_TONE[settings.source]}>{settings.source}</Badge>
      </div>
      <p className="mt-2 text-sm text-muted">
        Retail broker credentials for NEM&rsquo;s eInsurance API. Motor plans marked
        &ldquo;NEM&rdquo; are priced and issued live through this connection.
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-5">
        <div>
          <label className={fieldLabel} htmlFor="nemBaseUrl">
            Base URL
          </label>
          <input
            id="nemBaseUrl"
            name="baseUrl"
            defaultValue={settings.baseUrl}
            placeholder="https://sandbox.einsurance.nem-insurance.com"
            autoComplete="off"
            className={fieldInput}
          />
          <p className="mt-2 text-xs text-muted">Sandbox for testing; swap to NEM&rsquo;s production host when live.</p>
        </div>

        <div>
          <label className={fieldLabel} htmlFor="nemUsername">
            Broker username
          </label>
          <input
            id="nemUsername"
            name="username"
            defaultValue={settings.username}
            placeholder="broker@yourdomain.ng"
            autoComplete="off"
            className={fieldInput}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={fieldLabel} htmlFor="nemPassword">
              Broker password
            </label>
            <input
              id="nemPassword"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder={settings.passwordSet ? "•••••••• — leave blank to keep" : "password"}
              className={fieldInput}
            />
          </div>
          <div>
            <label className={fieldLabel} htmlFor="nemApiKey">
              API key
            </label>
            <input
              id="nemApiKey"
              name="apiKey"
              type="password"
              autoComplete="new-password"
              placeholder={settings.apiKeySet ? `${settings.apiKeyMasked} — leave blank to keep` : "API key from NEM"}
              className={fieldInput}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" variant="primary" icon="check" disabled={pending}>
            {pending ? "Saving…" : "Save credentials"}
          </Button>
          <Button
            type="button"
            variant="outline"
            icon="external"
            disabled={testing}
            onClick={() =>
              startTest(async () => {
                setTestResult(null);
                setTestResult(await testNemConnection());
              })
            }
          >
            {testing ? "Testing…" : "Test connection"}
          </Button>
          {state && (
            <p className={cx("text-sm font-medium", state.ok ? "text-success" : "text-crimson")}>{state.message}</p>
          )}
        </div>
        {testResult && (
          <p className={cx("text-sm font-medium", testResult.ok ? "text-success" : "text-crimson")}>
            {testResult.message}
          </p>
        )}
      </form>
    </Card>
  );
}
