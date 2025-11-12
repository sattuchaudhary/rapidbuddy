import React from 'react';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <h4>RAPIDREPO</h4>
            <p>Transforming vehicle repossession with technology</p>
          </div>
          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul>
              <li><a href="#home">Home</a></li>
              <li><a href="#about">About</a></li>
              <li><a href="#features">Features</a></li>
              <li><a href="#pricing">Pricing</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Contact</h4>
            <p>Email: info@rapidrepo.com</p>
            <p>Phone: +91 9997679791</p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2025 Rapidrepo. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
