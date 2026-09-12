"use client";

import { useActionState } from "react";
import { Card, SectionTitle, Button, Badge, cx } from "@/components/ui";
import { savePaystackKeys, type SettingsResult } from "./actions";
import type { PaystackSettings } from "@/lib/settings";

const fieldLabel =
  "mb-2 block font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted";
const fieldInput =
  "h-12 w-full rounded-[10px] border border-line bg-surface px-3.5 font-mono text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-navy";

const SOURCE_TONE = {
  "Admin settings": "success",
  Environment: "neutral",
  "Not set": "warning",
} as const;

/** Editable Paystack keys. The secret field is write-only — see savePaystackKeys. */
export function PaystackSettingsForm({ settings }: { settings: PaystackSettings }) {
  const [state, formAction, pending] = useActionState<SettingsResult, FormData>(
    savePaystackKeys,
    null,
  );

  return (
    <Card className="p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle className="text-xl">Paystack keys</SectionTitle>
        <Badge tone={SOURCE_TONE[settings.source]}>{settings.source}</Badge>
      </div>

      <form action={formAction} className="mt-6 flex flex-col gap-5">
        <div>
          <label className={fieldLabel} htmlFor="publicKey">
            Public key
          </label>
          <input
            id="publicKey"
            name="publicKey"
            defaultValue={settings.publicKey}
            placeholder="pk_live_…"
            autoComplete="off"
            className={fieldInput}
          />
        </div>

        <div>
          <label className={fieldLabel} htmlFor="secretKey">
            Secret key
          </label>
          <input
            id="secretKey"
            name="secretKey"
            type="password"
            autoComplete="new-password"
            placeholder={settings.secretKeySet ? `${settings.secretKeyMasked} — leave blank to keep` : "sk_live_…"}
            className={fieldInput}
          />
          <p className="mt-2 text-xs text-muted">
            Stored server-side and never shown again. Leave blank to keep the current key.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Button type="submit" variant="primary" icon="check" disabled={pending}>
            {pending ? "Saving…" : "Save keys"}
          </Button>
          {state && (
            <p className={cx("text-sm font-medium", state.ok ? "text-success" : "text-crimson")}>
              {state.message}
            </p>
          )}
        </div>
      </form>
    </Card>
  );
}
