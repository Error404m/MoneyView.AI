"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Github, 
  Mail, 
  Shield, 
  Zap, 
  BarChart3, 
  ArrowRight, 
  CheckCircle, 
  Star,
  Brain,
  Lock,
  Sparkles,
  TrendingUp,
  FileText,
  Database,
  Sun,
  Moon
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function HomePage() {
  const router = useRouter();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // const [email, setEmail] = useState("");

  // useEffect(() => {
  //   const userEmail = localStorage.getItem("user_email");
  //   if (userEmail) setEmail(userEmail);
  // }, []);

  useEffect(() => {
    setIsVisible(true);
    
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleGoogleLogin = () => {
    window.location.href = "http://localhost:8000/auth/login";
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const features = [
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Military-Grade Security",
      description: "Enterprise-level encryption with OAuth 2.0 and zero-knowledge architecture. Your data never leaves your control.",
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      icon: <Brain className="w-8 h-8" />,
      title: "AI-Powered Intelligence",
      description: "Advanced ML algorithms automatically categorize, extract, and analyze financial data with 99.7% accuracy.",
      gradient: "from-purple-500 to-pink-500"
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Lightning Performance",
      description: "Process thousands of documents in seconds with our optimized cloud infrastructure and edge computing.",
      gradient: "from-yellow-500 to-orange-500"
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: "Advanced Analytics",
      description: "Real-time insights, predictive modeling, and custom dashboards that transform raw data into actionable intelligence.",
      gradient: "from-green-500 to-emerald-500"
    },
    {
      icon: <Database className="w-8 h-8" />,
      title: "Smart Data Extraction",
      description: "Intelligent parsing of complex financial documents with context-aware field detection and validation.",
      gradient: "from-indigo-500 to-blue-500"
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "Predictive Insights",
      description: "AI-driven forecasting and trend analysis to help you make informed financial decisions with confidence.",
      gradient: "from-red-500 to-pink-500"
    }
  ];

  const stats = [
    { number: "99.7%", label: "Accuracy Rate" },
    { number: "10M+", label: "Documents Processed" },
    { number: "50ms", label: "Average Processing Time" },
    { number: "256-bit", label: "Encryption Standard" }
  ];

  const themeClasses = {
    background: isDarkMode 
      ? "bg-black text-white" 
      : "bg-gradient-to-br from-gray-50 via-white to-blue-50 text-gray-900",
    gradientOverlay: isDarkMode
      ? "bg-gradient-to-br from-gray-900 via-black to-gray-800"
      : "bg-gradient-to-br from-blue-50 via-white to-purple-50",
    radialGradient: isDarkMode
      ? "bg-[radial-gradient(circle_at_50%_50%,rgba(76,29,149,0.1),transparent)]"
      : "bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.05),transparent)]",
    mouseGradient: isDarkMode
      ? "rgba(59,130,246,0.1)"
      : "rgba(59,130,246,0.05)",
    particleColor: isDarkMode ? "bg-blue-500/20" : "bg-blue-500/30",
    headerText: isDarkMode 
      ? "bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent"
      : "bg-gradient-to-r from-gray-900 via-blue-900 to-gray-900 bg-clip-text text-transparent",
    accentText: isDarkMode
      ? "bg-gradient-to-r from-blue-400 via-purple-500 to-cyan-400 bg-clip-text text-transparent"
      : "bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent",
    bodyText: isDarkMode ? "text-gray-300" : "text-gray-600",
    cardBg: isDarkMode 
      ? "bg-gradient-to-br from-gray-900/50 to-gray-800/50 border-gray-700/50"
      : "bg-gradient-to-br from-white/80 to-gray-50/80 border-gray-200/50",
    cardHoverBorder: isDarkMode ? "hover:border-gray-600" : "hover:border-gray-300",
    cardText: isDarkMode ? "text-gray-400 group-hover:text-gray-300" : "text-gray-600 group-hover:text-gray-700",
    cardTitle: isDarkMode ? "group-hover:text-white" : "group-hover:text-gray-900",
    trustCardBg: isDarkMode 
      ? "bg-gradient-to-r from-gray-900/80 to-gray-800/80 border-gray-700/50"
      : "bg-gradient-to-r from-white/90 to-gray-50/90 border-gray-200/50",
    ctaCardBg: isDarkMode
      ? "bg-gradient-to-r from-gray-900/90 to-gray-800/90 border-gray-700/50"
      : "bg-gradient-to-r from-white/95 to-gray-50/95 border-gray-200/50",
    footerBorder: isDarkMode ? "border-gray-800/50" : "border-gray-200/50",
    footerText: isDarkMode ? "text-gray-500" : "text-gray-400",
    iconColor: isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
  };

  return (
    <div className={`min-h-screen overflow-hidden relative transition-all duration-500 ${themeClasses.background}`}>
      {/* Theme Toggle Button */}
      <Button
        onClick={toggleTheme}
        className={`fixed top-6 right-6 z-50 p-3 rounded-full transition-all duration-300 ${
          isDarkMode 
            ? "bg-gray-800 hover:bg-gray-700 text-yellow-400" 
            : "bg-white hover:bg-gray-50 text-gray-700 shadow-lg border border-gray-200"
        }`}
        size="sm"
      >
        {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </Button>

      {/* Animated Background */}
      <div className={`absolute inset-0 ${themeClasses.gradientOverlay}`}>
        <div className={`absolute inset-0 ${themeClasses.radialGradient}`}></div>
        <div 
          className="absolute inset-0 opacity-30 transition-all duration-300"
          style={{
            background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, ${themeClasses.mouseGradient}, transparent)`
          }}
        ></div>
      </div>

      {/* Floating Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className={`absolute w-2 h-2 ${themeClasses.particleColor} rounded-full animate-pulse`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 3}s`
            }}
          ></div>
        ))}
      </div>

      <div className="relative z-10 px-6 py-12">
        {/* Hero Section */}
        <div className={`max-w-7xl mx-auto text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="mb-6">
            <span className={`inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-full text-sm font-medium backdrop-blur-sm ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
              <Sparkles className="w-4 h-4" />
              Powered by Advanced AI Technology
            </span>
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black leading-tight tracking-tight mb-8">
            <span className={themeClasses.headerText}>
              Next-Gen
            </span>
            <br />
            <span className={themeClasses.accentText}>
              Financial Intelligence
            </span>
          </h1>
          
          <p className={`text-xl md:text-2xl ${themeClasses.bodyText} max-w-4xl mx-auto mb-12 leading-relaxed`}>
            Revolutionary AI-powered platform that transforms your Gmail into a sophisticated financial data hub. 
            Extract, decrypt, and analyze PDF documents with unprecedented speed and accuracy.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Button
              onClick={handleGoogleLogin}
              className="group relative px-8 py-4 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-300 rounded-xl shadow-2xl hover:shadow-blue-500/25 hover:scale-105 border border-blue-500/20 text-white"
            >
              <span className="flex items-center gap-3">
                <Zap className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                Launch Platform
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Button>
            
            {/* <Button
              variant="outline"
              className={`px-8 py-4 text-lg font-semibold bg-transparent border-2 transition-all duration-300 rounded-xl backdrop-blur-sm ${
                isDarkMode 
                  ? "border-gray-600 hover:border-white hover:bg-white/5 text-white" 
                  : "border-gray-300 hover:border-gray-500 hover:bg-gray-50 text-gray-700"
              }`}
            >
              <FileText className="w-5 h-5 mr-2" />
              View Demo
            </Button> */}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto mb-20">
            {stats.map((stat, index) => (
              <div key={index} className="text-center group">
                <div className={`text-3xl md:text-4xl font-black ${themeClasses.accentText} group-hover:scale-110 transition-transform`}>
                  {stat.number}
                </div>
                <div className={`text-sm ${themeClasses.bodyText} mt-2`}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-7xl mx-auto mb-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className={themeClasses.headerText}>
                Cutting-Edge Features
              </span>
            </h2>
            <p className={`text-xl ${themeClasses.bodyText} max-w-3xl mx-auto`}>
              Experience the future of financial document processing with our suite of advanced AI-powered tools
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card
                key={index}
                className={`group relative ${themeClasses.cardBg} border ${themeClasses.cardHoverBorder} rounded-2xl transition-all duration-500 hover:scale-105 hover:shadow-2xl backdrop-blur-sm overflow-hidden transform transition-all delay-${index * 100}`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}></div>
                
                <CardContent className="relative p-8">
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${feature.gradient} mb-6 group-hover:scale-110 transition-transform text-white`}>
                    {feature.icon}
                  </div>
                  
                  <h3 className={`text-xl font-bold mb-4 transition-colors ${themeClasses.cardTitle}`}>
                    {feature.title}
                  </h3>
                  
                  <p className={`leading-relaxed transition-colors ${themeClasses.cardText}`}>
                    {feature.description}
                  </p>
                  
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className={`w-5 h-5 ${themeClasses.cardText}`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="max-w-6xl mx-auto mb-20">
          <Card className={`${themeClasses.trustCardBg} border rounded-3xl backdrop-blur-sm`}>
            <CardContent className="p-12 text-center">
              <div className="flex items-center justify-center gap-2 mb-6">
                <Shield className="w-8 h-8 text-green-500" />
                <h3 className="text-2xl font-bold">Enterprise-Grade Security</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className={themeClasses.bodyText}>SOC 2 Type II Certified</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className={themeClasses.bodyText}>GDPR & CCPA Compliant</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className={themeClasses.bodyText}>256-bit AES Encryption</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="max-w-4xl mx-auto text-center mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl blur-xl"></div>
            <Card className={`relative ${themeClasses.ctaCardBg} border rounded-3xl backdrop-blur-sm`}>
              <CardContent className="p-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Ready to Transform Your Financial Workflow?
                </h2>
                <p className={`text-xl ${themeClasses.bodyText} mb-8`}>
                  Join thousands of professionals who've revolutionized their document processing with our AI platform
                </p>
                <Button
                  onClick={handleGoogleLogin}
                  className="px-12 py-4 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-300 rounded-xl shadow-2xl hover:shadow-blue-500/25 hover:scale-105 text-white"
                >
                  <Sparkles className="w-5 h-5 mr-3" />
                  Start Free Trial
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <footer className={`text-center py-8 border-t ${themeClasses.footerBorder}`}>
          <div className="flex items-center justify-center gap-6 mb-4">
            <a href="#" className={`transition-colors ${themeClasses.iconColor}`}>
              <Github className="w-5 h-5" />
            </a>
            <a href="#" className={`transition-colors ${themeClasses.iconColor}`}>
              <Mail className="w-5 h-5" />
            </a>
          </div>
          <p className={`text-sm ${themeClasses.footerText}`}>
            © {new Date().getFullYear()} JRB MoneyView.AI · Redefining Financial Intelligence
          </p>
        </footer>
      </div>
    </div>
  );
}