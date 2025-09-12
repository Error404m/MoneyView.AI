'use client';

import { useEffect, useState } from 'react';
import { 
  CreditCard, 
  Building2, 
  FileText, 
  Download, 
  Search,
  Bell,
  Settings,
  User,
  Menu,
  X,
  Calendar,
  TrendingUp,
  Wallet,
  Eye,
  LogOut,
  MessageSquare
} from 'lucide-react';

type PdfDoc = {
  subject: string;
  filename: string;
  message_id: string;
  saved_path?: string | null;
  total_amount_due?: number | null;
  minimum_amount_due?: number | null;
  due_date?: string | null; 
  days_left?: number | null;
  password_required?: boolean;
};

type PdfApiResponse = {
  pdf_attachments: PdfDoc[];
};

type NavItem = 'dashboard' | 'bank' | 'credit' | 'all' | 'settings';

export default function DashboardPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<PdfApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeNav, setActiveNav] = useState<NavItem>('dashboard');

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<PdfDoc | null>(null);
  const [previewPassword, setPreviewPassword] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [aiChatOpen, setAIChatOpen] = useState(false);


  // --- Add state for chat ---
const [messages, setMessages] = useState([
  { role: 'assistant', content: "👋 Hello! I'm your NoneyView.AI assistant. How can I help you today?" }
]);

const [chatInput, setChatInput] = useState('');
const [chatLoading, setChatLoading] = useState(false);

