"use client";

import { useActionState, useState, useTransition } from "react";
import { Card, SectionTitle, Button, Badge, cx } from "@/components/ui";
import { saveSwiftCheckCredentials, testSwiftCheckConnection, type SettingsResult } from "./actions";
import type { SwiftCheckSettings } from "@/lib/settings";

const fieldLabel = "mb-2 block font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted";
const fieldInput =
  "h-12 w-full rounded-[10px] border border-line bg-surface px-3.5 font-mono text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-navy";

const SOURCE_TONE = {
  "Admin settings": "success",
  Environment: "neutral",
  "Not set": "warning",
} as const;

/** SwiftCheck (NIN identity verification) credentials. The secret is write-only. */
export function SwiftCheckSettingsForm({ settings }: { settings: SwiftCheckSettings }) {
  const [state, formAction, pending] = useActionState<SettingsResult, FormData>(saveSwiftCheckCredentials, null);
  const [testing, startTest] = useTransition();
  const [testResult, setTestResult] = useState<SettingsResult>(null);

  return (
    <Card className="p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle className="text-xl">SwiftCheck identity API</SectionTitle>
        <Badge tone={SOURCE_TONE[settings.source]}>{settings.source}</Badge>
      </div>
      <p className="mt-2 text-sm text-muted">
        NIN verification through SwiftLink&rsquo;s gateway. Customers verify themselves on the Identity check
        page; cover cannot be bound until they do.
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-5">
        <div>
          <label className={fieldLabel} htmlFor="scBaseUrl">
            Base URL
          </label>
          <input
            id="scBaseUrl"
            name="baseUrl"
            defaultValue={settings.baseUrl}
            placeholder="https://swiftcheck-dev.swiftlink.ng"
            autoComplete="off"
            className={fieldInput}
          />
          <p className="mt-2 text-xs text-muted">
            Use <span className="font-mono">swiftcheck-dev</span> for testing and{" "}
            <span className="font-mono">swiftcheck-prod</span> when live.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={fieldLabel} htmlFor="scClientId">
              Client ID
            </label>
            <input
              id="scClientId"
              name="clientId"
              defaultValue={settings.clientId}
              placeholder="ak_test_…"
              autoComplete="off"
              className={fieldInput}
            />
          </div>
          <div>
            <label className={fieldLabel} htmlFor="scClientSecret">
              Client secret
            </label>
            <input
              id="scClientSecret"
              name="clientSecret"
              type="password"
              autoComplete="new-password"
              placeholder={settings.clientSecretSet ? `${settings.clientSecretMasked} — leave blank to keep` : "sk_test_…"}
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
                setTestResult(await testSwiftCheckConnection());
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
