import { useState } from "react";

const FAQ_ITEMS = [
  {
    question: "What is VEIL Markets?",
    answer:
      "VEIL is a private prediction market interface for Solana. Users can create markets, place encrypted positions, and reveal final outcomes without turning the live market into a public herd signal.",
  },
  {
    question: "How is Arcium used?",
    answer:
      "Arcium is used for encrypted computation around private market state. Stakes, votes, and resolution inputs can remain encrypted while the application still supports fair settlement and outcome reveal.",
  },
  {
    question: "Do the card charts reveal private votes?",
    answer:
      "No. The chart shown on each card is a privacy-safe public activity index. It does not read encrypted YES/NO stake totals or expose private direction while a market is live.",
  },
  {
    question: "Why not show live YES and NO odds?",
    answer:
      "Showing live directional odds can create herding and manipulation pressure. VEIL keeps the useful browsing context while avoiding public signals that would weaken the privacy design.",
  },
  {
    question: "What does the leaderboard measure?",
    answer:
      "The leaderboard uses public metadata only: markets created, public participation count, imported markets, and settlement activity. It does not rank users by private winnings or hidden positions.",
  },
  {
    question: "When are outcomes revealed?",
    answer:
      "Outcomes are revealed after the market has ended and resolution is completed. The result can become public while losing/private participation details remain protected.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <main className="page-shell faq-page">
      <section className="page-heading anim-up">
        <div>
          <p className="page-kicker">PRIVACY MODEL</p>
          <h1>FAQ</h1>
          <p>
            A clear explanation of the prediction market flow, Arcium's role, and why VEIL avoids leaking live directional signals.
          </p>
        </div>
      </section>

      <section className="faq-list">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <article className={isOpen ? "faq-item is-open anim-up" : "faq-item anim-up"} style={{ "--i": index + 1 }} key={item.question}>
              <button type="button" onClick={() => setOpenIndex(isOpen ? -1 : index)}>
                <span>{item.question}</span>
                <span>{isOpen ? "-" : "+"}</span>
              </button>
              {isOpen && <p>{item.answer}</p>}
            </article>
          );
        })}
      </section>
    </main>
  );
}
