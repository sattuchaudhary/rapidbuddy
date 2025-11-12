import React from 'react';
import { useNavigate } from 'react-router-dom';

const Header = ({ scrollToSection }) => {
  const navigate = useNavigate();

  const handleLoginClick = () => {
    navigate('/login');
  };

  return (
    <header className="header">
      <div className="container">
        <div className="nav-brand">
          <h2>RAPIDREPO</h2>
        </div>
        <nav className="nav-menu">
          <a href="#home" onClick={() => scrollToSection('home')}>Home</a>
          <a href="#about" onClick={() => scrollToSection('about')}>About Us</a>
          <a href="#features" onClick={() => scrollToSection('features')}>Feature</a>
          <a href="#pricing" onClick={() => scrollToSection('pricing')}>Pricing</a>
          <a href="#testimonials" onClick={() => scrollToSection('testimonials')}>Testimonial</a>
          <a href="#contact" onClick={() => scrollToSection('contact')}>Contact</a>
        </nav>
        <button className="login-btn" onClick={handleLoginClick}>
          Login
        </button>
      </div>
    </header>
  );
};

export default Header;