// --- Function to call llama API ---
const sendMessage = async () => {
  if (!chatInput.trim()) return;

  // Add user message to chat
  setMessages((prev) => [...prev, { role: 'user', content: chatInput }]);
  const userMessage = chatInput;
  setChatInput('');
  setChatLoading(true);

  try {
    const res = await fetch("http://0.0.0.0:8087/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "meta-llama/Llama-3.3-70B-Instruct",
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!res.ok) {
      throw new Error("Failed to connect with Llama server");
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content || "⚠️ No response from Llama.";

    setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
  } catch (err: any) {
    setMessages((prev) => [...prev, { role: 'error', content: `❌ Error: ${err.message}` }]);
  } finally {
    setChatLoading(false);
  }
};


  useEffect(() => {
    const email = localStorage.getItem("user_email");
    setUserEmail(email);
    
    if (email) {
      fetchPdfData(email);
    }

    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

  const fetchPdfData = async (email: string) => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8000/gmail/list-pdfs?user_email=${encodeURIComponent(email)}`);
      const data: PdfApiResponse = await response.json();
      setPdfData(data);
    } catch (error) {
      console.error('Error fetching PDF data:', error);
    } finally {
      setLoading(false);
    }
  };

  const categorizeDocuments = (documents: PdfDoc[] | undefined) => {
    if (!documents) return { bankStatements: [] as PdfDoc[], creditCards: [] as PdfDoc[], others: [] as PdfDoc[] };
    
    const bankStatements: PdfDoc[] = [];
    const creditCards: PdfDoc[] = [];
    const others: PdfDoc[] = [];

    documents.forEach((doc: PdfDoc) => {
      const subject = doc.subject.toLowerCase();
      const filename = doc.filename.toLowerCase();
      
      if (subject.includes('credit card') || subject.includes('card statement') || filename.includes('credit')) {
        creditCards.push(doc);
      } else if (subject.includes('bank') && (subject.includes('statement') || subject.includes('estatement'))) {
        bankStatements.push(doc);
      } else {
        others.push(doc);
      }
    });

    return { bankStatements, creditCards, others };
  };

  const filteredDocuments: PdfDoc[] | undefined = pdfData?.pdf_attachments?.filter((doc: PdfDoc) => 
    doc.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { bankStatements, creditCards, others } = categorizeDocuments(filteredDocuments);

  const getUsername = (email: string | null) => {
    return email ? email.split('@')[0] : 'User';
  };

  const formatDate = (subject: string) => {
    const monthMatch = subject.match(/(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s-]*(\d{4})/i);
    return monthMatch ? `${monthMatch[1]} ${monthMatch[2]}` : 'Recent';
  };

  const buildDownloadUrl = (doc: PdfDoc): string | null => {
    if (!userEmail) return null;
    const base = 'http://localhost:8000/gmail/download';
    const params = new URLSearchParams({
      user_email: userEmail,
      message_id: doc.message_id,
      filename: doc.filename,
    });
    return `${base}?${params.toString()}`;
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPasswordRequired(false);
    setPreviewPassword('');
    setPreviewError(null);
    setPreviewDoc(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const fetchPreview = async (doc: PdfDoc, maybePassword?: string) => {
    if (!userEmail) return;
    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const res = await fetch('http://localhost:8000/gmail/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: userEmail,
          message_id: doc.message_id,
          filename: doc.filename,
          password: maybePassword || undefined,
        }),
      });

      if (res.status === 401) {
        // try to parse reason
        let reason = '';
        try { const j = await res.json(); reason = j?.detail || ''; } catch {}
        setPasswordRequired(true);
        if (reason === 'PASSWORD_INCORRECT') {
          setPreviewError('Incorrect password. Please try again.');
        } else {
          setPreviewError(null);
        }
      } else if (!res.ok) {
        let msg = 'Failed to load preview';
        try { const j = await res.json(); msg = j?.detail || msg; } catch {}
        setPreviewError(msg);
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(url);
        setPasswordRequired(false);
      }
    } catch (e: any) {
      setPreviewError(e?.message || 'Unexpected error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const openPreview = async (doc: PdfDoc) => {
    setPreviewDoc(doc);
    setPreviewOpen(true);
    setPasswordRequired(false);
    setPreviewPassword('');
    setPreviewError(null);
    setPreviewUrl(null);
    await fetchPreview(doc);
  };

  const formatINR = (value?: number | null) => {
    if (value === undefined || value === null || Number.isNaN(value)) return '-';
    try {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
    } catch {
      return `₹${value.toFixed(2)}`;
    }
  };

  const formatDue = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  // Calculate credit card summary data
  const getCreditCardSummary = () => {
    if (!creditCards.length) return { totalAmount: 0, remainingDue: 0, remainingMinDue: 0 };
    
    let totalAmount = 0;
    let remainingDue = 0;
    let remainingMinDue = 0;
    
    creditCards.forEach(card => {
      if (typeof card.total_amount_due === 'number') {
        totalAmount += card.total_amount_due;
        if (typeof card.days_left === 'number' && card.days_left > 0) {
          remainingDue += card.total_amount_due;
        }
      }
      if (typeof card.minimum_amount_due === 'number' && typeof card.days_left === 'number' && card.days_left > 0) {
        remainingMinDue += card.minimum_amount_due;
      }
    });
    
    return { totalAmount, remainingDue, remainingMinDue };
  };

  const creditSummary = getCreditCardSummary();

  const handleNavClick = (navItem: NavItem) => {
    setActiveNav(navItem);
    setSidebarOpen(false); // Close sidebar on mobile after navigation
  };

  const handleLogout = () => {
    localStorage.removeItem("user_email");
    // Redirect to login page or home
    window.location.href = "/"; // Adjust this path as needed
  };

  const renderContent = () => {
    switch (activeNav) {
      case 'dashboard':
        return (
          <>
           
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium">Account Balance</p>
                    <p className="text-2xl font-bold">₹39,865</p>
                  </div>
                  <Wallet className="w-8 h-8 text-green-200" />
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">Total Amount Due</p>
                    <p className="text-2xl font-bold">{formatINR(creditSummary.totalAmount)}</p>
                  </div>
                  <CreditCard className="w-8 h-8 text-blue-200" />
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-orange-600 to-orange-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm font-medium">Total Remaining Due Now</p>
                    <p className="text-2xl font-bold">{formatINR(creditSummary.remainingDue)}</p>
                    <p className="text-orange-200 text-xs">Future due dates</p>
                  </div>
                  <Calendar className="w-8 h-8 text-orange-200" />
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium">Total Remaining Minimum Due Now</p>
                    <p className="text-2xl font-bold">{formatINR(creditSummary.remainingMinDue)}</p>
                    <p className="text-purple-200 text-xs">Future due dates</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-purple-200" />
                </div>
              </div>
            </div>

            {/* Bank Statements Section */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Bank Statements</h2>
                  <p className="text-sm text-gray-500">{bankStatements.length} statements available</p>
                </div>
              </div>
              
              {bankStatements.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {bankStatements.map((doc, index) => (
                    <DocumentCard 
                      key={index} 
                      doc={doc} 
                      icon={Building2} 
                      color="bg-gradient-to-br from-blue-500 to-blue-600" 
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                  <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No bank statements found</p>
                </div>
              )}
            </section>

            {/* Credit Cards Section */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Credit Card Statements</h2>
                  <p className="text-sm text-gray-500">{creditCards.length} statements available</p>
                </div>
              </div>
              
              {creditCards.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {creditCards.map((doc, index) => (
                    <DocumentCard 
                      key={index} 
                      doc={doc} 
                      icon={CreditCard} 
                      color="bg-gradient-to-br from-purple-500 to-purple-600" 
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                  <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No credit card statements found</p>
                </div>
              )}
            </section>

            {/* Other Documents */}
            {others.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Other Documents</h2>
                    <p className="text-sm text-gray-500">{others.length} documents available</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {others.map((doc, index) => (
                    <DocumentCard 
                      key={index} 
                      doc={doc} 
                      icon={FileText} 
                      color="bg-gradient-to-br from-gray-500 to-gray-600" 
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        );

      case 'bank':
        return (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Bank Statements</h2>
                <p className="text-sm text-gray-500">{bankStatements.length} statements available</p>
              </div>
            </div>
            
            {bankStatements.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {bankStatements.map((doc, index) => (
                  <DocumentCard 
                    key={index} 
                    doc={doc} 
                    icon={Building2} 
                    color="bg-gradient-to-br from-blue-500 to-blue-600" 
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No bank statements found</p>
              </div>
            )}
          </section>
        );

      case 'credit':
        return (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Credit Card Statements</h2>
                <p className="text-sm text-gray-500">{creditCards.length} statements available</p>
              </div>
            </div>
            
            {creditCards.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {creditCards.map((doc, index) => (
                  <DocumentCard 
                    key={index} 
                    doc={doc} 
                    icon={CreditCard} 
                    color="bg-gradient-to-br from-purple-500 to-purple-600" 
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No credit card statements found</p>
              </div>
            )}
          </section>
        );

      case 'all':
        return (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">All Documents</h2>
                <p className="text-sm text-gray-500">{pdfData?.pdf_attachments?.length || 0} documents available</p>
              </div>
            </div>
            
            {filteredDocuments && filteredDocuments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredDocuments.map((doc, index) => (
                  <DocumentCard 
                    key={index} 
                    doc={doc} 
                    icon={FileText} 
                    color="bg-gradient-to-br from-gray-500 to-gray-600" 
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No documents found</p>
              </div>
            )}
          </section>
        );

      case 'settings':
        return (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <Settings className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Settings</h2>
                <p className="text-sm text-gray-500">Manage your account preferences</p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">Account Email</h3>
                    <p className="text-sm text-gray-500">{userEmail}</p>
                  </div>
                  <button className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Change
                  </button>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">Notifications</h3>
                    <p className="text-sm text-gray-500">Manage email and push notifications</p>
                  </div>
                  <button className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Configure
                  </button>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">Data Export</h3>
                    <p className="text-sm text-gray-500">Export your financial data</p>
                  </div>
                  <button className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Export
                  </button>
                </div>
              </div>
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  type DocumentCardProps = { doc: PdfDoc; icon: React.ComponentType<{ className?: string }>; color: string };
  const DocumentCard = ({ doc, icon: Icon, color }: DocumentCardProps) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-200 hover:border-blue-200">
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm leading-5 mb-2 line-clamp-2">
            {doc.subject}
          </h3>
          <p className="text-xs text-gray-500 mb-3 font-medium">{doc.filename}</p>

          {/* Credit card details */}
          {(typeof doc.total_amount_due === 'number' || typeof doc.minimum_amount_due === 'number' || doc.due_date) && (
            <div className="mb-3 grid grid-cols-3 gap-2">
              <div className="bg-blue-50 rounded-lg p-2">
                <p className="text-[10px] text-blue-600 font-medium">Total Due</p>
                <p className="text-xs font-semibold text-blue-700">{formatINR(doc.total_amount_due)}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-2">
                <p className="text-[10px] text-purple-600 font-medium">Min Due</p>
                <p className="text-xs font-semibold text-purple-700">{formatINR(doc.minimum_amount_due)}</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-2">
                <p className="text-[10px] text-amber-600 font-medium">Due Date</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-amber-700">{formatDue(doc.due_date)}</p>
                  {typeof doc.days_left === 'number' && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${doc.days_left <= 3 ? 'bg-red-100 text-red-700' : doc.days_left <= 7 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                      {doc.days_left}d
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full font-medium">
              {formatDate(doc.subject)}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => openPreview(doc)}
                className="flex items-center gap-1 text-xs text-gray-600 hover:text-blue-600 transition-colors"
              >
                <Eye className="w-3 h-3" />
                Preview
              </button>
              {buildDownloadUrl(doc) ? (
                <a
                  href={buildDownloadUrl(doc) as string}
                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-blue-600 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="w-3 h-3" />
                  Download
                </a>
              ) : (
                <button className="flex items-center gap-1 text-xs text-gray-400 cursor-not-allowed" disabled>
                  <Download className="w-3 h-3" />
                  Download
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transition-transform duration-300 ease-in-out`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900">FinanceHub</span>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-md hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="mt-6 px-3">
          <div className="space-y-1">
            <button 
              onClick={() => handleNavClick('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeNav === 'dashboard' 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <TrendingUp className="w-5 h-5" />
              Dashboard
            </button>
            <button 
              onClick={() => handleNavClick('bank')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeNav === 'bank' 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Building2 className="w-5 h-5" />
              Bank Statements
            </button>
            <button 
              onClick={() => handleNavClick('credit')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeNav === 'credit' 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              Credit Cards
            </button>
            <button 
              onClick={() => handleNavClick('all')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeNav === 'all' 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FileText className="w-5 h-5" />
              All Documents
            </button>
            <button 
              onClick={() => handleNavClick('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeNav === 'settings' 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Settings className="w-5 h-5" />
              Settings
            </button>
            <button 
              onClick={() => setAIChatOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors text-gray-700 hover:bg-gray-50 hover:text-blue-600"
            >
              <MessageSquare className="w-5 h-5" />
              AI Chat
            </button>
          </div>
          
          {/* Logout Section */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </nav>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 lg:px-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md hover:bg-gray-100"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {activeNav === 'dashboard' && 'Welcome back, '}
                  {activeNav === 'bank' && 'Bank Statements'}
                  {activeNav === 'credit' && 'Credit Card Statements'}
                  {activeNav === 'all' && 'All Documents'}
                  {activeNav === 'settings' && 'Settings'}
                  {activeNav === 'dashboard' && (userEmail ? getUsername(userEmail) : 'User') + '! 👋'}
                </h1>
                <p className="text-sm text-gray-500">
                  {activeNav === 'dashboard' && "Here's your financial overview"}
                  {activeNav === 'bank' && `${bankStatements.length} statements available`}
                  {activeNav === 'credit' && `${creditCards.length} statements available`}
                  {activeNav === 'all' && `${pdfData?.pdf_attachments?.length || 0} documents available`}
                  {activeNav === 'settings' && 'Manage your account preferences'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                />
              </div>
              <button className="p-2 rounded-lg hover:bg-gray-100 relative">
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
              </button>
              <button className="p-2 rounded-lg hover:bg-gray-100">
                <Settings className="w-5 h-5 text-gray-600" />
              </button>
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Search Bar for Mobile */}
              <div className="sm:hidden">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Dynamic Content Based on Navigation */}
              {renderContent()}
            </div>
          )}
        </main>

        {/* Bottom Bar */}
        <footer className="bg-white border-t border-gray-200 px-4 lg:px-6 py-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <p>© 2025 FinanceHub. All rights reserved.</p>
            <p>Last updated: {new Date().toLocaleDateString()}</p>
          </div>
        </footer>
      </div>

      {/* Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">{previewDoc?.filename}</h3>
              <button onClick={closePreview} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {previewLoading && (
                <div className="flex items-center justify-center h-24">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}

              {previewError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 p-2 rounded">
                  {previewError}
                </div>
              )}

              {passwordRequired && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (previewDoc) await fetchPreview(previewDoc, previewPassword);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="password"
                    value={previewPassword}
                    onChange={(e) => setPreviewPassword(e.target.value)}
                    placeholder="Enter PDF password"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-600 disabled:opacity-50"
                    disabled={previewLoading}
                  >
                    {previewLoading ? 'Verifying...' : 'Unlock'}
                  </button>
                </form>
              )}

              {previewUrl && (
                <div className="h-[70vh] border border-gray-200 rounded">
                  <iframe src={previewUrl} className="w-full h-full" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Chat Modal */}
      {aiChatOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Moneyview.AI ChatBot</h3>
                  <p className="text-blue-100 text-sm">Powered by meta-llama/Llama-3.3-70B-Instruct</p>
                </div>
              </div>
              <button 
                onClick={() => setAIChatOpen(false)}
                className="p-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Messages Area */}
           {/* Chat Messages Area */}
<div className="flex-1 p-4 overflow-y-auto bg-gray-50">
  {messages.map((msg, i) => (
    <div key={i} className={`flex items-start gap-3 mb-6 ${msg.role === 'user' ? 'justify-end' : ''}`}>
      {msg.role !== 'user' && (
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
          <MessageSquare className="w-4 h-4 text-white" />
        </div>
      )}
      <div
        className={`px-4 py-3 rounded-2xl shadow-sm max-w-full ${
          msg.role === 'user'
            ? 'bg-blue-600 text-white rounded-tr-md'
            : msg.role === 'assistant'
            ? 'bg-white text-gray-800 rounded-tl-md'
            : 'bg-red-100 text-red-700'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
      </div>
      {msg.role === 'user' && (
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  ))}
  {chatLoading && <p className="text-sm text-gray-500">⏳ Thinking...</p>}
</div>

            
         

            <div className="border-t border-gray-200 p-4 bg-white">
  <div className="flex items-center gap-3">
    <div className="flex-1 relative">
      <input
        type="text"
        placeholder="Ask me anything about your finances..."
        value={chatInput}
        onChange={(e) => setChatInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <button
        onClick={sendMessage}
        disabled={chatLoading}
        className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-blue-600 transition-colors"
      >
        <MessageSquare className="w-4 h-4" />
      </button>
    </div>
    <button
      onClick={sendMessage}
      disabled={chatLoading}
      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
    >
      {chatLoading ? "Sending..." : "Send"}
    </button>
  </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                AI responses are for informational purposes only. Always verify with your financial institution.
              </p>
            </div>
          </div>
        </div>
      )}




    </div>
  );
}