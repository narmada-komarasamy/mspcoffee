import Image from "next/image";
import styles from "./premiumshowcase.module.css";

export const metadata = {
  title: "Hill Tiller Berry Blast | MSP Coffee",
  description:
    "Premium showcase for Hill Tiller Coffee Roasters Berry Blast from MSP Orchardale Estate.",
};

const tastingNotes = ["Berry-led cup", "Medium roast", "Arabica naturals"];

export default function PremiumShowcasePage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-label="Hill Tiller Berry Blast showcase">
        <div className={styles.copy}>
          <p className={styles.kicker}>Hill Tiller Ads</p>
          <h1>Berry Blast</h1>
          <p className={styles.estate}>MSP Orchardale Estate</p>
          <p className={styles.description}>
            A natural-process Arabica from Yercaud, shaped for a bright, fruit-forward
            cup with a clean medium roast profile.
          </p>

          <div className={styles.notes} aria-label="Coffee highlights">
            {tastingNotes.map((note) => (
              <span key={note}>{note}</span>
            ))}
          </div>

          <div className={styles.actions} aria-label="Showcase actions">
            <a href="#profile" className={styles.primaryAction}>
              View profile
            </a>
            <a href="mailto:orders@mspcoffee.com" className={styles.secondaryAction}>
              Enquire
            </a>
          </div>
        </div>

        <div className={styles.productStage}>
          <div className={styles.brandMark} aria-hidden="true">
            HILL TILLER
          </div>
          <Image
            src="/premiumshowcase/hill-tiller-berry-blast.png"
            alt="Hill Tiller Coffee Roasters Berry Blast bag from MSP Orchardale Estate"
            width={595}
            height={850}
            priority
            className={styles.productImage}
          />
        </div>
      </section>

      <section id="profile" className={styles.profile} aria-label="Coffee profile">
        <div>
          <p className={styles.profileLabel}>Origin</p>
          <p>Yercaud, Salem, Tamil Nadu</p>
        </div>
        <div>
          <p className={styles.profileLabel}>Process</p>
          <p>Arabica naturals</p>
        </div>
        <div>
          <p className={styles.profileLabel}>Roast</p>
          <p>Medium</p>
        </div>
        <div>
          <p className={styles.profileLabel}>Net weight</p>
          <p>250g</p>
        </div>
      </section>
    </main>
  );
}
