import {
  getAdminKpis,
  getVolumeByCategory,
  getGwpByUnderwriter,
  getLiveEvents,
  getServiceHealth,
} from "@/lib/admin-overview";
import { AdminOverview } from "./AdminOverview";

export default async function AdminOverviewPage() {
  const [adminKpis, volumeByCategory, gwpByUnderwriter, liveEvents, serviceHealth] =
    await Promise.all([
      getAdminKpis(),
      getVolumeByCategory(),
      getGwpByUnderwriter(),
      getLiveEvents(),
      getServiceHealth(),
    ]);

  return (
    <AdminOverview
      adminKpis={adminKpis}
      volumeByCategory={volumeByCategory}
      gwpByUnderwriter={gwpByUnderwriter}
      liveEvents={liveEvents}
      serviceHealth={serviceHealth}
    />
  );
}
