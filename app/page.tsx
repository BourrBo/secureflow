import Navbar from '@/components/Navbar'
import AnnouncementBanner from '@/components/AnnouncementBanner'
import Hero from '@/components/Hero'
import StatsBar from '@/components/StatsBar'
import Features from '@/components/Features'
import HowItWorks from '@/components/HowItWorks'
import Integrations from '@/components/Integrations'
import Testimonials from '@/components/Testimonials'
import Pricing from '@/components/Pricing'
import CtaBand from '@/components/CtaBand'
import Footer from '@/components/Footer'
import ScrollReveal from '@/components/ScrollReveal'

export default function HomePage() {
  return (
    <>
      <ScrollReveal />
      <AnnouncementBanner />
      <Navbar />
      <main>
        <Hero />
        <StatsBar />
        <Features />
        <HowItWorks />
        <Integrations />
        <Testimonials />
        <Pricing />
        <CtaBand />
      </main>
      <Footer />
    </>
  )
}