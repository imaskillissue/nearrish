import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Testimonials from '@/components/Testimonials';
import Footer from './components/Footer';

export default function Home() {
  return (
    <main style={{ paddingTop: '80px', backgroundColor: '#c5eddf'}}>
      <Hero />
      <Footer />
    </main>
  )
}
