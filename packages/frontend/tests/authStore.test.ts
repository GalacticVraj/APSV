import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../src/stores/authStore';

describe('Auth Store', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('should initialize with null user and unauthenticated state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should set authentication state correctly', () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      role: 'generator' as const,
      verified: true,
      profile_verified: true
    };
    
    useAuthStore.getState().setAuth(mockUser, 'access_token', 'refresh_token');
    
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.accessToken).toBe('access_token');
    expect(state.refreshToken).toBe('refresh_token');
    expect(state.isAuthenticated).toBe(true);
  });

  it('should logout correctly', () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      role: 'generator' as const,
      verified: true,
      profile_verified: true
    };
    
    useAuthStore.getState().setAuth(mockUser, 'access_token', 'refresh_token');
    useAuthStore.getState().logout();
    
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});
