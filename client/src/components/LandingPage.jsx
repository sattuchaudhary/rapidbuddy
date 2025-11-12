import React from 'react';
import { useNavigate } from 'react-router-dom';
import './landing/LandingPage.css';

import Header from './landing/Header.jsx';
import Hero from './landing/Hero.jsx';
import About from './landing/About.jsx';
import Features from './landing/Features.jsx';
import Stats from './landing/Stats.jsx';
import MobileApp from './landing/MobileApp.jsx';
import Pricing from './landing/Pricing.jsx';
import Testimonials from './landing/Testimonials.jsx';
import Contact from './landing/Contact.jsx';
import Footer from './landing/Footer.jsx';

const LandingPage = () => {
  const navigate = useNavigate();

  const featuresData = [
    {
      title: "Unauthorized Repo Charges",
      description: "Track repo agent activities live, avoid unauthorized actions, and maintain operational integrity.",
      icon: "🔒"
    },
    {
      title: "Recovery Agents Tracking",
      description: "Monitor repo agent activity and avoid unauthorized repossession with real-time tracking.",
      icon: "📍"
    },
    {
      title: "Data Analysis",
      description: "Generate reports and analyze repossession performance instantly with powerful analytics.",
      icon: "🔍"
    },
    {
      title: "Data Security",
      description: "Cloud-based access ensures your data is always safe and accessible with enterprise-grade security.",
      icon: "🛡️"
    }
  ];

  const statsData = [
    { number: "2+", label: "Associated Banks", icon: "🏦" },
    { number: "600+", label: "Total Active Customers", icon: "👥" },
    { number: "25000+", label: "Total Active Users", icon: "📱" },
    { number: "25+", label: "States Covered", icon: "🗺️" }
  ];

  const pricingPlansData = [
    {
      name: "Super Lite",
      price: "₹2500",
      period: "/ month",
      features: [
        "Web Application",
        "Full Offline Access",
        "User Management through Mobile App",
        "Customization of Fields for Repo Agent",
        "Payment Collection From Repo Agent",
        "Generate Repo Kit",
        "Removal of Duplicate Number"
      ]
    },
    {
      name: "Premium",
      price: "₹5000",
      period: "/ month",
      features: [
        "Web Application",
        "Full Offline Access",
        "User Management through Mobile App",
        "Customization of Fields for Repo Agent",
        "Location Tracking of Repo Agent",
        "Personalize App on Play Store",
        "Payment Collection From Repo Agent"
      ]
    }
  ];

  const testimonialsData = [
    {
      name: "HDB Financial Services",
      role: "Financial Institution",
      content: "Since May 2024, we've transformed their vehicle recovery with seamless tracking and robust data safety. Rapidrepo has revolutionized our repossession operations.",
      rating: 5,
      logo: "🏦"
    },
    {
      name: "Ambit Finvest",
      role: "NBFC Partner",
      content: "Our 2025 integration empowers Ambit Finvest with real-time tracking and streamlined repossession. The platform has significantly improved our efficiency.",
      rating: 5,
      logo: "🏢"
    },
    {
      name: "Rajesh Kumar",
      role: "Recovery Agent",
      content: "Rapidrepo has made my job so much easier. The real-time tracking and offline capabilities ensure I never miss a beat, even in remote areas.",
      rating: 5,
      logo: "👨‍💼"
    }
  ];

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="landing-page">
      <Header scrollToSection={scrollToSection} />
      <Hero />
      <About style={{ '--animation-delay': '0.2s' }} />
      <Features featuresData={featuresData} style={{ '--animation-delay': '0.4s' }} />
      <Stats statsData={statsData} style={{ '--animation-delay': '0.6s' }} />
      <MobileApp style={{ '--animation-delay': '0.8s' }} />
      <Pricing pricingPlansData={pricingPlansData} style={{ '--animation-delay': '1.0s' }} />
      <Testimonials testimonialsData={testimonialsData} style={{ '--animation-delay': '1.2s' }} />
      <Contact style={{ '--animation-delay': '1.4s' }} />
      <Footer style={{ '--animation-delay': '1.6s' }} />

      {/* Scroll to Top Button */}
      <button className="scroll-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        ↑
      </button>
    </div>
  );
};

export default LandingPage;
