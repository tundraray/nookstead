import React from 'react';
import { render } from '@testing-library/react';

// Mock next-auth
jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  signIn: jest.fn(),
  useSession: jest.fn(() => ({ data: null, status: 'unauthenticated' })),
}));

// Mock the auth module
jest.mock('../src/auth', () => ({
  auth: jest.fn(() => Promise.resolve(null)),
  handlers: { GET: jest.fn(), POST: jest.fn() },
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

// Import LoginButton instead of async server component
import { LoginButton } from '../src/components/auth/LoginButton';

describe('Landing Page', () => {
  it('should render login button successfully', () => {
    const { baseElement } = render(<LoginButton provider="google" />);
    expect(baseElement).toBeTruthy();
  });

  it('should display provider name', () => {
    const { getByText } = render(<LoginButton provider="discord" />);
    expect(getByText('Sign in with Discord')).toBeTruthy();
  });
});
