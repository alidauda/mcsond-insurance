/** The 36 states and the FCT, as they appear on NIMC records. */
export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo",
  "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa",
  "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba",
  "Yobe", "Zamfara",
] as const;

export type NigerianState = (typeof NIGERIAN_STATES)[number];

export function isNigerianState(v: string): v is NigerianState {
  return (NIGERIAN_STATES as readonly string[]).includes(v);
}

/** Normalise an 11-digit local number or +234 form to 0XXXXXXXXXX. */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (/^0\d{10}$/.test(digits)) return digits;
  if (/^234\d{10}$/.test(digits)) return `0${digits.slice(3)}`;
  return null;
}
