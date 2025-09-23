import PremiumDealershipDashboard from '../../../components/PremiumDealershipDashboard';

export default function Premium({ dealerId }: { dealerId: string }) {
  // The PremiumDealershipDashboard handles its own full layout,
  // so we just wrap it to match the panel interface
  return (
    <div className="w-full">
      <PremiumDealershipDashboard />
    </div>
  );
}