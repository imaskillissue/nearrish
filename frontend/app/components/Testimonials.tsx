import styles from "./Testimonials.module.css";

export default function Testimonials() {
  return (
    <section className={styles.testimonials}>
      <div className={styles.card}>
        "I appreciate that my data isn’t the product."
      </div>
      <div className={styles.card}>
        "The balance between open access and commitment works surprisingly well."
      </div>
      <div className={styles.card}>
        "It feels organized without feeling corporate."
      </div>
    </section>
  );
}
