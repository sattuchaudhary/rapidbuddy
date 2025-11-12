import React from 'react';

const MobileApp = () => {
  return (
    <section className="mobile-app">
      <div className="container">
        <h2 className="section-title">FEATURES</h2>
        <div className="mobile-content">
          <div className="mobile-text">
            <h3>Perfect Dashboard</h3>
          </div>
          <div className="mobile-mockup">
            <div className="phone-frame">
              <div className="phone-screen">
                <div className="phone-header">
                  <span>☰</span>
                  <span>Home</span>
                  <span>🔔</span>
                </div>
                <div className="app-logo">RAPIDREPO 2.0</div>
                <div className="search-section">
                  <input type="text" placeholder="Q Chassis Number" />
                  <input type="text" placeholder="Q 1234" />
                </div>
                <div className="download-info">
                  Last Downloaded DB File: 13 May 2025 - 02:04 pm
                </div>
                <div className="stats-cards">
                  <div className="stat-card-mobile">
                    <span>🔄</span>
                    <span>Total Records</span>
                  </div>
                  <div className="stat-card-mobile">
                    <span>📄</span>
                    <span>Personal Records</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MobileApp;
