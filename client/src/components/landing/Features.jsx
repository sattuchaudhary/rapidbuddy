import React, { useState } from 'react';

const Features = ({ featuresData }) => {
  const [activeFeature, setActiveFeature] = useState(0);

  return (
    <section id="features" className="features">
      <div className="container">
        <h2 className="section-title">Why Choose <span className="brand-accent">RAPIDREPO</span></h2>
        <p className="section-subtitle">
          Here's what makes us the #1 repossession solution across leading NBFCs and financial institutions:
        </p>
        <div className="features-content">
          <div className="features-list">
            {featuresData.map((feature, index) => (
              <div 
                key={index}
                className={`feature-item ${activeFeature === index ? 'active' : ''}`}
                onClick={() => setActiveFeature(index)}
              >
                <div className="feature-header">
                  <span className="feature-icon">{feature.icon}</span>
                  <h3 className="feature-title">{feature.title}</h3>
                  <span className="feature-arrow">
                    {activeFeature === index ? '^' : 'v'}
                  </span>
                </div>
                {activeFeature === index && (
                  <p className="feature-description">{feature.description}</p>
                )}
              </div>
            ))}
          </div>
          <div className="features-illustration">
            <div className="isometric-illustration">
              <div className="server-tower">🗄️</div>
              <div className="data-blocks">📊</div>
              <div className="network-lines">🔗</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;
