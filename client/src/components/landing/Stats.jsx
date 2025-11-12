import React from 'react';

const Stats = ({ statsData }) => {
  return (
    <section className="stats">
      <div className="container">
        <h2 className="stats-title">OUR TRUSTED PARTNERSHIPS</h2>
        <p className="stats-description">
          Rapidrepo, a cutting-edge SaaS application, revolutionizes vehicle repossession management for banks and financial institutions. Trusted by industry leaders, our platform streamlines operations, enhances efficiency, and ensures data security.
        </p>
        <p className="stats-description">
          Join leading institutions in leveraging Rapidrepo to drive efficiency and success in vehicle repossession management.
        </p>
        
        <div className="stats-grid">
          {statsData.map((stat, index) => (
            <div key={index} className="stat-card">
              <div className="stat-icon">{stat.icon}</div>
              <div className="stat-number">{stat.number}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
