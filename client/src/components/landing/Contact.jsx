import React, { useState } from 'react';

const Contact = () => {
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    message: ''
  });

  const handleContactSubmit = (e) => {
    e.preventDefault();
    // Here you can add form submission logic
    console.log('Contact form submitted:', contactForm);
    alert('Thank you for your message! We will get back to you soon.');
    setContactForm({
      name: '',
      email: '',
      company: '',
      phone: '',
      message: ''
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setContactForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <section id="contact" className="contact">
      <div className="container">
        <h2 className="section-title">GET IN TOUCH</h2>
        <p className="section-subtitle">
          Ready to transform your repossession operations? Contact us today!
        </p>
        <div className="contact-content">
          <div className="contact-info">
            <div className="contact-item">
              <div className="contact-icon">📧</div>
              <div className="contact-details">
                <h4>Email</h4>
                <p>info@rapidrepo.com</p>
                <p>support@rapidrepo.com</p>
              </div>
            </div>
            <div className="contact-item">
              <div className="contact-icon">📞</div>
              <div className="contact-details">
                <h4>Phone</h4>
                <p>+91 9997679791</p>
                
              </div>
            </div>
            <div className="contact-item">
              <div className="contact-icon">📍</div>
              <div className="contact-details">
                <h4>Address</h4>
                <p>00 Sec 5,</p>
                <p>Gurgaon, Haryana 122001</p>
              </div>
            </div>
          </div>
          <div className="contact-form-container">
            <form className="contact-form" onSubmit={handleContactSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Full Name *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={contactForm.name}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email Address *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={contactForm.email}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter your email"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="company">Company Name</label>
                  <input
                    type="text"
                    id="company"
                    name="company"
                    value={contactForm.company}
                    onChange={handleInputChange}
                    placeholder="Enter your company name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={contactForm.phone}
                    onChange={handleInputChange}
                    placeholder="Enter your phone number"
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="message">Message *</label>
                <textarea
                  id="message"
                  name="message"
                  value={contactForm.message}
                  onChange={handleInputChange}
                  required
                  rows="5"
                  placeholder="Tell us about your requirements..."
                ></textarea>
              </div>
              <button type="submit" className="submit-btn">
                Send Message
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
