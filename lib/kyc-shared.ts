/** Pure helpers shared by server KYC logic and client components. */
export type DeclaredIdentityLike = {
  phone: string | null;
  dateOfBirth: string | null;
  gender: "m" | "f" | null;
  stateOfOrigin: string | null;
};

/** The gates need a date of birth and a gender; phone and state are informational. */
export function isDeclarationComplete(d: DeclaredIdentityLike): boolean {
  return !!(d.dateOfBirth && d.gender && d.phone && d.stateOfOrigin);
}
