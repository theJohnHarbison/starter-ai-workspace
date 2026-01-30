---
name: react-typescript-standards
description: React component architecture, patterns, state management, routing, styling, and Supabase integration for web applications. Use when building or modifying React components, pages, forms, or managing application state.
---

# React/TypeScript Standards

## Project Architecture

### High-Level Structure

React SPA with client-side routing and global state providers:

```
Entry Point (index.html) → main.tsx (React root)
    ↓
App.tsx (Routing + Global Context Providers)
    ├── React Router (BrowserRouter + Routes)
    ├── React Query (QueryClient provider)
    ├── Tooltip Provider (Radix UI)
    ├── Toast Provider (Sonner)
    └── CookieConsent (global modal)
        ↓
    Page Components (src/pages/)
        ├── Layout wrapper: Header + Main Content + Footer
        └── Route-specific page component
```

### Directory Organization

```
src/
├── pages/              # Route-level page components
│   ├── Index.tsx       # Home page (/)
│   ├── Games.tsx       # Games showcase (/games)
│   ├── About.tsx       # About page (/about)
│   ├── Contact.tsx     # Contact form (/contact)
│   ├── [legal pages]   # Privacy, terms, compliance pages
│   └── NotFound.tsx    # 404 page (*)
├── components/
│   ├── Header.tsx      # Sticky navigation
│   ├── Footer.tsx      # Footer
│   ├── Hero.tsx        # Hero sections
│   ├── [content]       # Feature components
│   ├── terms/          # Legal document subcomponents
│   └── ui/             # shadcn/ui primitives (50+)
├── hooks/              # Custom React hooks
├── lib/                # Utilities (cn(), etc.)
├── integrations/       # Backend integrations
│   └── supabase/       # Supabase client + types
├── main.tsx            # React root
├── App.tsx             # Router + providers
└── index.css           # Global Tailwind + styles
```

---

## Component Architecture

### Page Components (`src/pages/`)

**Pattern**: Each page is a full route with layout

```typescript
// src/pages/YourPage.tsx
export default function YourPage() {
  return (
    <>
      <Header />
      <main className="container mx-auto">
        {/* Page content */}
      </main>
      <Footer />
    </>
  );
}
```

**Rules:**
- Always include `<Header />` and `<Footer />`
- Use `<main>` for semantic HTML
- Use `container mx-auto` for max-width centering
- Export as default for route imports

### Layout Components

**Header.tsx**
- Sticky navigation with mobile menu toggle
- Uses `useState` for mobile menu state
- Navigation links via React Router `<Link>`
- Responsive: Mobile menu on sm breakpoint, horizontal nav on md+

**Footer.tsx**
- Company info and links
- Legal document links (privacy, terms, etc.)
- Utility functions/contact info

**CookieConsent.tsx**
- Global modal that appears on first visit
- Manages cookie preferences in localStorage
- Updates Google Analytics consent mode
- Persists as JSON: `localStorage.getItem('cookie-consent')`

### Content Components

**Reusable Components:**
- `Hero.tsx` - Hero sections with background and CTA
- `ServicesSection.tsx` - Feature/capability showcase
- `FeaturedGame.tsx` - Game showcase card
- `ImageCarousel.tsx` - Carousel using Embla Carousel

**Pattern**: Props-driven with Tailwind styling

```typescript
interface HeroProps {
  title: string;
  subtitle: string;
  imageSrc: string;
  ctaText?: string;
}

export function Hero({ title, subtitle, imageSrc, ctaText }: HeroProps) {
  return (
    <section className="relative h-96 bg-gray-900">
      {/* Content */}
    </section>
  );
}
```

### UI Components (`src/components/ui/`)

**shadcn/ui Primitives** (50+ components):
- Button, Card, Dialog, Form, Input, Select, etc.
- Built on Radix UI primitives
- Tailwind-styled with custom theme colors
- Type-safe with TypeScript

**Adding New UI Components:**
```bash
npx shadcn-ui@latest add [component-name]
# Scaffolds into src/components/ui/[component].tsx
```

**Usage Pattern:**
```typescript
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function MyComponent() {
  return (
    <Card>
      <CardContent>
        <Button variant="outline">Click me</Button>
      </CardContent>
    </Card>
  );
}
```

---

## Routing & Navigation

### Route Setup (`App.tsx`)

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';

export function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/games" element={<Games />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            {/* Legal pages */}
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/cookie-policy" element={<CookiePolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/coppa-compliance" element={<COPPACompliance />} />
            <Route path="/gdpr-compliance" element={<GDPRCompliance />} />
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <CookieConsent />
        </TooltipProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
```

### Navigation Patterns

**Link to Route:**
```typescript
import { Link } from 'react-router-dom';

