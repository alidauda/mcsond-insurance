import { getCustomerTickets } from "@/lib/support";
import SupportClient from "./SupportClient";

export default async function SupportPage() {
  const customerTickets = await getCustomerTickets();

  return <SupportClient customerTickets={customerTickets} />;
}
