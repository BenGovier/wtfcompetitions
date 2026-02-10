import { SectionHeader } from "@/components/section-header"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export default function FAQPage() {
  return (
    <div className="container max-w-3xl px-4 py-8">
      <SectionHeader title="Frequently Asked Questions" subtitle="Get answers to common questions" />

      <Accordion type="single" collapsible className="mt-8">
        <AccordionItem value="item-1">
          <AccordionTrigger>How do giveaways work?</AccordionTrigger>
          <AccordionContent>
            Purchase entries for the giveaway you want to enter. When the giveaway ends, a winner is randomly selected
            and announced on our platform.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-2">
          <AccordionTrigger>Are the winners real?</AccordionTrigger>
          <AccordionContent>
            Yes! All winners are verified and announced publicly with their consent. We maintain full transparency in
            our selection process.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-3">
          <AccordionTrigger>How do I claim my prize?</AccordionTrigger>
          <AccordionContent>
            If you win, we'll contact you via email within 24 hours. You'll need to verify your identity and provide
            shipping information for physical prizes.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