<Link to="/games">Games</Link>
```

**Programmatic Navigation:**
```typescript
import { useNavigate } from 'react-router-dom';

export function MyComponent() {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/games');
  };

  return <button onClick={handleClick}>Go to Games</button>;
}
```

---

## State Management

### Local Component State

```typescript
const [isOpen, setIsOpen] = useState(false);
const [formData, setFormData] = useState({ name: '', email: '' });
```

### Form State (React Hook Form + Zod)

**Pattern**: Validation schema + form hook

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().min(1, 'Name required'),
  email: z.string().email('Invalid email'),
  message: z.string().min(10, 'Message too short'),
});

type ContactForm = z.infer<typeof contactSchema>;

export function ContactForm() {
  const form = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', email: '', message: '' },
  });

  async function onSubmit(values: ContactForm) {
    try {
      // Submit to backend
      const response = await supabase.functions.invoke('send-contact-email', {
        body: values,
      });

      if (response.error) throw response.error;

      toast.success('Message sent!');
      form.reset();
    } catch (error) {
      toast.error('Failed to send message');
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields with form.register() */}
    </form>
  );
}
```

### Data Fetching (React Query)

**Setup** (in `App.tsx`):
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

// In provider tree:
<QueryClientProvider client={queryClient}>
  {/* App */}
</QueryClientProvider>
```

**Usage Pattern**:
```typescript
import { useQuery } from '@tanstack/react-query';

export function GamesList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['games'],
    queryFn: async () => {
      const response = await fetch('/api/games');
      return response.json();
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading games</div>;

  return <div>{data.map(game => <GameCard key={game.id} {...game} />)}</div>;
}
```

---

## Styling with Tailwind CSS

### Core Framework

- **File**: `tailwind.config.ts` - Theme configuration
- **CSS Input**: `src/index.css` - Global styles
- **Utilities**: `cn()` in `src/lib/utils.ts` (clsx + tailwind-merge)

### Responsive Design

**Mobile-First Breakpoints:**
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

**Pattern:**
```typescript
<div className="text-sm md:text-base lg:text-lg">
  Responsive text size
</div>

<nav className="hidden md:flex">
  Desktop navigation
</nav>

<nav className="md:hidden">
  Mobile navigation
</nav>
```

### Conditional Classes

**Using `cn()` utility:**
```typescript
import { cn } from '@/lib/utils';

interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

export function CustomButton({ variant = 'primary', size = 'md' }: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded font-semibold transition-colors',
        variant === 'primary' && 'bg-blue-500 text-white hover:bg-blue-600',
        variant === 'secondary' && 'bg-gray-200 text-gray-900 hover:bg-gray-300',
        size === 'sm' && 'px-2 py-1 text-sm',
        size === 'md' && 'px-4 py-2 text-base',
        size === 'lg' && 'px-6 py-3 text-lg',
      )}
    >
      Click me
    </button>
  );
}
```

---

## Backend Integration (Supabase)

### Client Setup

**File**: `src/integrations/supabase/client.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

### Common Patterns

**Call Serverless Function:**
```typescript
const { data, error } = await supabase.functions.invoke('send-contact-email', {
  body: { name: 'John', email: 'john@example.com', message: 'Hello' },
});

if (error) {
  console.error('Function error:', error);
} else {
  console.log('Success:', data);
}
```

**Query Database:**
```typescript
const { data, error } = await supabase
  .from('games')
  .select('*')
  .eq('status', 'published');

if (error) throw error;
return data;
```

---

## Common Implementation Patterns

### Adding a New Page

1. **Create page component** in `src/pages/YourPage.tsx`
2. **Add route** in `src/App.tsx`
3. **Add navigation link** in `src/components/Header.tsx`

### Adding a New UI Component

**Use shadcn/ui CLI:**
```bash
npx shadcn-ui@latest add select
```

### Implementing a Form

**Pattern**: React Hook Form + Zod + shadcn Form

### Showing Toast Notifications

**Using Sonner:**
```typescript
import { toast } from 'sonner';

toast.success('Operation completed!');
toast.error('Something went wrong');
```

---

## Development Workflow

### File Modification

- **Edit existing files** whenever possible (don't create new ones)
- **Maintain consistency** with existing code style and patterns
- **Use import aliases** (`@/`) for all imports

### Testing Locally

**Development Server:**
```bash
npm run dev
# Starts on localhost:8080 with HMR
```

### Linting & Formatting

**Check for issues:**
```bash
npm run lint
```

---

## Performance Considerations

- **Code Splitting**: React Router enables automatic route-based code splitting
- **Tree Shaking**: Vite with SWC transpiler handles dead code elimination
- **Image Optimization**: PNG assets in `/public/` (consider webp for future)
- **CSS**: Tailwind JIT eliminates unused styles
- **Caching**: React Query handles data caching automatically
