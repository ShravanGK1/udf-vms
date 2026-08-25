import React, { useState } from 'react';
import { 
  ShieldCheck, Clock, ShieldAlert, Bell, BarChart3, Users, 
  UserCheck, Activity, FileCheck, ChevronDown, 
  ChevronUp, Menu, X, ArrowRight, CheckCircle2, Building 
} from 'lucide-react';
import './LandingPage.css'; // <-- Importing the new standard CSS file!

// --- Data ---
const features = [
  { icon: <UserCheck className="icon-blue" />, title: "Visitor Registration", description: "Pre-registration, walk-in entry, digital check-in, and instant badge printing." },
  { icon: <Activity className="icon-blue" />, title: "Real-Time Tracking", description: "Live visitor tracking with time-bound access permissions across your facility." },
  { icon: <ShieldAlert className="icon-blue" />, title: "Security & Compliance", description: "Blacklist/watchlist management and real-time emergency evacuation tracking." },
  { icon: <Bell className="icon-blue" />, title: "Notifications & Alerts", description: "Automated host arrival alerts, overstay warnings, and scheduled reminders." },
  { icon: <BarChart3 className="icon-blue" />, title: "Reporting & Analytics", description: "Daily, weekly, and monthly reports, compliance dashboards, and trend analysis." },
  { icon: <Users className="icon-blue" />, title: "Admin Management", description: "Employee directory integration, bulk upload via Excel, and role-based access." },
];

const steps = [
  { num: "01", title: "Pre-Register", description: "Host schedules a visitor ahead of time via the dashboard or calendar integration." },
  { num: "02", title: "Check-In", description: "Visitor arrives, verifies ID at the kiosk, and receives a printed badge/gate slip." },
  { num: "03", title: "Track & Monitor", description: "Real-time visibility and location tracking for your internal security teams." },
  { num: "04", title: "Check-Out & Report", description: "Automated checkout process logging exact times for compliance reporting." },
];

const faqs = [
  { question: "Is the system compliant with data privacy laws?", answer: "Yes, our system is fully compliant with GDPR, CCPA, and other major data privacy regulations. Visitor data is encrypted and securely stored." },
  { question: "Can we integrate this with our existing employee directory?", answer: "Absolutely. We offer seamless integrations with Active Directory, Google Workspace, and major HRMS platforms via secure APIs." },
  { question: "Does it support multiple locations?", answer: "Yes, our enterprise plan allows centralized management across multiple offices and geographical locations from a single dashboard." },
  { question: "What hardware is required for check-in kiosks?", answer: "Our software runs on any standard iPad, Android tablet, or touch-screen PC. We can also provide hardware recommendations for badge printers." },
];

