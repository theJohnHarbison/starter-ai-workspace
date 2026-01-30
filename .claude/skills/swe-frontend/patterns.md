##  UI Component Mastery

### Essential Component Categories
- **Typography**: Text component with 15+ semantic styles and comprehensive color variants
- **Interactive Elements**: Button (with mandatory `id` prop), ButtonIcon with GTM tracking and accessibility built-in
- **Form Components**: FormInput with comprehensive validation support (NO external form libraries)
- **Layout Components**: Modal, Card, Table with responsive design and keyboard navigation
- **Data Display**: Chip, Badge, Status indicators with consistent styling
- **Navigation**: Proper focus management and keyboard accessibility patterns
- **Icons**: Use lucide-react icons from @/ui (NO direct SVG usage)

### Component Usage Standards
```typescript

// Proper component composition with mandatory props and GTM tracking
const UserProfileForm = ({ user, onSave }: UserProfileFormProps) => {
  return (
    <form onSubmit={handleSubmit}>
      <Text as="headline-lg">Edit Profile</Text>
      <FormInput.Text
        id="user-name"
        label="Full Name"
        value={user.name}
        onChange={handleNameChange}
        required
        aria-describedby="name-help"
      />
      <Button
        id="save-profile" // MANDATORY: id prop required for all buttons
        variant="primary"
        type="submit"
        gtmEventName="user_profile_save"
        gtmEventDTO={{ userId: user.id, section: 'profile' }}
      >
        Save Changes
      </Button>
    </form>
  );
};
```

### Icon Usage Standards (Updated)
```typescript
// MANDATORY: Use lucide-react icons from @/ui
// NEVER use direct SVG elements

import { Icon } from '@/ui';

// Correct icon usage - standard size (16x16 / h-4 w-4)
<Button
  id="add-user"
  iconLeft={<Icon name="Plus" />}
  variant="primary"
>
  Add User
</Button>

// Icon sizes should be 16x16 (h-4 w-4) for button integration
<Icon name="User" className="h-4 w-4" />
<Icon name="Settings" className="h-4 w-4" />
<Icon name="Search" className="h-4 w-4" />

// Icons in different contexts
<FormInput.Text
  id="search-input"
  leftIcon="Search" // String name for FormInput
  placeholder="Search users..."
/>

// ANTI-PATTERNS - DO NOT USE:
// ❌ Direct SVG usage
<svg>...</svg>

// ❌ External icon libraries
import { FaUser } from 'react-icons/fa';

// ❌ Custom SVG components outside design system
<CustomSvgIcon />
```

### GTM Integration Requirements
All interactive elements must include proper GTM tracking:
```typescript
// MANDATORY: id prop required for ALL Button components
<Button
  id="unique-button-id" // REQUIRED - cannot be omitted
  gtmEventName="descriptive_event_name"
  gtmEventDTO={{ key: 'value', context: 'specific' }}
>
  Button Text
</Button>
```

### Form Validation Standards (Updated)
```typescript
// NO external form libraries - use native HTML validation with FormInput
const RegistrationForm = () => {
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [errors, setErrors] = useState({});

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Handle validation and errors immediately
    if (!formData.name) {
      setErrors({ name: 'Name is required' });
      return;
    }
    // Continue with submission
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormInput.Text
        id="registration-name"
        label="Full Name"
        value={formData.name}
        onChange={(value) => setFormData(prev => ({ ...prev, name: value }))}
        errorMessage={errors.name}
        required
      />
      <Button
        id="submit-registration"
        type="submit"
        gtmEventName="registration_submit"
        gtmEventDTO={{ formType: 'user_registration' }}
      >
        Register
      </Button>
    </form>
  );
};
```

## React Development Patterns

### Component Architecture Standards
```typescript
// Proper TypeScript component definition
interface ComponentProps {
  data: DataType;
  onAction?: (id: string) => void;
  className?: string;
  children?: React.ReactNode;
}

export const Component: FC<ComponentProps> = ({ 
  data, 
  onAction, 
  className,
  children 
}) => {
  // Component implementation with  UI
  return (
    <div className={`base-styles ${className}`}>
      <Text as="headline-md">{data.title}</Text>
      {children}
    </div>
  );
};
```

### State Management Patterns
```typescript
// Custom hooks with data-type specific cache configuration
export const useUserData = (userId: string) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUserData(userId),
    enabled: !!userId,
    // User/Profile Data cache settings
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3, // 3 attempts with exponential backoff
    refetchOnWindowFocus: false,
  });

  return { user: data, isLoading, error, refetch };
};

// Real-time Data configuration
export const useRealTimeData = () => {
  return useQuery({
    queryKey: ['realtime-data'],
    queryFn: fetchRealTimeData,
    staleTime: 0,
    refetchInterval: 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
  });
};

// Form/Validation Data configuration  
export const useFormValidation = (formData: FormData) => {
  return useQuery({
    queryKey: ['form-validation', formData],
    queryFn: () => validateFormData(formData),
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
};

// Static/Reference Data configuration
export const useStaticData = () => {
  return useQuery({
    queryKey: ['static-reference-data'],
    queryFn: fetchStaticData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
};

// Context for global state
export const UserProvider = ({ children }: PropsWithChildren) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  const value = {
    selectedUser,
    setSelectedUser,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};
```

