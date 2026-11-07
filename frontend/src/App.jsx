import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './context/AuthContext'
import AuthModal from './components/AuthModal'
import Header from './components/Header'
import Footer from './components/Footer'
import WhatsAppFloat from './components/WhatsAppFloat'
import Home from './pages/Home'
import About from './pages/About'
import FounderDesk from './pages/FounderDesk'
import Activities from './pages/Activities'
import Gallery from './pages/Gallery'
import Volunteers from './pages/Volunteers'
import TrustMemberRegister from './pages/TrustMemberRegister'
import TrustMembership from './pages/TrustMembership'
import PortalLayout from './pages/portal/PortalLayout'
import PortalHome from './pages/portal/PortalHome'
import PortalJoin from './pages/portal/PortalJoin'
import PortalMembers from './pages/portal/PortalMembers'
import PortalDonors from './pages/portal/PortalDonors'
import PortalStats from './pages/portal/PortalStats'
import PortalMonthlyDonor from './pages/portal/PortalMonthlyDonor'
import PortalLogin from './pages/portal/PortalLogin'
import PortalSignup from './pages/portal/PortalSignup'
import PortalForgotPassword from './pages/portal/PortalForgotPassword'
import PortalProfile from './pages/portal/PortalProfile'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'
import Donate from './pages/Donate'
import Contact from './pages/Contact'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsConditions from './pages/TermsConditions'
import NotFound from './pages/NotFound'
import ScrollToTop from './components/ScrollToTop'
import SEOManager from './components/SEOManager'
import CauseEducation from './pages/CauseEducation'
import CauseHealthcare from './pages/CauseHealthcare'
import CauseFoodDistribution from './pages/CauseFoodDistribution'
import CauseWomenEmpowerment from './pages/CauseWomenEmpowerment'
import CauseSeniorCitizens from './pages/CauseSeniorCitizens'
import CauseDisasterRelief from './pages/CauseDisasterRelief'
import CauseBloodDonation from './pages/CauseBloodDonation'
import CauseAnimalWelfare from './pages/CauseAnimalWelfare'

// Layout wrapper for main site pages (with Header/Footer)
function MainLayout({ children }) {
  return (
    <>
      <Header />
      <AuthModal />
      <main>{children}</main>
      <Footer />
      <WhatsAppFloat />
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <SEOManager />
        <Routes>
          {/* ── Standalone Trust Portal System (Separate Layout & Pages) ── */}
          <Route path="/portal" element={<PortalLayout />}>
            <Route index element={<PortalHome />} />
            <Route path="join" element={<PortalJoin />} />
            <Route path="become-a-member" element={<PortalJoin />} />
            <Route path="members" element={<PortalMembers />} />
            <Route path="trust-members" element={<PortalMembers />} />
            <Route path="donors" element={<PortalDonors />} />
            <Route path="top-donors" element={<PortalDonors />} />
            <Route path="stats" element={<PortalStats />} />
            <Route path="dashboard" element={<PortalStats />} />
            <Route path="monthly-donor" element={<PortalMonthlyDonor />} />
            <Route path="subscribe" element={<PortalMonthlyDonor />} />
            <Route path="login" element={<PortalLogin />} />
            <Route path="signin" element={<PortalLogin />} />
            <Route path="signup" element={<PortalSignup />} />
            <Route path="register" element={<PortalSignup />} />
            <Route path="forgot-password" element={<PortalForgotPassword />} />
            <Route path="profile" element={<PortalProfile />} />
            <Route path="account" element={<PortalProfile />} />
          </Route>

          {/* Direct aliases for /members routes */}
          <Route path="/members" element={<PortalLayout />}>
            <Route index element={<PortalMembers />} />
            <Route path="join" element={<PortalJoin />} />
            <Route path="donors" element={<PortalDonors />} />
            <Route path="stats" element={<PortalStats />} />
            <Route path="monthly-donor" element={<PortalMonthlyDonor />} />
          </Route>

          <Route path="/monthly-donor" element={<PortalLayout />}>
            <Route index element={<PortalMonthlyDonor />} />
          </Route>
          <Route path="/subscribe" element={<PortalLayout />}>
            <Route index element={<PortalMonthlyDonor />} />
          </Route>

          {/* ── Main site pages (WITH header/footer) ── */}
          <Route path="/*" element={
            <MainLayout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/founder-desk" element={<FounderDesk />} />
                <Route path="/activities" element={<Activities />} />
                <Route path="/gallery" element={<Gallery />} />

                {/* Volunteer Registration & Careers */}
                <Route path="/volunteers" element={<Volunteers />} />
                <Route path="/register/volunteer" element={<Volunteers />} />
                <Route path="/careers" element={<Volunteers />} />

                {/* Trust Member Registration & Subscription */}
                <Route path="/register/trust-member" element={<TrustMemberRegister />} />
                <Route path="/trust-membership" element={<TrustMemberRegister />} />

                {/* Member & Volunteer Portal */}
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/profile" element={<Dashboard />} />

                {/* High-Capacity Admin & Velocity Analytics */}
                <Route path="/admin" element={<Admin />} />

                {/* Donations & Payment Gateway */}
                <Route path="/donate" element={<Donate />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/terms-conditions" element={<TermsConditions />} />

                {/* Cause pages */}
                <Route path="/causes/education" element={<CauseEducation />} />
                <Route path="/causes/healthcare" element={<CauseHealthcare />} />
                <Route path="/causes/food-distribution" element={<CauseFoodDistribution />} />
                <Route path="/causes/women-empowerment" element={<CauseWomenEmpowerment />} />
                <Route path="/causes/senior-citizens" element={<CauseSeniorCitizens />} />
                <Route path="/causes/disaster-relief" element={<CauseDisasterRelief />} />
                <Route path="/causes/blood-donation" element={<CauseBloodDonation />} />
                <Route path="/causes/animal-welfare" element={<CauseAnimalWelfare />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </MainLayout>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
