import Link from "next/link";
import styles from "./Footer.module.css";

export default function Footer() {

    return (
        <footer className={styles.body}>
            <span style={{ opacity: 0.7 }}>
                &copy; {new Date().getFullYear()} near – Community
            </span>
            <Link href="/about" style={{ opacity: 0.7, color: 'inherit', textDecoration: 'none', marginLeft: '1rem' }}>
                About
            </Link>
            <Link href="/privacy" style={{ opacity: 0.7, color: 'inherit', textDecoration: 'none', marginLeft: '1rem' }}>
                Privacy Policy
            </Link>
            <Link href="/terms" style={{ opacity: 0.7, color: 'inherit', textDecoration: 'none', marginLeft: '1rem' }}>
                Terms of Service
            </Link>
        </footer>
    );
}