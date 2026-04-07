import { SectionHeader } from "@/components/section-header"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export default function FAQPage() {
  return (
    <div className="container max-w-3xl px-4 py-8">
      <SectionHeader title="Frequently Asked Questions" subtitle="Get answers to common questions" />

      <Accordion type="single" collapsible className="mt-8">
        <AccordionItem value="item-1">
          <AccordionTrigger>How to enter competitions?</AccordionTrigger>
          <AccordionContent>
            To enter, simply choose your desired number of tickets and complete checkout. Once your payment is confirmed, your tickets are automatically allocated and entered into the draw. You can view your entries in your account at any time.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-2">
          <AccordionTrigger>What are instant wins?</AccordionTrigger>
          <AccordionContent>
            Instant wins are prizes that can be won immediately when purchasing tickets. If your ticket number matches a pre-selected winning number, you will win instantly. Some instant wins may only unlock once a certain number of tickets have been sold.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-3">
          <AccordionTrigger>How and when do draws take place?</AccordionTrigger>
          <AccordionContent>
            Draws take place once a competition sells out or reaches its end date. Winners are selected automatically using a randomised system. Draws may also be streamed live on our social channels where applicable.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-4">
          <AccordionTrigger>How can I contact you if I need help?</AccordionTrigger>
          <AccordionContent>
            You can contact us anytime by email at ben@wtf-giveaways.co.uk. We aim to respond within 24–48 hours. For the fastest support, please include your order reference where possible.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-5">
          <AccordionTrigger>I have won a cash prize, what happens now?</AccordionTrigger>
          <AccordionContent>
            <p>If you have won a cash prize, please email us at ben@wtf-giveaways.co.uk with the following details:</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Full name (as it appears on your bank)</li>
              <li>Sort code</li>
              <li>Account number</li>
            </ul>
            <p className="mt-2">We aim to process all payments within 48 hours.</p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-6">
          <AccordionTrigger>I have won tickets, bundles or mystery tickets, what happens now?</AccordionTrigger>
          <AccordionContent>
            Any ticket-based prizes are automatically added to your account. You do not need to take any action. These tickets will be entered into the relevant competition.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-7">
          <AccordionTrigger>I have been contacted on social media saying I have won a prize, is this true?</AccordionTrigger>
          <AccordionContent>
            We will never ask for payment or sensitive information via social media. All official winner notifications come directly from us. If you are unsure, please contact us at ben@wtf-giveaways.co.uk before taking any action.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
