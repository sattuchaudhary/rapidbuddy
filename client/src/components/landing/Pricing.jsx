import React from 'react';

const Pricing = ({ pricingPlansData }) => {
  return (
    <section id="pricing" className="pricing">
      <div className="container">
        <h2 className="section-title">USER LIMITS AND PRICING</h2>
        <div className="pricing-container">
          <div className="pricing-header">
            <div className="plan-tabs">
              <div className="plan-tab active">Super Lite</div>
              <div className="plan-tab">Premium</div>
            </div>
            <div className="pricing-display">
              <span className="price">₹2500</span>
              <span className="period">/ month</span>
            </div>
          </div>
          <div className="pricing-plans">
            {pricingPlansData.map((plan, index) => (
              <div key={index} className="pricing-card">
                <h3 className="plan-name">Rapidrepo {plan.name}</h3>
                <ul className="plan-features">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex}>
                      <span className="checkmark">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
