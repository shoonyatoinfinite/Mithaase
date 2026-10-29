import { DedicatedPaymentTracker } from "@/components/payment/DedicatedPaymentTracker";

interface PayPageProps {
  params: Promise<{
    orderRef: string;
  }>;
}

export default async function PayPage({ params }: PayPageProps) {
  const { orderRef } = await params;
  return <DedicatedPaymentTracker orderRef={orderRef} />;
}

