import React from 'react';

const Hero = () => {
  return (
    <section id="home" className="hero">
      <div className="hero-background">
        <div className="particles"></div>
      </div>
      <div className="container">
        <div className="hero-content">
          <h1 className="hero-title">
            WELCOME TO<br />
            <span className="brand-name">RAPIDREPO</span>
          </h1>
          <p className="hero-description">
            A unified platform for Banks, NBFCs, and recovery agents—transforming repossession with powerful analytics and automation.
          </p>
          <div className="app-availability">
            <p>Also Available on:</p>
            <div className="app-icons">
              <div className="app-icon android">🤖</div>
              <div className="app-icon apple">🍎</div>
            </div>
          </div>
          <button className="download-btn">Download App</button>
        </div>
      </div>
    </section>
  );
};

export default Hero;
