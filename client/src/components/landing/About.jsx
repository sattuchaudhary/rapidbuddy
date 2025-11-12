import React from 'react';

const About = () => {
  return (
    <section id="about" className="about">
      <div className="container">
        <h2 className="section-title">ABOUT US</h2>
        <div className="about-content">
          <div className="about-text">
            <p>We simplify repossession with smart tracking and digital tools for banks, NBFCs, and recovery agencies.</p>
            <p>Rapidrepo is a solution which provide a common platform to all the banks, NBFC and their authorized repossession agencies.</p>
            <p>The vehicle repossession business is a segment in India facing many challenges, which makes the execution a bit difficult.</p>
            <p>Surprisingly, the business owners were themselves not aware that having technology into the system can make their job easy and way more effective.</p>
          </div>
          <div className="about-illustration">
            <div className="illustration-placeholder">
              <div className="illustration-figure">👨‍💼</div>
              <div className="illustration-docs">📄</div>
              <div className="illustration-laptop">💻</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
