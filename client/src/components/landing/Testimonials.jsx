import React from 'react';

const Testimonials = ({ testimonialsData }) => {
  return (
    <section id="testimonials" className="testimonials">
      <div className="container">
        <h2 className="section-title">WHAT OUR CLIENTS SAY</h2>
        <p className="section-subtitle">
          Trusted by leading financial institutions and recovery agencies across India
        </p>
        <div className="testimonials-grid">
          {testimonialsData.map((testimonial, index) => (
            <div key={index} className="testimonial-card">
              <div className="testimonial-header">
                <div className="testimonial-logo">{testimonial.logo}</div>
                <div className="testimonial-info">
                  <h4 className="testimonial-name">{testimonial.name}</h4>
                  <p className="testimonial-role">{testimonial.role}</p>
                </div>
              </div>
              <div className="testimonial-rating">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <span key={i} className="star">⭐</span>
                ))}
              </div>
              <p className="testimonial-content">"{testimonial.content}"</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
