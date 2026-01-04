import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
    return (
        <div className="landing-page">
            <header className="landing-header">
                <div className="logo-container">
                    {/* Placeholder for Logo if needed, or just text */}
                    <div className="landing-logo">Q</div>
                    <span className="logo-text">Quotations</span>
                </div>
                <nav className="landing-nav">
                    <Link to="/features" className="nav-link">Features</Link>
                    <Link to="/pricing" className="nav-link">Pricing</Link>
                    <Link to="/resources" className="nav-link">Resources</Link>
                    <Link to="/contact" className="nav-link">Contact</Link>
                </nav>
            </header>

            <section className="hero-section">
                <div className="hero-content">
                    {/* Dashboard Illustration Placeholder/Mockup */}
                    <div className="hero-mockup-wrapper">
                        {/* We will use CSS to create the "card" look behind the text if needed, 
                            but based on the image, the text is ON TOP of the blue background 
                            and the mockup is behind or integrated. 
                            Let's structure it to match the image: 
                            Blue Background -> Dashboard Image centered/faded -> Text Quote Overlay 
                         */}
                        <div className="mockup-img-container">
                            {/* This div will hold the dashboard graphic via CSS background or img tag */}
                            <div className="dashboard-graphic">
                                <div className="graphic-overlay"></div>
                                {/* Simple shapes to mimic the chart in the image */}
                                <div className="chart-circle"></div>
                                <div className="chart-bars">
                                    <span></span><span></span><span></span><span></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="hero-text-overlay">
                        <h1>Create Professional <br />Quotations in Seconds</h1>
                        <p>Streamline your sales process, manage customers, and close deals faster with our intuitive quotation tool.</p>
                        <div className="cta-buttons">
                            <Link to="/register" className="btn-landing-primary">Get Started</Link>
                            <Link to="/login" className="btn-landing-secondary">Login</Link>
                        </div>
                    </div>
                </div>

                {/* Curve Divider */}
                <div className="custom-shape-divider-bottom">
                    <svg data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
                        <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" className="shape-fill"></path>
                    </svg>
                </div>
            </section>
        </div>
    );
};

export default LandingPage;