export default function VisitorManagementLanding() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  const toggleFaq = (index) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="vms-page">
      {/* 1. Navigation Bar */}
      <nav className="vms-navbar">
        <div className="vms-container nav-content">
          <div className="nav-logo">
            <Building className="logo-icon" />
            <span className="logo-text">VisiGuard <span>Enterprise</span></span>
          </div>
          
          <div className="nav-links desktop-only">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#benefits">Benefits</a>
            <a href="#faq">FAQ</a>
            <button className="btn btn-primary shadow">Request Demo</button>
          </div>

          <button className="mobile-menu-btn mobile-only" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="mobile-nav shadow">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#benefits">Benefits</a>
            <a href="#faq">FAQ</a>
            <button className="btn btn-primary full-width mt-1">Request Demo</button>
          </div>
        )}
      </nav>

      {/* 2. Hero Section */}
      <section className="hero-section vms-container">
        <div className="hero-content">
          <h1>Secure. Smart. <br className="desktop-only" /><span>Seamless Visitor Management.</span></h1>
          <p>The centralized enterprise solution for managing, monitoring, and securing visitor access. Automate compliance, enhance safety, and create a welcoming front-desk experience.</p>
          <div className="hero-buttons">
            <button className="btn btn-primary btn-large shadow">Request a Demo <ArrowRight className="icon-small" /></button>
            <button className="btn btn-outline btn-large">Learn More</button>
          </div>
        </div>
        
        <div className="hero-graphic">
          <div className="graphic-box shadow">
            <div className="mockup-card shadow">
              <div className="mockup-header">
                <div className="mockup-avatar"><UserCheck /></div>
                <div>
                  <h4>New Visitor Pre-Registered</h4>
                  <p>John Doe • TechCorp Inc.</p>
                </div>
              </div>
              <div className="mockup-lines">
                <div className="line line-1"></div>
                <div className="line line-2"></div>
                <div className="line line-3"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Key Features Section */}
      <section id="features" className="section-padding bg-white">
        <div className="vms-container text-center">
          <h2 className="section-title">Enterprise-Grade Features</h2>
          <p className="section-subtitle">Everything you need to secure your facility and streamline your front desk operations in one powerful platform.</p>
          
          <div className="features-grid">
            {features.map((feature, idx) => (
              <div key={idx} className="feature-card shadow-hover">
                <div className="feature-icon-wrapper">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. How It Works Section */}
      <section id="how-it-works" className="section-padding bg-dark text-light">
        <div className="vms-container text-center">
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">A seamless workflow from the moment a meeting is booked until the visitor leaves the building.</p>
          
          <div className="steps-grid">
            <div className="step-connector desktop-only"></div>
            {steps.map((step, idx) => (
              <div key={idx} className="step-card">
                <div className="step-number">{step.num}</div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Benefits / Why Choose Us */}
      <section id="benefits" className="section-padding bg-white">
        <div className="vms-container benefits-grid">
          <div className="benefit-card">
            <div className="benefit-icon-wrapper"><ShieldCheck /></div>
            <h3>Enhanced Security</h3>
            <p>Prevent unauthorized access and keep a real-time ledger of everyone currently on premises. Instantly run watchlist checks upon check-in.</p>
            <ul>
              <li><CheckCircle2 className="icon-blue icon-small" /> Watchlist matching</li>
              <li><CheckCircle2 className="icon-blue icon-small" /> ID verification</li>
            </ul>
          </div>
          
          <div className="benefit-card">
            <div className="benefit-icon-wrapper"><Clock /></div>
            <h3>Operational Efficiency</h3>
            <p>Reduce front desk queues by 70%. Let visitors self check-in via iPads or smartphones while hosts get instantly notified.</p>
            <ul>
              <li><CheckCircle2 className="icon-blue icon-small" /> Self-serve kiosks</li>
              <li><CheckCircle2 className="icon-blue icon-small" /> Automated host alerts</li>
            </ul>
          </div>

          <div className="benefit-card">
            <div className="benefit-icon-wrapper"><FileCheck /></div>
            <h3>Compliance Ready</h3>
            <p>Easily pass IT and security audits. Digitally capture NDAs, health declarations, and maintain a secure, easily accessible log history.</p>
            <ul>
              <li><CheckCircle2 className="icon-blue icon-small" /> Digital NDA signing</li>
              <li><CheckCircle2 className="icon-blue icon-small" /> Audit-ready reports</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 6. FAQ Section */}
      <section id="faq" className="section-padding bg-light">
        <div className="vms-container text-center max-w-md">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-subtitle">Everything you need to know about implementing our system.</p>
          
          <div className="faq-list text-left">
            {faqs.map((faq, idx) => (
              <div key={idx} className="faq-item">
                <button className="faq-button" onClick={() => toggleFaq(idx)}>
                  <span>{faq.question}</span>
                  {openFaqIndex === idx ? <ChevronUp className="icon-blue" /> : <ChevronDown className="icon-muted" />}
                </button>
                <div className={`faq-answer ${openFaqIndex === idx ? 'open' : ''}`}>
                  {faq.answer}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. CTA Section */}
      <section className="cta-section">
        <div className="vms-container text-center">
          <h2>Ready to modernize your visitor management?</h2>
          <p>Join hundreds of enterprises that trust VisiGuard to secure their facilities and streamline front-desk operations.</p>
          <div className="cta-buttons">
            <button className="btn btn-white btn-large shadow">Request a Demo</button>
            <button className="btn btn-primary-dark btn-large">Contact Sales</button>
          </div>
        </div>
      </section>

      {/* 8. Footer */}
      <footer className="footer-section">
        <div className="vms-container footer-grid">
          <div className="footer-brand">
            <div className="footer-logo">
              <Building className="icon-blue" />
              <span>VisiGuard</span>
            </div>
            <p>The leading enterprise visitor management system designed for security, compliance, and efficiency.</p>
          </div>
          
          <div className="footer-links">
            <h4>Product</h4>
            <ul>
              <li><a href="#">Features</a></li>
              <li><a href="#">Integrations</a></li>
              <li><a href="#">Hardware</a></li>
              <li><a href="#">Pricing</a></li>
            </ul>
          </div>

          <div className="footer-links">
            <h4>Company</h4>
            <ul>
              <li><a href="#">About Us</a></li>
              <li><a href="#">Customers</a></li>
              <li><a href="#">Careers</a></li>
              <li><a href="#">Contact</a></li>
            </ul>
          </div>

          <div className="footer-links">
            <h4>Legal</h4>
            <ul>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Service</a></li>
              <li><a href="#">GDPR Compliance</a></li>
              <li><a href="#">Security</a></li>
            </ul>
          </div>
        </div>
        <div className="vms-container footer-bottom">
          <p>© {new Date().getFullYear()} VisiGuard Enterprise. All rights reserved.</p>
          <div className="social-links">
            <a href="#">Twitter</a>
            <a href="#">LinkedIn</a>
            <a href="#">Facebook</a>
          </div>
        </div>
      </footer>
    </div>
  );
}