---
name: compliance-and-consent
description: Privacy compliance (GDPR, COPPA), cookie consent management, legal page requirements, and analytics integration for regulated web applications. Use when implementing features requiring user consent, building compliance pages, or integrating analytics with consent modes.
---

# Compliance & Consent Standards

## Overview

This project implements comprehensive privacy and compliance standards including:
- **GDPR** (General Data Protection Regulation) for EU users
- **COPPA** (Children's Online Privacy Protection Act) compliance
- **Cookie Consent** system with user preferences
- **Analytics Integration** with consent modes
- **Legal Documentation** pages

---

## Cookie Consent System Architecture

### Purpose
Obtain user consent before tracking personal data or using non-essential cookies.

### User Flow

1. **First Visit**: `CookieConsent` modal appears automatically
2. **User Selection**: Choose preferences:
   - `essential` (always ON) - Required for site functionality
   - `analytics` (optional) - Google Analytics tracking
   - `advertising` (optional) - Ad platform tracking
   - `functional` (optional) - Feature cookies (saved preferences, etc.)
3. **Storage**: Preference saved to `localStorage` as JSON
4. **Persistence**: Modal won't appear again until preferences change
5. **Consent Update**: Google Analytics receives updated consent mode

### Component Implementation

**File**: `src/components/CookieConsent.tsx`

```typescript
export function CookieConsent() {
  const [preferences, setPreferences] = useState<CookiePreferences | null>(null);

  // On mount, check for existing preferences
  useEffect(() => {
    const stored = localStorage.getItem('cookie-consent');
    if (stored) {
      setPreferences(JSON.parse(stored));
    }
  }, []);

  // Handle user selection
  const handleAccept = (prefs: CookiePreferences) => {
    // Save to localStorage
    localStorage.setItem('cookie-consent', JSON.stringify(prefs));
    setPreferences(prefs);

    // Update Google Analytics consent
    window.gtag?.('consent', 'update', {
      'analytics_storage': prefs.analytics ? 'granted' : 'denied',
      'ad_storage': prefs.advertising ? 'granted' : 'denied',
      'functionality_storage': prefs.functional ? 'granted' : 'denied',
    });
  };

  // Don't show if preferences already set
  if (preferences) return null;

  return (
    <Dialog open={true}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cookie & Privacy Preferences</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Essential (always on) */}
          <div>
            <label className="flex items-center gap-2">
              <Checkbox checked disabled />
              <span>Essential Cookies (Required)</span>
            </label>
            <p className="text-sm text-gray-500">
              Required for website functionality (authentication, security)
            </p>
          </div>

          {/* Analytics (user choice) */}
          <div>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={preferences?.analytics ?? false}
                onChange={(e) =>
                  setAnalytics(e.target.checked)
                }
              />
              <span>Analytics</span>
            </label>
            <p className="text-sm text-gray-500">
              Help us improve your experience with usage data
            </p>
          </div>

          {/* Advertising (user choice) */}
          <div>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={preferences?.advertising ?? false}
                onChange={(e) =>
                  setAdvertising(e.target.checked)
                }
              />
              <span>Advertising</span>
            </label>
            <p className="text-sm text-gray-500">
              Personalized ads based on your interests
            </p>
          </div>

          {/* Functional (user choice) */}
          <div>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={preferences?.functional ?? false}
                onChange={(e) =>
                  setFunctional(e.target.checked)
                }
              />
              <span>Functional</span>
            </label>
            <p className="text-sm text-gray-500">
              Remember your preferences and settings
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleAccept({ essential: true, analytics: false, ... })}
          >
            Only Essential
          </Button>
          <Button
            onClick={() => handleAccept({ essential: true, analytics: true, ... })}
          >
            Accept All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### localStorage Data Structure

**Key**: `cookie-consent`
**Value**: JSON object

```json
{
  "essential": true,
  "analytics": true,
  "advertising": false,
  "functional": true
}
```

### Checking Consent in Code

**Pattern**: Always check before tracking

```typescript
// src/lib/analytics.ts
export function trackEvent(eventName: string, eventData?: Record<string, any>) {
  const preferences = JSON.parse(
    localStorage.getItem('cookie-consent') || '{}'
  );

  // Only track if user enabled analytics
  if (!preferences.analytics) {
    console.log('Analytics disabled - event not tracked:', eventName);
    return;
  }

  // Send to Google Analytics
  window.gtag?.('event', eventName, eventData);
}

export function trackPageView(path: string) {
  const preferences = JSON.parse(
    localStorage.getItem('cookie-consent') || '{}'
  );

  if (!preferences.analytics) return;

  window.gtag?.('config', import.meta.env.VITE_GA_MEASUREMENT_ID, {
    page_path: path,
  });
}
```

**Usage in Components:**

```typescript
import { trackEvent } from '@/lib/analytics';

export function ContactForm() {
  function handleSubmit() {
    // ... form submission logic
    trackEvent('form_submitted', { form_type: 'contact' });
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form */}
    </form>
  );
}
```

---

## Google Analytics Integration

### Setup in HTML

**File**: `index.html`

```html
<!DOCTYPE html>
<html>
  <head>
    <!-- Google Analytics with consent mode -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}

      // Default to consent DENIED
      gtag('consent', 'default', {
        'analytics_storage': 'denied',
        'ad_storage': 'denied',
        'functionality_storage': 'denied',
      });

      gtag('js', new Date());
      gtag('config', 'G-XXXXXXXXXX');
    </script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

