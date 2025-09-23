import EnhancedOverview from "./EnhancedOverview";

export default function Overview({ dealerId }: { dealerId: string }) {
  return <EnhancedOverview dealerId={dealerId} />;
}