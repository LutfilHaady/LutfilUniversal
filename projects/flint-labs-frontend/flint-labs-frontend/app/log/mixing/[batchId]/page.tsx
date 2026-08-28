import { MixingOperatorPage } from '@/components/mixing/mixing-operator-page';

export default async function Page({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  return <MixingOperatorPage batchId={batchId} />;
}
