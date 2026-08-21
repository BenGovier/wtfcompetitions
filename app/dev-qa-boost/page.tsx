// TEMPORARY visual-QA harness for the Exclusive Chance Boost mobile bottom
// sheet. Renders the presentational CheckoutReviewClient with fabricated,
// server-shaped props — NO database, NO auth, NO network. Delete after QA.
import {
  CheckoutReviewClient,
  type ReviewOption,
} from '@/components/checkout/checkout-review-client'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

const PAGE_BG =
  'min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top,_#3a0f4f_0%,_#1b0b2b_40%,_#0e0618_100%)] text-white'

const options: ReviewOption[] = [
  { key: 'single:1', qty: 1, bundlePricePence: null, totalPence: 261, savingsPence: 0 },
  { key: 'bundle:5:1200', qty: 5, bundlePricePence: 1200, totalPence: 1200, savingsPence: 105 },
  { key: 'bundle:10:2000', qty: 10, bundlePricePence: 2000, totalPence: 2000, savingsPence: 610 },
  { key: 'bundle:25:4500', qty: 25, bundlePricePence: 4500, totalPence: 4500, savingsPence: 2025 },
]

export default function DevQaBoostPage() {
  return (
    <div className={PAGE_BG}>
      <CheckoutReviewClient
        campaignId="00000000-0000-0000-0000-000000000000"
        slug="qa-harness"
        title="Win a McLaren 750S + £10,000 Cash"
        prizeTitle="McLaren 750S"
        prizeValueText="£265,000"
        heroImageUrl={null}
        ticketPricePence={261}
        options={options}
        initialKey="single:1"
        availableWalletPence={0}
        instantWins={{ remainingCount: 18, heroCashLabel: '£1,000 CASH' }}
      />
    </div>
  )
}