### React Query Cache Management and Mutations
```typescript
// Mutation with proper cache invalidation using Promise.all
export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateUserData,
    onSuccess: async () => {
      // Invalidate directly related queries
      await queryClient.invalidateQueries({ queryKey: ['user'] });
      
      // Invalidate multiple related queries with Promise.all
      const relatedKeys = [
        ['users-list'],
        ['user-stats'],
        ['recent-users']
      ];
      
      await Promise.all(
        relatedKeys.map((key) =>
          queryClient.invalidateQueries({ queryKey: key })
        )
      );
    },
  });
};

// Use existing QueryProvider unless strictly needed for new functionality
// Configure cache settings based on data type patterns above
```

## Next.js Application Patterns

### App Router Implementation
```typescript
// app/layout.tsx - Root layout with  UI
import { Text } from '@/ui';
import '@/ui/index.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="min-h-screen bg-gray-50">
          {children}
        </div>
      </body>
    </html>
  );
}

// app/dashboard/page.tsx - Page with metadata
export const metadata: Metadata = {
  title: 'Dashboard | ',
  description: 'Application dashboard',
};

export default function DashboardPage() {
  return <DashboardContent />;
}
```

### API Route Patterns
```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const users = await fetchUsers();
    return NextResponse.json({ data: users, success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch users', success: false },
      { status: 500 }
    );
  }
}
```

## Testing Infrastructure Excellence

### Playwright Component Testing
```typescript
// tests/components/UserProfile.spec.ts
import { test, expect } from '@playwright/test';

test.describe('UserProfile Component', () => {
  test('renders user information with proper accessibility', async ({ page }) => {
    await page.goto('/components/user-profile');
    
    // Accessibility testing
    await expect(page.locator('[role="main"]')).toBeVisible();
    await expect(page.locator('h1')).toHaveAccessibleName();
    
    // Visual regression testing
    await expect(page).toHaveScreenshot('user-profile.png');
  });

  test('handles keyboard navigation properly', async ({ page }) => {
    await page.goto('/components/user-profile');
    await page.keyboard.press('Tab');
    
    const focusedElement = await page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});
```

### Cypress E2E Testing with POM Pattern
```typescript
// cypress/support/pages/UserRegistrationPage.ts - Page Object Model
export class UserRegistrationPage {
  // Locators
  private nameInput = '[data-testid="user-name-input"]';
  private emailInput = '[data-testid="user-email-input"]';
  private submitButton = '[data-testid="submit-registration"]';
  private successMessage = '[data-testid="registration-success"]';

  // Actions
  visit() {
    cy.visit('/register-user');
    return this;
  }

  fillName(name: string) {
    cy.get(this.nameInput).type(name);
    return this;
  }

  fillEmail(email: string) {
    cy.get(this.emailInput).type(email);
    return this;
  }

  submit() {
    cy.get(this.submitButton).click();
    return this;
  }

  // Verifications
  shouldShowSuccessMessage() {
    cy.get(this.successMessage).should('be.visible');
    return this;
  }

  shouldTriggerGTMEvent(eventName: string) {
    cy.get('@gtmSpy').should('have.been.calledWith', eventName);
    return this;
  }
}

// cypress/e2e/user-workflow.cy.ts - Test implementation using POM
import { UserRegistrationPage } from '../support/pages/UserRegistrationPage';

describe('User Registration Workflow', () => {
  let userPage: UserRegistrationPage;

  beforeEach(() => {
    userPage = new UserRegistrationPage();
    // Setup GTM spy
    cy.window().then((win) => {
      cy.spy(win, 'gtag').as('gtmSpy');
    });
  });

  it('completes full user registration journey with external API validation', () => {
    // Follow POM pattern for complete end-to-end workflow
    userPage
      .visit()
      .fillName('John Doe')
      .fillEmail('john.doe@example.com')
      .submit()
      .shouldShowSuccessMessage()
      .shouldTriggerGTMEvent('user_registration_submit');
    
    // Verify external API was called
    cy.intercept('POST', '/api/users').as('createUser');
    cy.wait('@createUser').then((interception) => {
      expect(interception.response?.statusCode).to.equal(201);
    });
  });

  it('handles validation errors in the complete workflow', () => {
    userPage
      .visit()
      .submit(); // Submit without filling required fields
    
    // Verify error states and GTM tracking
    cy.get('[data-testid="name-error"]').should('contain', 'Name is required');
    cy.get('@gtmSpy').should('have.been.calledWith', 'validation_error');
  });
});
```

## Performance Optimization Strategies

### Code Splitting and Lazy Loading
```typescript
// Dynamic imports for performance
const HeavyComponent = dynamic(
  () => import('@/components/HeavyComponent'),
  {
    loading: () => <Text as="body-md">Loading...</Text>,
    ssr: false,
  }
);

// React.lazy for component-level splitting
const ChartComponent = lazy(() => import('@/components/ChartComponent'));

const Dashboard = () => {
  return (
    <Suspense fallback={<Text as="body-md">Loading dashboard...</Text>}>
      <ChartComponent />
    </Suspense>
  );
};
```

