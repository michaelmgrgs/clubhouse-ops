import { prisma } from "@/lib/db";
import ClubhouseEditor from "./ClubhouseEditor";

export default async function ClubhousesPage() {
  const clubs = await prisma.clubhouse.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div className="stack-lg">
      <div className="a-head">
        <div className="stack-sm">
          <h1>Clubhouses & geofences</h1>
          <p className="muted small">
            The manager can only check in and submit anything while their phone&apos;s GPS is inside this circle.
          </p>
        </div>
      </div>
      <div className="banner info small">
        Easiest way to set a location: open this page on your phone while standing in the middle of the clubhouse and tap “Use my current location”.
        Or right-click the building in Google Maps, copy the coordinates and paste them here.
      </div>
      {clubs.map((c) => (
        <ClubhouseEditor key={c.id} club={c} />
      ))}
    </div>
  );
}
