import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';

/** The signed-in user (null when signed out), plus sign-in / register / sign-out. */
export function useAuth() {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => { try { return (await api.get('/auth/me'))?.user ?? null; } catch { return null; } },
    staleTime: 60_000,
  });
  const onUser = (data) => { qc.setQueryData(['me'], data.user); qc.removeQueries({ queryKey: ['learn'] }); };
  const login = useMutation({ mutationFn: (c) => api.post('/auth/login', c), onSuccess: onUser });
  const register = useMutation({ mutationFn: (c) => api.post('/auth/register', c), onSuccess: onUser });
  const logout = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSettled: () => { qc.setQueryData(['me'], null); qc.removeQueries({ queryKey: ['learn'] }); qc.removeQueries({ queryKey: ['admin'] }); },
  });
  const user = me.data ?? null;
  return { user, loading: me.isLoading, isAdmin: user?.role === 'admin', login, register, logout };
}

const DEFAULT_SETTINGS = {
  siteTitle: 'SignSense', tagline: 'Sign in one direction, speech in the other.', announcement: '',
  registrationOpen: true, learningEnabled: true, feedbackEnabled: true,
};

/** Public site settings (admin-editable), with safe defaults while loading or offline. */
export function useSiteSettings() {
  const q = useQuery({
    queryKey: ['settings'],
    queryFn: async () => { try { return (await api.get('/settings'))?.settings ?? DEFAULT_SETTINGS; } catch { return DEFAULT_SETTINGS; } },
    staleTime: 5 * 60_000,
  });
  return { ...DEFAULT_SETTINGS, ...(q.data || {}) };
}
