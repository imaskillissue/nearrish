import Link from "next/link";
import styles from "./Footer.module.css";

export default function Footer() {
    return (
        <footer className={styles.body}>
            <span style={{ opacity: 0.7 }}>
                &copy; {new Date().getFullYear()} near – Community Events
            </span>
        </footer>
    );
}