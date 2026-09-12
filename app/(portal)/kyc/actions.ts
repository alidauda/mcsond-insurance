"use server";

import { revalidatePath } from "next/cache";
import { requireCustomer } from "@/lib/server-session";
import { runKycVerification, type KycResult, type KycInput } from "@/lib/kyc";
import type { KycMethod } from "@/lib/swiftcheck";

export type KycState = (KycResult & { ok: boolean }) | null;

const METHODS: KycMethod[] = ["nin", "phone", "shareCode", "demography"];

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function fail(message: string): KycState {
  return { ok: false, outcome: "failed", message, nameMatchScore: null };
}

/** Customer runs an identity check on their own account. */
export async function verifyIdentity(_prev: KycState, formData: FormData): Promise<KycState> {
  const me = await requireCustomer();

  const method = str(formData, "method") as KycMethod;
  if (!METHODS.includes(method)) return fail("Choose a verification method.");

  let input: KycInput;
  switch (method) {
    case "nin": {
      const nin = str(formData, "nin").replace(/\s/g, "");
      if (!/^\d{11}$/.test(nin)) return fail("Enter your 11-digit National Identification Number.");
      input = { method, nin };
      break;
    }
    case "phone": {
      const phone = str(formData, "phone").replace(/[\s-]/g, "");
      if (!/^0\d{10}$/.test(phone)) return fail("Enter an 11-digit phone number starting with 0.");
      input = { method, phone };
      break;
    }
    case "shareCode": {
      const shareCode = str(formData, "shareCode").replace(/\s/g, "").toUpperCase();
      if (shareCode.length < 4) return fail("Enter the share code from your NIMC app.");
      input = { method, shareCode };
      break;
    }
    case "demography": {
      const firstName = str(formData, "firstName");
      const lastName = str(formData, "lastName");
      const dob = str(formData, "dateOfBirth"); // yyyy-mm-dd from the date input
      const gender = str(formData, "gender");
      if (firstName.length < 2 || lastName.length < 2) return fail("Enter your first and last name.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return fail("Choose your date of birth.");
      if (gender !== "m" && gender !== "f") return fail("Choose your gender.");
      const [y, m, d] = dob.split("-");
      input = { method, firstName, lastName, dateOfBirth: `${d}-${m}-${y}`, gender };
      break;
    }
  }

  const result = await runKycVerification({ userId: me.id, input });

  revalidatePath("/kyc");
  revalidatePath("/dashboard");
  revalidatePath("/insurance");
  revalidatePath("/admin/users");
  return { ...result, ok: result.outcome !== "failed" };
}
