import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
    return (
        <div className="landing-page">
            <header className="landing-header">
                <div className="logo-container">
                    <div className="landing-logo">Q</div>
                    <span className="logo-text">Quotations</span>
                </div>
                <nav className="landing-nav">
                    <Link to="/register" className="nav-link">Get Started</Link>
                    <Link to="/login" className="nav-link">Login</Link>
                </nav>
            </header>

            <section className="hero-section">
                <div className="hero-content">
                    <div className="hero-mockup-wrapper">
                        <div className="mockup-img-container">
                            <div className="dashboard-graphic">
                                <div className="graphic-overlay"></div>
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