### Memoization Patterns
```typescript
// Component memoization
const UserCard = React.memo(({ user, onSelect }: UserCardProps) => {
  return (
    <div onClick={() => onSelect(user.id)}>
      <Text as="headline-sm">{user.name}</Text>
      <Text as="body-sm">{user.email}</Text>
    </div>
  );
});

// Hook memoization
const useUserList = (filters: UserFilters) => {
  const filteredUsers = useMemo(() => {
    return users.filter(user => 
      matchesFilters(user, filters)
    );
  }, [users, filters]);

  const handleSelectUser = useCallback((userId: string) => {
    setSelectedUser(userId);
  }, []);

  return { filteredUsers, handleSelectUser };
};
```

## Accessibility Implementation Excellence

### WCAG 2.1 AA Compliance Patterns
```typescript
// Proper ARIA implementation
const DataTable = ({ data, columns }: DataTableProps) => {
  return (
    <Table
      aria-label="User data table"
      role="table"
    >
      <thead>
        <tr role="row">
          {columns.map(column => (
            <th
              key={column.key}
              role="columnheader"
              aria-sort={getSortDirection(column.key)}
            >
              <Text as="label-md">{column.label}</Text>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map(row => (
          <tr key={row.id} role="row">
            {columns.map(column => (
              <td key={column.key} role="gridcell">
                <Text as="body-sm">{row[column.key]}</Text>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
};
```

### Keyboard Navigation Implementation
```typescript
// Proper focus management
const Modal = ({ isOpen, onClose, children }: ModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus first focusable element
      const firstFocusable = modalRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;
      firstFocusable?.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50"
    >
      {children}
    </div>
  );
};
```

## Security and Analytics Integration

### GTM Integration Patterns
```typescript
// GTM event tracking utility
export const trackGTMEvent = (eventName: string, eventDTO: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, eventDTO);
  }
};

// Component with integrated tracking
const SearchForm = ({ onSearch }: SearchFormProps) => {
  const handleSubmit = (query: string) => {
    trackGTMEvent('search_performed', {
      query,
      timestamp: new Date().toISOString(),
      page: window.location.pathname,
    });
    onSearch(query);
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSubmit(query);
    }}>
      <FormInput
        id="search-input"
        placeholder="Search users..."
        value={query}
        onChange={setQuery}
      />
      <Button
        id="search-submit"
        type="submit"
        gtmEventName="search_submit"
        gtmEventDTO={{ context: 'user_search' }}
      >
        Search
      </Button>
    </form>
  );
};
```

### Security Implementation
```typescript
// Input sanitization
import DOMPurify from 'dompurify';

const SafeContent = ({ html }: { html: string }) => {
  const sanitizedHtml = DOMPurify.sanitize(html);
  return <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
};

// Secure API client
class SecureApiClient {
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const token = await getAuthToken();
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }
}
```

## Success Criteria and Quality Standards

### Component Quality Metrics
- **Accessibility Score**: WCAG 2.1 AA compliance with 95%+ automated testing score
- **Performance Budget**: Core Web Vitals within acceptable ranges (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- **Type Safety**: 100% TypeScript coverage with strict configuration
- **Test Coverage**: 90%+ component test coverage with Playwright and React Testing Library

### Implementation Standards
- **GTM/GA Integration**: All interactive elements include proper tracking
- **Responsive Design**: Mobile-first implementation with all breakpoints tested
- **Error Handling**: Comprehensive error boundaries and graceful degradation
- **Security**: Input validation, XSS prevention, and secure authentication patterns
- **Documentation**: Comprehensive component documentation with usage examples

### Continuous Improvement Framework
- **Performance Monitoring**: Regular Core Web Vitals analysis and optimization
- **Accessibility Auditing**: Automated and manual accessibility testing
- **Design System Evolution**: Feedback loop with design team for component improvements
- **Code Quality**: Regular code reviews, linting, and refactoring
- **Testing Enhancement**: Continuous improvement of test coverage and quality

## Workspace Integration and Collaboration

### Tool Integration
- **List Roles**: Use `scripts/list-roles` to understand available workspace roles
- **List Projects**: Use `scripts/list-projects` to discover project context
- **GitHub Integration**: Leverage MCP GitHub services for code review and collaboration
- **Figma Integration**: Use MCP Figma services for design system synchronization

### Knowledge Contribution
- Document new patterns and solutions in time-stamped files in docs/_tasks/
- Contribute to design system evolution with component usage feedback
- Share performance optimization discoveries and accessibility improvements
- Maintain comprehensive examples and best practices documentation

### Quality Assurance Collaboration
- Coordinate with QA teams on Cypress E2E testing strategies
- Collaborate on accessibility testing and compliance validation
- Share testing patterns and infrastructure improvements
- Ensure proper integration with CI/CD pipelines and quality gates

You excel at creating production-ready frontend applications that seamlessly integrate design systems while maintaining the highest standards for accessibility, performance, security, and user experience.