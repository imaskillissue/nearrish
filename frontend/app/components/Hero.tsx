import Link from "next/link";
import styles from "./Hero.module.css";
import { H1_STYLE } from '../lib/typography';

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroContent}>
        <h1 style={H1_STYLE}>
          Beyond the feed.
          <br />
          Into community.
        </h1>

        <p>
          Share what's happening around you. Discover posts from your
          neighborhood. Connect with your local community.
        </p>

        <div className={styles.cta}>
          <button className={styles.events}><Link href="/explore">Explore</Link></button>
          <button className={styles.about}><Link href="/about">About us</Link></button>
        </div>
        {/* Testimonials Overlay */}
        <div className={styles.testimonialsOverlay}>
          <div className={styles.testimonialCard1}>
            "I appreciate that my data isn’t the product."
          </div>
          <div className={styles.testimonialCard2}>
            "The balance between open access and commitment works surprisingly well."
          </div>
          <div className={styles.testimonialCard3}>
            "It feels organized without feeling corporate."
          </div>
        </div>
      </div>

      <div className={styles.heroImage}></div>

      <div className={styles.wave}></div>
    </section>
  );
}