### Consent Mode Updates

**When user submits preferences:**

```typescript
window.gtag?.('consent', 'update', {
  'analytics_storage': userPreferences.analytics ? 'granted' : 'denied',
  'ad_storage': userPreferences.advertising ? 'granted' : 'denied',
  'functionality_storage': userPreferences.functional ? 'granted' : 'denied',
});
```

### Tracking Events

```typescript
// Once consent is granted, you can track events
window.gtag?.('event', 'page_view', {
  page_path: '/games',
  page_title: 'Games - Games',
});

window.gtag?.('event', 'form_submit', {
  form_type: 'contact',
  form_id: 'contact_form_main',
});

window.gtag?.('event', 'game_clicked', {
  game_name: 'Cave Inc.',
  game_platform: 'Meta Quest',
});
```

---

## GDPR Compliance

### GDPR Requirements Implemented

1. **Consent Before Tracking**
   - Cookie consent modal on first visit
   - No analytics before explicit consent
   - Consent mode defaults to DENIED

2. **Privacy Policy**
   - Comprehensive privacy policy page (`/privacy-policy`)
   - Explains data collection practices
   - Describes retention periods
   - Lists third parties (Supabase, Google Analytics, etc.)

3. **Cookie Policy**
   - Dedicated cookie policy page (`/cookie-policy`)
   - Lists all cookies used
   - Explains duration and purpose
   - Links to manage preferences

4. **Right to Withdraw**
   - Users can update preferences anytime
   - Cookie consent can be reopened via footer link
   - Changes take effect immediately

5. **Data Subject Rights**
   - Privacy policy explains: access, rectification, erasure, portability
   - Contact information for data requests

### Privacy Policy Page

**File**: `src/pages/PrivacyPolicy.tsx`

**Sections Required**:
1. Introduction
2. Information we collect
3. How we use information
4. Legal basis for processing
5. Third-party services
6. Data retention
7. Your rights
8. Contact information
9. Policy updates

---

## COPPA Compliance

### COPPA Requirements (Children Under 13)

**COPPA applies if:**
- You knowingly collect information from children under 13
- You target children as your audience
- You have actual knowledge child is under 13

### Our Implementation

Since this is a game company website (not a children's app), we:

1. **Don't Target Children**
   - Website content is adult-focused (company info, game portfolio)
   - No child-specific data collection

2. **Provide COPPA Compliance Page** (`/coppa-compliance`)
   - Educational resource about COPPA
   - How we comply
   - What parents should know
   - Links to FTC resources

3. **No Persistent Identifiers** (for children)
   - No third-party trackers that persist identifiers
   - Analytics respects consent

4. **Parental Contact**
   - Privacy policy includes contact for parental concerns

---

## Legal Pages Checklist

### Required Pages

- **Privacy Policy** (`/privacy-policy`)
- **Cookie Policy** (`/cookie-policy`)
- **Terms of Service** (`/terms-of-service`)
- **GDPR Compliance** (`/gdpr-compliance`)
- **COPPA Compliance** (`/coppa-compliance`)

---

## Third-Party Services & Consent

### Google Analytics

**Purpose**: Track usage patterns, improve UX
**Consent Required**: Yes (analytics)
**Data Collected**: Page views, events, device info, browser info
**Retention**: 14 months default
**GDPR**: Requires Data Processing Agreement (DPA)

### Supabase

**Purpose**: Backend services, contact form storage, authentication
**Consent Required**: No (legitimate interest for service provision)
**Data Collected**: Contact form submissions, user accounts
**Retention**: As per application requirements
**GDPR**: Covered by Supabase DPA

---

## Implementation Checklist

### For New Features Requiring Consent

- [ ] Check if user consent is needed (ask for tracking data)
- [ ] Add consent check before collecting/sending data
- [ ] Document in privacy policy
- [ ] Add to cookie policy if using cookies
- [ ] Update GDPR/COPPA pages if applicable
- [ ] Test with consent disabled

### For New Legal Requirements

- [ ] Update relevant policy page
- [ ] Add footer link if new page
- [ ] Notify users of changes
- [ ] Maintain version history in policy

---

## Best Practices

### Consent Management

1. **Default to Deny** - Never pre-check non-essential categories
2. **Clear Language** - Explain what data is collected in plain English
3. **Easy Withdrawal** - Allow users to change preferences anytime
4. **Respect Choice** - Immediately apply new preferences

### Privacy Policy

1. **Keep Updated** - Review and update at least yearly
2. **Be Transparent** - Clearly explain all data practices
3. **Honest Language** - Avoid misleading or vague descriptions
4. **Easy to Find** - Link from every page footer

### Data Minimization

1. **Only Collect What's Needed** - Don't collect "just in case"
2. **Delete When Done** - Set retention limits
3. **Anonymize When Possible** - Remove identifying information
4. **Audit Regularly** - Review what data you're actually using

---

## Resources

### Legal References
- GDPR Official: https://gdpr-info.eu/
- COPPA FTC: https://www.ftc.gov/business-guidance/privacy-security/coppa
- ePrivacy Directive: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32002L0058

### Tools & Services
- Google Consent Mode: https://support.google.com/analytics/answer/9976101
- Supabase DPA: https://supabase.com/legal/dpa
- Privacy Policy Generator: https://www.privacypolicies.com/ (reference only)
