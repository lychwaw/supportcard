import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Auth from '../pages/Auth';

// Mock the Auth component dependencies
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: null,
    signOut: vi.fn(),
  }),
}));

vi.mock('@/contexts/RoleContext', () => ({
  useRole: () => ({
    isChild: false,
    children: [],
  }),
}));

vi.mock('@/components/PermissionProvider', () => ({
  usePermissionContext: () => ({
    isParent: true,
    hasPermission: () => true,
  }),
}));

describe('Auth Component', () => {
  it('renders login and signup tabs', () => {
    render(<Auth />);
    
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByText('Sign Up')).toBeInTheDocument();
  });

  it('shows OAuth buttons', () => {
    render(<Auth />);
    
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    expect(screen.getByText('Continue with Apple')).toBeInTheDocument();
  });

  it('shows country selection in signup', () => {
    render(<Auth />);
    
    // Click on signup tab
    fireEvent.click(screen.getByText('Sign Up'));
    
    expect(screen.getByText('Country')).toBeInTheDocument();
    expect(screen.getByText('ID Number')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(<Auth />);
    
    // Try to submit empty form
    fireEvent.click(screen.getByText('Sign In'));
    
    // Should show validation error (implementation depends on your validation)
    await waitFor(() => {
      // Add your validation error text here
    });
  });
});

